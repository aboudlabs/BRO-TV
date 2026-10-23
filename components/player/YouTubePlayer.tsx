'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PlaybackAction, PlaybackCommand, PlayerHandle, StartAt } from '@/lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
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
  controls?: boolean;
}

const YT_PLAYING = 1;
const YT_PAUSED = 2;

/** مشغل YouTube مع مزامنة (تشغيل/إيقاف/قفز) عبر YouTube IFrame API */
const YouTubePlayer = forwardRef<PlayerHandle, Props>(function YouTubePlayer({ videoId, startAt, onLocal, controls = true }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const playingRef = useRef(false);
  const suppressUntil = useRef(0);
  const pendingRef = useRef<PlaybackCommand | null>(null);
  const startAtRef = useRef(startAt);
  const onLocalRef = useRef(onLocal);
  onLocalRef.current = onLocal;
  const [error, setError] = useState<string | null>(null);

  const applyNow = useCallback((cmd: PlaybackCommand) => {
    const p = playerRef.current;
    if (!p) return;
    suppressUntil.current = Date.now() + 1600;
    if (cmd.action === 'seek') {
      p.seekTo(cmd.time, true);
    } else if (cmd.action === 'play') {
      const cur = Number(p.getCurrentTime?.() ?? 0);
      if (Math.abs(cur - cmd.time) > 1) p.seekTo(cmd.time, true);
      p.playVideo();
    } else {
      p.pauseVideo();
      const cur = Number(p.getCurrentTime?.() ?? 0);
      if (Math.abs(cur - cmd.time) > 0.5) p.seekTo(cmd.time, true);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      apply(cmd) {
        if (!readyRef.current) {
          pendingRef.current = cmd;
          return;
        }
        applyNow(cmd);
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
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1, controls: controls ? 1 : 0, disablekb: controls ? 0 : 1, origin: window.location.origin },
          events: {
            onReady: () => {
              readyRef.current = true;
              const pending = pendingRef.current;
              pendingRef.current = null;
              const initial = startAtRef.current;
              startAtRef.current = null;
              if (pending) applyNow(pending);
              else if (initial) applyNow({ action: initial.playing ? 'play' : 'pause', time: initial.time });
            },
            onStateChange: (e: { data: number }) => {
              const p = playerRef.current;
              if (!p) return;
              const time = Number(p.getCurrentTime?.() ?? 0);
              if (e.data === YT_PLAYING) {
                playingRef.current = true;
                lastTime = time;
                lastTick = Date.now();
                if (Date.now() >= suppressUntil.current) onLocalRef.current('play', time);
              } else if (e.data === YT_PAUSED) {
                playingRef.current = false;
                lastTime = time;
                lastTick = Date.now();
                if (Date.now() >= suppressUntil.current) onLocalRef.current('pause', time);
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
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [videoId, applyNow, controls]);

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
