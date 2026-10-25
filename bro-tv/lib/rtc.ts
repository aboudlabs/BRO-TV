/**
 * بث الشاشة بين أعضاء الغرفة عبر WebRTC (Mesh): صاحب البث يرسل فيديو/صوت الشاشة لكل مشاهد،
 * والتشوير (offer/answer/ice) يمرّ عبر قناة Supabase Broadcast نفسها — لا خادم إضافي.
 * هذا يضمن مزامنة كاملة لأي محتوى (حتى سيرفرات iframe) لأن الجميع يرى نفس البث بالضبط.
 */

export interface RtcSignal {
  type: 'request' | 'offer' | 'answer' | 'ice' | 'bye';
  from: string;
  to: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

export type ViewerState = 'idle' | 'connecting' | 'connected' | 'failed';

export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:global.stun.twilio.com:3478',
      ],
    },
  ];
  // اختياري: خادم TURN لتحسين الاتصال خلف الشبكات المقيِّدة (انظر README)
  const url = process.env.NEXT_PUBLIC_TURN_URL;
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (url && username && credential) {
    servers.push({ urls: url.split(',').map((s) => s.trim()), username, credential });
  }
  return servers;
}

interface Hooks {
  selfId: string;
  send: (signal: RtcSignal) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onViewerState: (state: ViewerState) => void;
  onViewerCount: (count: number) => void;
}

const REQUEST_TIMEOUT_MS = 7000;
const MAX_ATTEMPTS = 4;
const MAX_BITRATE = 3_000_000;

export class ShareManager {
  private hooks: Hooks;
  private local: MediaStream | null = null;
  private hostPeers = new Map<string, RTCPeerConnection>();
  private viewerPc: RTCPeerConnection | null = null;
  private hostId: string | null = null;
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private state: ViewerState = 'idle';
  private disposed = false;

  constructor(hooks: Hooks) {
    this.hooks = hooks;
  }

  /* ------------------------------ جهة صاحب البث ------------------------------ */

  setLocalStream(stream: MediaStream | null): void {
    if (!stream) {
      for (const id of Array.from(this.hostPeers.keys())) {
        this.hooks.send({ type: 'bye', from: this.hooks.selfId, to: id });
        this.closeHostPeer(id);
      }
    }
    this.local = stream;
  }

  isHosting(): boolean {
    return this.local !== null;
  }

  closePeer(id: string): void {
    this.closeHostPeer(id);
  }

  private emitCount(): void {
    let n = 0;
    this.hostPeers.forEach((pc) => {
      if (pc.connectionState === 'connected') n += 1;
    });
    this.hooks.onViewerCount(n);
  }

  private closeHostPeer(id: string): void {
    const pc = this.hostPeers.get(id);
    if (pc) {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
      this.hostPeers.delete(id);
    }
    this.pendingIce.delete(id);
    this.emitCount();
  }

  private async serve(viewerId: string): Promise<void> {
    const local = this.local;
    if (!local) return;
    this.closeHostPeer(viewerId);

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    this.hostPeers.set(viewerId, pc);

    for (const track of local.getTracks()) {
      if (track.kind === 'video') {
        (track as MediaStreamTrack & { contentHint?: string }).contentHint = 'motion';
      }
      pc.addTrack(track, local);
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.hooks.send({ type: 'ice', from: this.hooks.selfId, to: viewerId, candidate: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.hostPeers.get(viewerId) !== pc) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.closeHostPeer(viewerId);
      else this.emitCount();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.tuneSenders(pc);
    this.hooks.send({ type: 'offer', from: this.hooks.selfId, to: viewerId, sdp: offer.sdp });
  }

  private tuneSenders(pc: RTCPeerConnection): void {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      try {
        const params = sender.getParameters() as RTCRtpSendParameters & { degradationPreference?: string };
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        params.encodings[0].maxBitrate = MAX_BITRATE;
        params.degradationPreference = 'maintain-framerate';
        void sender.setParameters(params).catch(() => undefined);
      } catch {
        /* بعض المتصفحات لا تدعم ضبط المعدل */
      }
    }
  }

  /* ------------------------------ جهة المشاهد ------------------------------ */

  watch(hostId: string): void {
    if (this.hostId === hostId && this.state !== 'idle' && this.state !== 'failed') return;
    this.stopWatching();
    this.hostId = hostId;
    this.attempts = 0;
    this.requestHost();
  }

  retry(): void {
    if (!this.hostId) return;
    this.attempts = 0;
    this.closeViewerPc();
    this.requestHost();
  }

  stopWatching(): void {
    this.clearRetry();
    const hadPc = this.viewerPc !== null;
    const host = this.hostId;
    this.closeViewerPc();
    if (host && hadPc) this.hooks.send({ type: 'bye', from: this.hooks.selfId, to: host });
    this.hostId = null;
    this.hooks.onRemoteStream(null);
    this.setState('idle');
  }

  private setState(state: ViewerState): void {
    if (this.state === state) return;
    this.state = state;
    this.hooks.onViewerState(state);
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private closeViewerPc(): void {
    const pc = this.viewerPc;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
      this.viewerPc = null;
    }
    if (this.hostId) this.pendingIce.delete(this.hostId);
  }

  private requestHost(): void {
    if (!this.hostId || this.disposed) return;
    this.setState('connecting');
    this.hooks.send({ type: 'request', from: this.hooks.selfId, to: this.hostId });
    this.clearRetry();
    this.retryTimer = setTimeout(() => {
      if (this.state === 'connected' || !this.hostId) return;
      this.attempts += 1;
      if (this.attempts >= MAX_ATTEMPTS) this.setState('failed');
      else this.requestHost();
    }, REQUEST_TIMEOUT_MS);
  }

  private scheduleRetry(): void {
    this.closeViewerPc();
    this.hooks.onRemoteStream(null);
    this.attempts += 1;
    if (this.attempts >= MAX_ATTEMPTS) {
      this.clearRetry();
      this.setState('failed');
    } else {
      this.requestHost();
    }
  }

  private async onOffer(sig: RtcSignal): Promise<void> {
    if (sig.from !== this.hostId || !sig.sdp) return;
    this.closeViewerPc();

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    this.viewerPc = pc;

    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      this.hooks.onRemoteStream(stream);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.hooks.send({ type: 'ice', from: this.hooks.selfId, to: sig.from, candidate: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.viewerPc !== pc) return;
      if (pc.connectionState === 'connected') {
        this.clearRetry();
        this.attempts = 0;
        this.setState('connected');
      } else if (pc.connectionState === 'failed') {
        this.scheduleRetry();
      }
    };

    await pc.setRemoteDescription({ type: 'offer', sdp: sig.sdp });
    await this.flushIce(sig.from, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.hooks.send({ type: 'answer', from: this.hooks.selfId, to: sig.from, sdp: answer.sdp });
  }

  /* ------------------------------ التشوير ------------------------------ */

  private async flushIce(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingIce.get(peerId);
    if (!queued) return;
    this.pendingIce.delete(peerId);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }

  private async onIce(sig: RtcSignal): Promise<void> {
    if (!sig.candidate) return;
    const pc = this.hostPeers.get(sig.from) ?? (sig.from === this.hostId ? this.viewerPc : null);
    if (!pc || !pc.remoteDescription) {
      const list = this.pendingIce.get(sig.from) ?? [];
      list.push(sig.candidate);
      this.pendingIce.set(sig.from, list);
      return;
    }
    try {
      await pc.addIceCandidate(sig.candidate);
    } catch {
      /* ignore */
    }
  }

  async handle(sig: RtcSignal): Promise<void> {
    if (this.disposed || sig.to !== this.hooks.selfId) return;
    try {
      switch (sig.type) {
        case 'request':
          if (this.local) await this.serve(sig.from);
          break;
        case 'offer':
          await this.onOffer(sig);
          break;
        case 'answer': {
          const pc = this.hostPeers.get(sig.from);
          if (pc && sig.sdp) {
            await pc.setRemoteDescription({ type: 'answer', sdp: sig.sdp });
            await this.flushIce(sig.from, pc);
          }
          break;
        }
        case 'ice':
          await this.onIce(sig);
          break;
        case 'bye':
          if (sig.from === this.hostId) {
            this.clearRetry();
            this.closeViewerPc();
            this.hooks.onRemoteStream(null);
            this.setState('failed');
          } else {
            this.closeHostPeer(sig.from);
          }
          break;
      }
    } catch {
      /* إشارة تالفة أو متأخرة: نتجاهلها */
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clearRetry();
    this.closeViewerPc();
    for (const id of Array.from(this.hostPeers.keys())) this.closeHostPeer(id);
    this.local = null;
  }
}
