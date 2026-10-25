'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PlaybackAction, PlaybackCommand, PlayerHandle, StartAt } from '@/lib/types';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytPromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytPromise) {
    ytPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        ytPromise = null;
        reject(new Error('YouTube API failed'));
      };
      document.head.appendChild(script);
    });
  }
  return ytPromise;
}

interface Props {
  videoId: string;
  startAt: StartAt | null;
  onLocal: (action: PlaybackAction, time: number) => void;
}

const YT_PLAYING = 1;
const YT_PAUSED = 2;

/** مشغل YouTube مع مزامنة (تشغيل/إيقاف/قفز) عبر YouTube IFrame API */
const YouTubePlayer = forwardRef<PlayerHandle, Props>(function YouTubePlayer({ videoId, startAt, onLocal }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const playingRef = useRef(false);
  // يمنع اكتشاف "القفز" أثناء تطبيقنا لأمر قادم من صديق
  const suppressUntil = useRef(0);
  // أحداث الحالة التي نتوقعها لأننا نحن من استدعى play/pause/seek (تُستهلك مرة واحدة) —
  // أما ضغط المستخدم على إيقاف/تشغيل بعد ثوانٍ فيُرسَل كالمعتاد
  const expect = useRef({ play: 0, pause: 0 });
  const pendingRef = useRef<PlaybackCommand | null>(null);
  // آخر أمر "تشغيل" وصلنا ولم يبدأ (المتصفح منع التشغيل التلقائي) لنلحق بالغرفة عند ضغط المستخدم
  const blockedRef = useRef<{ time: number; at: number } | null>(null);
  const blockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAtRef = useRef<StartAt | null>(startAt);
  const onLocalRef = useRef(onLocal);
  onLocalRef.current = onLocal;
  const [error, setError] = useState<string | null>(null);

  const applyNow = useCallback((cmd: PlaybackCommand) => {
    const p = playerRef.current;
    if (!p) return;
    const now = Date.now();
    const elapsed = cmd.action === 'play' && cmd.at ? Math.max(0, now - cmd.at) / 1000 : 0;
    const target = Math.max(0, cmd.time + elapsed);
    const cur = Number(p.getCurrentTime?.() ?? 0);
    suppressUntil.current = now + 2500;

    if (blockTimer.current) {
      clearTimeout(blockTimer.current);
      blockTimer.current = null;
    }

    // القفز يولّد حدث حالة (تحميل ثم تشغيل، أو إيقاف) نتجاهله لأننا سببناه
    const seekTo = (limit: number) => {
      if (Math.abs(cur - target) <= limit) return;
      if (playingRef.current) expect.current.play = now + 4000;
      else expect.current.pause = now + 3000;
      p.seekTo(target, true);
    };

    if (cmd.action === 'seek') {
      if (blockedRef.current) blockedRef.current = { time: target, at: now };
      seekTo(0.25);
    } else if (cmd.action === 'play') {
      seekTo(1);
      if (!playingRef.current) {
        expect.current.play = now + 8000; // قد يتأخر الحدث إن كان الفيديو يُحمَّل
        expect.current.pause = 0;
      }
      p.playVideo();
      // إن لم يبدأ التشغيل خلال ثانيتين فالمتصفح منعه
      blockTimer.current = setTimeout(() => {
        if (!playingRef.current) blockedRef.current = { time: target, at: now };
      }, 2000);
    } else {
      blockedRef.current = null;
      seekTo(0.5);
      if (playingRef.current) {
        expect.current.pause = now + 3000;
        expect.current.play = 0;
      }
      p.pauseVideo();
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      apply(cmd) {
        const withTime: PlaybackCommand = { ...cmd, at: cmd.at ?? Date.now() };
        if (!readyRef.current) {
          pendingRef.current = withTime;
          return;
        }
        applyNow(withTime);
      },
      getTime: () => Number(playerRef.current?.getCurrentTime?.() ?? 0),
      isPlaying: () => playingRef.current,
    }),
    [applyNow],
  );

  useEffect(() => {
    let destroyed = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    readyRef.current = false;
    playingRef.current = false;
    setError(null);

    loadYouTubeApi()
      .then((YT) => {
        if (destroyed || !hostRef.current) return;
        // YouTube يستبدل العنصر، لذلك ننشئ عنصراً داخلياً جديداً
        const mount = document.createElement('div');
        hostRef.current.innerHTML = '';
        hostRef.current.appendChild(mount);

        let lastTime = 0;
        let lastTick = Date.now();

        playerRef.current = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1, origin: window.location.origin },
          events: {
            onReady: () => {
              readyRef.current = true;
              const pending = pendingRef.current;
              pendingRef.current = null;
              const initial = startAtRef.current;
              startAtRef.current = null;
              if (pending) applyNow(pending);
              else if (initial) {
                applyNow({ action: initial.playing ? 'play' : 'pause', time: initial.time, at: initial.at });
              }
            },
            onStateChange: (e: { data: number }) => {
              const p = playerRef.current;
              if (!p) return;
              const now = Date.now();
              const time = Number(p.getCurrentTime?.() ?? 0);
              if (e.data === YT_PLAYING) {
                playingRef.current = true;
                lastTime = time;
                lastTick = now;
                expect.current.pause = 0;
                const blocked = blockedRef.current;
                if (blocked) {
                  // المستخدم ضغط تشغيل بعد منع المتصفح: نلحق بوقت الغرفة ولا نرسل شيئاً
                  blockedRef.current = null;
                  expect.current.play = 0;
                  const target = blocked.time + (now - blocked.at) / 1000;
                  if (Math.abs(time - target) > 1) {
                    suppressUntil.current = now + 2500;
                    p.seekTo(target, true);
                  }
                  return;
                }
                if (now < expect.current.play) {
                  expect.current.play = 0; // صدى أمر طبّقناه نحن
                  return;
                }
                onLocalRef.current('play', time);
              } else if (e.data === YT_PAUSED) {
                playingRef.current = false;
                lastTime = time;
                lastTick = now;
                expect.current.play = 0;
                if (now < expect.current.pause) {
                  expect.current.pause = 0;
                  return;
                }
                onLocalRef.current('pause', time);
              }
            },
            onError: () => setError('تعذّر تشغيل هذا الفيديو (قد يكون التضمين غير مسموح).'),
          },
        });

        // اكتشاف القفز (Seek) لأن YouTube لا يرسل حدثاً مخصصاً له
        interval = setInterval(() => {
          const p = playerRef.current;
          if (!p || !readyRef.current) return;
          const cur = Number(p.getCurrentTime?.() ?? 0);
          const now = Date.now();
          const expected = lastTime + (playingRef.current ? (now - lastTick) / 1000 : 0);
          if (Math.abs(cur - expected) > 1.8 && now >= suppressUntil.current) {
            onLocalRef.current('seek', cur);
          }
          lastTime = cur;
          lastTick = now;
        }, 500);
      })
      .catch(() => setError('تعذّر تحميل مشغل YouTube.'));

    return () => {
      destroyed = true;
      readyRef.current = false;
      if (interval) clearInterval(interval);
      if (blockTimer.current) clearTimeout(blockTimer.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [videoId, applyNow]);

  return (
    <div className="relative h-full w-full bg-black">
      <div ref={hostRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/90 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-champagne-400" />
          <p className="max-w-md text-sm text-champagne-100/90">{error}</p>
        </div>
      )}
    </div>
  );
});

export default YouTubePlayer;
