'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { SERVERS } from '@/lib/servers';
import { mediaKey, mediaTitle } from '@/lib/media';
import { ShareManager, type RtcSignal, type ViewerState } from '@/lib/rtc';
import { colorFromString, formatTime, randomId } from '@/lib/utils';
import type {
  ChatMessage,
  FloatingReaction,
  Media,
  Member,
  PlaybackAction,
  PlaybackCommand,
  StartAt,
} from '@/lib/types';

export type RoomStatus = 'connecting' | 'connected' | 'error' | 'unconfigured';
export type MediaChangeReason = 'select' | 'episode' | 'server' | 'sandbox' | 'custom' | 'screen' | 'stop';

interface Options {
  roomId: string;
  clientId: string;
  name: string;
  onPlayback: (cmd: PlaybackCommand) => void;
  onSync: (time: number, playing: boolean) => void;
  getPlayerState: () => { time: number; playing: boolean };
}

interface MediaEvent {
  media: Media | null;
  by: string;
  reason: MediaChangeReason;
}
interface PlaybackEvent {
  action: PlaybackAction;
  time: number;
  by: string;
}
interface SyncEvent {
  time: number;
  playing: boolean;
  by: string;
}
interface HeartbeatEvent {
  time: number;
  key: string;
}
interface StateEvent {
  to: string;
  media: Media;
  time: number;
  playing: boolean;
}
interface PresenceMeta {
  name?: string;
  joinedAt?: number;
}

const MAX_MESSAGES = 250;
const HEARTBEAT_MS = 4000;
const DRIFT_LIMIT_S = 1.5;

function describeMedia(reason: MediaChangeReason, media: Media | null, by: string): string {
  // «أنت» تعني أن الفاعل هو المستخدم نفسه: نكتب بصيغة المتكلم ("اخترت") بدل "أنت اختار"
  const me = by === 'أنت';
  const who = (third: string, first: string) => (me ? first : `${by} ${third}`);
  if (!media) return `⏹️ ${who('أنهى', 'أنهيت')} العرض`;
  switch (reason) {
    case 'select': {
      const ep = media.type === 'series' ? ` (الموسم ${media.season} · الحلقة ${media.episode})` : '';
      return `🎬 ${who('اختار', 'اخترت')} «${media.title}»${ep}`;
    }
    case 'episode':
      if (media.type === 'series') return `📺 ${who('انتقل', 'انتقلت')} إلى الموسم ${media.season} · الحلقة ${media.episode}`;
      return `📺 ${who('انتقل', 'انتقلت')} إلى «${mediaTitle(media)}»`;
    case 'server': {
      const s = SERVERS[media.server ?? 0] ?? SERVERS[0];
      return `🔁 ${who('بدّل', 'بدّلت')} السيرفر إلى ${s.name}`;
    }
    case 'sandbox':
      return media.sandbox
        ? `🛡️ ${who('فعّل', 'فعّلت')} وضع الحماية (Sandbox) لمنع النوافذ المنبثقة`
        : `🔓 ${who('أوقف', 'أوقفت')} وضع الحماية (Sandbox)`;
    case 'custom':
      return `🔗 ${who('شغّل', 'شغّلت')} رابطاً خارجياً`;
    case 'screen':
      return me ? '📡 بدأت بثّ شاشتك — سيراها الجميع تلقائياً' : `📡 ${by} بدأ بث شاشته — سيظهر لك البث تلقائياً`;
    case 'stop':
      return `⏹️ ${who('أنهى', 'أنهيت')} العرض`;
  }
}

export function useRoom(options: Options) {
  const { roomId, clientId, name } = options;

  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [members, setMembers] = useState<Member[]>([]);
  const [media, setMedia] = useState<Media | null>(null);
  const [startAt, setStartAt] = useState<StartAt | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>('idle');
  const [viewerCount, setViewerCount] = useState(0);
  const [sharing, setSharing] = useState(false);

  const optsRef = useRef(options);
  optsRef.current = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const mediaRef = useRef<Media | null>(null);
  const membersRef = useRef<Member[]>([]);
  const shareRef = useRef<ShareManager | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const lastNoticeRef = useRef<Record<string, number>>({});
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateMedia = useCallback((next: Media | null) => {
    mediaRef.current = next;
    setMedia(next);
  }, []);

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
  }, []);

  const pushSystem = useCallback(
    (text: string) => {
      pushMessage({ id: randomId(), kind: 'system', text, ts: Date.now() });
    },
    [pushMessage],
  );

  const send = useCallback((event: string, payload: unknown) => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: 'broadcast', event, payload });
  }, []);

  const addReaction = useCallback((emoji: string, by: string) => {
    const id = randomId();
    const item: FloatingReaction = { id, emoji, name: by, left: 8 + Math.random() * 80 };
    setReactions((prev) => [...prev.slice(-30), item]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3400);
  }, []);

  const runCountdown = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    let n = 3;
    setCountdown(n);
    countdownTimerRef.current = setInterval(() => {
      n -= 1;
      if (n >= 0) {
        setCountdown(n);
      } else {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
      }
    }, 1000);
  }, []);

  const shouldNotice = useCallback((key: string, gapMs: number) => {
    const now = Date.now();
    const last = lastNoticeRef.current[key] ?? 0;
    if (now - last < gapMs) return false;
    lastNoticeRef.current[key] = now;
    return true;
  }, []);

  /** يوقف بث شاشتنا محلياً (بدون إعلام الغرفة) */
  const stopLocalShare = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    localStreamRef.current = null;
    stream.getTracks().forEach((t) => t.stop());
    shareRef.current?.setLocalStream(null);
    setSharing(false);
    setViewerCount(0);
  }, []);

  /* ------------------------- مدير بث الشاشة (WebRTC) ------------------------- */

  useEffect(() => {
    const manager = new ShareManager({
      selfId: clientId,
      send: (signal) => send('rtc', signal),
      onRemoteStream: setRemoteStream,
      onViewerState: setViewerState,
      onViewerCount: setViewerCount,
    });
    shareRef.current = manager;
    return () => {
      manager.dispose();
      shareRef.current = null;
      const stream = localStreamRef.current;
      localStreamRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [clientId, send]);

  // المشاهد: عند عرض بث شاشة لشخص آخر نطلب الاتصال به تلقائياً
  useEffect(() => {
    const share = shareRef.current;
    if (!share) return;
    if (media?.kind === 'screen' && media.hostId && media.hostId !== clientId) share.watch(media.hostId);
    else share.stopWatching();
  }, [media, clientId]);

  /* ------------------------------- قناة الغرفة ------------------------------- */

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setStatus('unconfigured');
      return;
    }

    setStatus('connecting');
    const joinedAt = Date.now();
    let ready = false;
    let gotState = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const channel = supabase.channel(`bro-tv:${roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: clientId },
      },
    });
    channelRef.current = channel;

    const syncMembers = () => {
      const state = channel.presenceState<PresenceMeta>();
      const list: Member[] = Object.entries(state).map(([key, metas]) => {
        const meta = metas[0] as PresenceMeta | undefined;
        return {
          id: key,
          name: meta?.name || 'ضيف',
          joinedAt: meta?.joinedAt ?? 0,
          color: colorFromString(key),
        };
      });
      list.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
      membersRef.current = list;
      setMembers(list);
    };

    channel
      .on('presence', { event: 'sync' }, syncMembers)
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (!ready || key === clientId) return;
        const meta = newPresences[0] as unknown as PresenceMeta | undefined;
        pushSystem(`👋 ${meta?.name || 'ضيف'} انضم إلى الغرفة`);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        if (key === clientId) return;
        shareRef.current?.closePeer(key);
        const current = mediaRef.current;
        if (current?.kind === 'screen' && current.hostId === key) {
          updateMedia(null);
          pushSystem('⏹️ انتهى البث لأن صاحبه غادر الغرفة');
        }
        if (!ready) return;
        const meta = leftPresences[0] as unknown as PresenceMeta | undefined;
        pushSystem(`🚪 ${meta?.name || 'ضيف'} غادر الغرفة`);
      })
      .on('broadcast', { event: 'media' }, ({ payload }) => {
        const p = payload as MediaEvent;
        gotState = true;
        // إن غيّر شخص آخر العرض أثناء بثّنا، نوقف بثّنا
        if (localStreamRef.current && !(p.media?.kind === 'screen' && p.media.hostId === clientId)) {
          stopLocalShare();
          pushSystem('⏹️ توقف بثّك لأن أحد الأعضاء غيّر العرض');
        }
        updateMedia(p.media);
        setStartAt(null);
        pushSystem(describeMedia(p.reason, p.media, p.by));
      })
      .on('broadcast', { event: 'playback' }, ({ payload }) => {
        const p = payload as PlaybackEvent;
        optsRef.current.onPlayback({ action: p.action, time: p.time, at: Date.now() });
        if (p.action === 'play' && shouldNotice('play', 1200)) {
          pushSystem(`▶️ ${p.by} شغّل الفيديو (${formatTime(p.time)})`);
        } else if (p.action === 'pause' && shouldNotice('pause', 1200)) {
          pushSystem(`⏸️ ${p.by} أوقف الفيديو مؤقتاً (${formatTime(p.time)})`);
        } else if (p.action === 'seek' && shouldNotice('seek', 3000)) {
          pushSystem(`⏩ ${p.by} انتقل إلى ${formatTime(p.time)}`);
        }
      })
      .on('broadcast', { event: 'hb' }, ({ payload }) => {
        // نبضة المزامنة من "قائد الغرفة": نصحّح الانحراف الكبير فقط
        const p = payload as HeartbeatEvent;
        const current = mediaRef.current;
        if (!current || mediaKey(current) !== p.key) return;
        const local = optsRef.current.getPlayerState();
        if (!local.playing) return;
        const target = p.time + 0.15;
        if (Math.abs(local.time - target) > DRIFT_LIMIT_S) {
          optsRef.current.onPlayback({ action: 'seek', time: target, at: Date.now() });
        }
      })
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        const p = payload as SyncEvent;
        optsRef.current.onSync(p.time, p.playing);
        pushSystem(`🔄 ${p.by} زامن المشهد معك (${formatTime(p.time)})`);
      })
      .on('broadcast', { event: 'countdown' }, ({ payload }) => {
        const p = payload as { by: string };
        runCountdown();
        pushSystem(`⏱️ ${p.by} بدأ العدّ التنازلي — اضغط تشغيل عند الصفر`);
      })
      .on('broadcast', { event: 'rtc' }, ({ payload }) => {
        void shareRef.current?.handle(payload as RtcSignal);
      })
      .on('broadcast', { event: 'request_state' }, ({ payload }) => {
        const p = payload as { from: string };
        const current = mediaRef.current;
        if (!current || p.from === clientId) return;
        const { time, playing } = optsRef.current.getPlayerState();
        send('state', { to: p.from, media: current, time, playing } satisfies StateEvent);
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        const p = payload as StateEvent;
        if (p.to !== clientId || gotState || mediaRef.current) return;
        gotState = true;
        updateMedia(p.media);
        setStartAt({ time: p.time, playing: p.playing, at: Date.now() });
        pushSystem(`🎞️ تم تحميل «${mediaTitle(p.media)}» من الغرفة`);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        pushMessage(payload as ChatMessage);
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const p = payload as { emoji: string; by: string };
        addReaction(p.emoji, p.by);
      });

    channel.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        await channel.track({ name, joinedAt } satisfies PresenceMeta);
        setStatus('connected');
        send('request_state', { from: clientId });
        timers.push(
          setTimeout(() => {
            if (!gotState && !mediaRef.current) send('request_state', { from: clientId });
          }, 2500),
        );
        timers.push(
          setTimeout(() => {
            ready = true;
          }, 1500),
        );
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
        setStatus('error');
      }
    });

    return () => {
      timers.forEach(clearTimeout);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    roomId,
    clientId,
    name,
    pushSystem,
    pushMessage,
    updateMedia,
    addReaction,
    runCountdown,
    shouldNotice,
    send,
    stopLocalShare,
  ]);

  // نبضة المزامنة: أقدم عضو في الغرفة (القائد) يبث وقته الحالي ليلحق به الباقون إذا ابتعدوا
  useEffect(() => {
    if (status !== 'connected') return;
    const timer = setInterval(() => {
      const current = mediaRef.current;
      if (!current || (current.kind !== 'direct' && current.kind !== 'youtube')) return;
      const leader = membersRef.current[0];
      if (!leader || leader.id !== clientId) return;
      const s = optsRef.current.getPlayerState();
      if (!s.playing) return;
      send('hb', { time: s.time, key: mediaKey(current) } satisfies HeartbeatEvent);
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [status, clientId, send]);

  useEffect(
    () => () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    },
    [],
  );

  /* ------------------------- أفعال المستخدم الحالي ------------------------- */

  const changeMedia = useCallback(
    (next: Media, reason: MediaChangeReason) => {
      if (localStreamRef.current && !(next.kind === 'screen' && next.hostId === clientId)) stopLocalShare();
      updateMedia(next);
      setStartAt(null);
      send('media', { media: next, by: name, reason } satisfies MediaEvent);
      pushSystem(describeMedia(reason, next, 'أنت'));
    },
    [clientId, name, pushSystem, send, stopLocalShare, updateMedia],
  );

  const clearMedia = useCallback(
    (reason: MediaChangeReason = 'stop') => {
      stopLocalShare();
      updateMedia(null);
      setStartAt(null);
      send('media', { media: null, by: name, reason } satisfies MediaEvent);
      pushSystem(describeMedia(reason, null, 'أنت'));
    },
    [name, pushSystem, send, stopLocalShare, updateMedia],
  );

  const stopShare = useCallback(() => {
    if (!localStreamRef.current) return;
    const current = mediaRef.current;
    if (current?.kind === 'screen' && current.hostId === clientId) clearMedia('stop');
    else stopLocalShare();
  }, [clearMedia, clientId, stopLocalShare]);

  const stopShareRef = useRef(stopShare);
  stopShareRef.current = stopShare;

  /** يبدأ بث الشاشة (يجب استدعاؤه من نقرة مستخدم). يرمي خطأ إن لم يُدعَم أو رُفض الإذن */
  const startShare = useCallback(async () => {
    const manager = shareRef.current;
    if (!manager) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('unsupported');
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 30 } },
      audio: true,
      selfBrowserSurface: 'exclude',
    } as DisplayMediaStreamOptions);

    localStreamRef.current = stream;
    setSharing(true);
    stream.getVideoTracks()[0]?.addEventListener('ended', () => stopShareRef.current());
    manager.setLocalStream(stream);
    changeMedia(
      { kind: 'screen', title: `بث شاشة ${name}`, hostId: clientId, hostName: name, sandbox: false },
      'screen',
    );
  }, [changeMedia, clientId, name]);

  const retryWatch = useCallback(() => shareRef.current?.retry(), []);

  const sendPlayback = useCallback(
    (action: PlaybackAction, time: number) => {
      send('playback', { action, time, by: name } satisfies PlaybackEvent);
    },
    [name, send],
  );

  const sendSync = useCallback(
    (time: number, playing: boolean) => {
      send('sync', { time, playing, by: name } satisfies SyncEvent);
      pushSystem(`🔄 زامنت المشهد مع الجميع (${formatTime(time)})`);
    },
    [name, pushSystem, send],
  );

  const startCountdown = useCallback(() => {
    send('countdown', { by: name });
    runCountdown();
    pushSystem('⏱️ بدأت العدّ التنازلي — اضغط تشغيل عند الصفر');
  }, [name, pushSystem, runCountdown, send]);

  const sendChat = useCallback(
    (text: string) => {
      const clean = text.trim().slice(0, 500);
      if (!clean) return;
      const msg: ChatMessage = {
        id: randomId(),
        kind: 'user',
        clientId,
        name,
        text: clean,
        ts: Date.now(),
      };
      pushMessage(msg);
      send('chat', msg);
    },
    [clientId, name, pushMessage, send],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      addReaction(emoji, name);
      send('reaction', { emoji, by: name });
    },
    [addReaction, name, send],
  );

  return {
    status,
    members,
    media,
    startAt,
    messages,
    reactions,
    countdown,
    remoteStream,
    viewerState,
    viewerCount,
    sharing,
    changeMedia,
    clearMedia,
    startShare,
    stopShare,
    retryWatch,
    sendPlayback,
    sendSync,
    startCountdown,
    sendChat,
    sendReaction,
  };
}
