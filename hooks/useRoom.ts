'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { SERVERS } from '@/lib/servers';
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
export type MediaChangeReason = 'select' | 'episode' | 'server' | 'sandbox' | 'custom';

interface Options {
  roomId: string;
  clientId: string;
  name: string;
  onPlayback: (cmd: PlaybackCommand) => void;
  onSync: (time: number, playing: boolean) => void;
  getPlayerState: () => { time: number; playing: boolean };
  isOwner: boolean;
}

interface MediaEvent {
  media: Media;
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

function describeMedia(reason: MediaChangeReason, media: Media, by: string): string {
  switch (reason) {
    case 'select': {
      const ep = media.type === 'series' ? ` (الموسم ${media.season} · الحلقة ${media.episode})` : '';
      return `🎬 ${by} اختار «${media.title}»${ep}`;
    }
    case 'episode':
      return `📺 ${by} انتقل إلى الموسم ${media.season} · الحلقة ${media.episode}`;
    case 'server': {
      const s = SERVERS[media.server ?? 0] ?? SERVERS[0];
      return `🔁 ${by} بدّل السيرفر إلى ${s.name}`;
    }
    case 'sandbox':
      return media.sandbox
        ? `🛡️ ${by} فعّل وضع الحماية (Sandbox) لمنع النوافذ المنبثقة`
        : `🔓 ${by} أوقف وضع الحماية (Sandbox)`;
    case 'custom':
      return `🔗 ${by} شغّل رابطاً خارجياً`;
  }
}

export function useRoom(options: Options) {
  const { roomId, clientId, name, isOwner } = options;

  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [members, setMembers] = useState<Member[]>([]);
  const [media, setMedia] = useState<Media | null>(null);
  const [startAt, setStartAt] = useState<StartAt | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);

  const optsRef = useRef(options);
  optsRef.current = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const mediaRef = useRef<Media | null>(null);
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

  const runCountdown = useCallback((startAt: number, time: number) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    const tick = () => {
      const remaining = startAt - Date.now();
      if (remaining <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
        optsRef.current.onPlayback({ action: 'play', time });
        // The owner must broadcast the actual play command after the countdown,
        // otherwise only the owner's local player receives the command.
        if (optsRef.current.isOwner) {
          send('playback', { action: 'play', time, by: optsRef.current.name } satisfies PlaybackEvent);
        }
        return;
      }
      setCountdown(Math.ceil(remaining / 1000));
    };
    tick();
    countdownTimerRef.current = setInterval(tick, 100);
  }, []);

  const shouldNotice = useCallback((key: string, gapMs: number) => {
    const now = Date.now();
    const last = lastNoticeRef.current[key] ?? 0;
    if (now - last < gapMs) return false;
    lastNoticeRef.current[key] = now;
    return true;
  }, []);

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
      list.sort((a, b) => a.joinedAt - b.joinedAt);
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
        if (!ready || key === clientId) return;
        const meta = leftPresences[0] as unknown as PresenceMeta | undefined;
        pushSystem(`🚪 ${meta?.name || 'ضيف'} غادر الغرفة`);
      })
      .on('broadcast', { event: 'media' }, ({ payload }) => {
        const p = payload as MediaEvent;
        gotState = true;
        updateMedia(p.media);
        setStartAt(null);
        pushSystem(describeMedia(p.reason, p.media, p.by));
      })
      .on('broadcast', { event: 'playback' }, ({ payload }) => {
        const p = payload as PlaybackEvent;
        optsRef.current.onPlayback({ action: p.action, time: p.time });
        if (p.action === 'play' && shouldNotice('play', 1200)) {
          pushSystem(`▶️ ${p.by} شغّل الفيديو (${formatTime(p.time)})`);
        } else if (p.action === 'pause' && shouldNotice('pause', 1200)) {
          pushSystem(`⏸️ ${p.by} أوقف الفيديو مؤقتاً (${formatTime(p.time)})`);
        } else if (p.action === 'seek' && shouldNotice('seek', 3000)) {
          pushSystem(`⏩ ${p.by} انتقل إلى ${formatTime(p.time)}`);
        }
      })
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        const p = payload as SyncEvent;
        optsRef.current.onSync(p.time, p.playing);
        pushSystem(`🔄 ${p.by} زامن المشهد معك (${formatTime(p.time)})`);
      })
      .on('broadcast', { event: 'countdown' }, ({ payload }) => {
        const p = payload as { by: string; startAt: number; time: number };
        runCountdown(p.startAt, p.time);
        pushSystem(`⏱️ ${p.by} بدأ العدّ التنازلي — سيبدأ الفيديو تلقائياً`);
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
        setStartAt({ time: p.time, playing: p.playing });
        pushSystem(`🎞️ تم تحميل «${p.media.title}» من الغرفة`);
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
  }, [roomId, clientId, name, pushSystem, pushMessage, updateMedia, addReaction, runCountdown, shouldNotice, send]);

  useEffect(
    () => () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    },
    [],
  );

  /* ------------------------- أفعال المستخدم الحالي ------------------------- */

  const changeMedia = useCallback(
    (next: Media, reason: MediaChangeReason) => {
      updateMedia(next);
      setStartAt(null);
      send('media', { media: next, by: name, reason } satisfies MediaEvent);
      pushSystem(describeMedia(reason, next, 'أنت'));
    },
    [name, pushSystem, send, updateMedia],
  );

  const sendPlayback = useCallback(
    (action: PlaybackAction, time: number) => {
      if (!isOwner) return;
      send('playback', { action, time, by: name } satisfies PlaybackEvent);
    },
    [isOwner, name, send],
  );

  const sendSync = useCallback(
    (time: number, playing: boolean) => {
      if (!isOwner) return;
      send('sync', { time, playing, by: name } satisfies SyncEvent);
      pushSystem(`🔄 زامنت المشهد مع الجميع (${formatTime(time)})`);
    },
    [isOwner, name, pushSystem, send],
  );

  const startCountdown = useCallback(() => {
    if (!isOwner) return;
    const startAt = Date.now() + 3500;
    const time = optsRef.current.getPlayerState().time;
    send('countdown', { by: name, startAt, time });
    runCountdown(startAt, time);
    pushSystem('⏱️ بدأت المزامنة — سيبدأ الفيديو تلقائياً عند الصفر');
  }, [isOwner, name, pushSystem, runCountdown, send]);

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
    changeMedia,
    sendPlayback,
    sendSync,
    startCountdown,
    sendChat,
    sendReaction,
  };
}
