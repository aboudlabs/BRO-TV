'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import type { PlaybackAction, PlaybackCommand, PlayerHandle, StartAt } from '@/lib/types';

interface Props {
  src: string;
  startAt: StartAt | null;
  onLocal: (action: PlaybackAction, time: number) => void;
}

/** مشغل mp4 / webm / m3u8 (عبر hls.js) مع مزامنة كاملة */
const DirectPlayer = forwardRef<PlayerHandle, Props>(function DirectPlayer({ src, startAt, onLocal }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const suppressUntil = useRef(0);
  const readyRef = useRef(false);
  const pendingRef = useRef<PlaybackCommand | null>(null);
  const startAtRef = useRef(startAt);
  const onLocalRef = useRef(onLocal);
  onLocalRef.current = onLocal;

  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const applyNow = useCallback((cmd: PlaybackCommand) => {
    const v = videoRef.current;
    if (!v) return;
    suppressUntil.current = Date.now() + 1400;
    if (cmd.action === 'seek') {
      v.currentTime = cmd.time;
    } else if (cmd.action === 'play') {
      if (Math.abs(v.currentTime - cmd.time) > 1) v.currentTime = cmd.time;
      v.play().then(
        () => setBlocked(false),
        () => setBlocked(true),
      );
    } else {
      v.pause();
      if (Math.abs(v.currentTime - cmd.time) > 0.5) v.currentTime = cmd.time;
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
      getTime: () => videoRef.current?.currentTime ?? 0,
      isPlaying: () => {
        const v = videoRef.current;
        return !!v && !v.paused && !v.ended;
      },
    }),
    [applyNow],
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    readyRef.current = false;
    setError(null);
    setBlocked(false);

    const isHls = /\.m3u8(?=$|[?#&])/i.test(src);

    if (isHls && !v.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            setError('المتصفح لا يدعم تشغيل روابط m3u8.');
            return;
          }
          const instance = new Hls({ enableWorker: true });
          hls = instance;
          instance.loadSource(src);
          instance.attachMedia(v);
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setError('تعذّر تحميل البث. تأكد من الرابط أو من السماح بـ CORS.');
          });
        })
        .catch(() => setError('تعذّر تحميل مكتبة التشغيل.'));
    } else {
      v.src = src;
    }

    return () => {
      cancelled = true;
      readyRef.current = false;
      hls?.destroy();
      v.pause();
      v.removeAttribute('src');
      v.load();
    };
  }, [src]);

  const handleLoadedMetadata = () => {
    readyRef.current = true;
    const v = videoRef.current;
    if (!v) return;
    const pending = pendingRef.current;
    pendingRef.current = null;
    const initial = startAtRef.current;
    startAtRef.current = null;
    if (pending) {
      applyNow(pending);
    } else if (initial) {
      applyNow({ action: initial.playing ? 'play' : 'pause', time: initial.time });
    }
  };

  const local = (action: PlaybackAction) => {
    const v = videoRef.current;
    if (!v) return;
    if (Date.now() < suppressUntil.current) return;
    onLocalRef.current(action, v.currentTime);
  };

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        className="h-full w-full"
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => {
          setBlocked(false);
          local('play');
        }}
        onPause={() => {
          if (videoRef.current?.ended) return;
          local('pause');
        }}
        onSeeked={() => local('seek')}
        onError={() => {
          if (!/\.m3u8(?=$|[?#&])/i.test(src)) {
            setError('تعذّر تشغيل هذا الرابط. قد يكون محمياً أو بصيغة غير مدعومة أو HTTP على موقع HTTPS.');
          }
        }}
      />

      {blocked && !error && (
        <button
          type="button"
          onClick={() => videoRef.current?.play().catch(() => undefined)}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-champagne-200 text-brand-purple shadow-glow">
            <Play className="h-8 w-8" />
          </span>
          <span className="text-sm font-semibold text-champagne-100">المتصفح منع التشغيل التلقائي — اضغط للتشغيل</span>
        </button>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/90 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-champagne-400" />
          <p className="max-w-md text-sm text-champagne-100/90">{error}</p>
        </div>
      )}
    </div>
  );
});

export default DirectPlayer;
