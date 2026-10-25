'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import type { PlaybackAction, PlaybackCommand, PlayerHandle, StartAt, SubtitleTrack } from '@/lib/types';

interface Props {
  /** مصادر الفيديو بالترتيب: الأول هو المفضل والباقي بدائل تُجرَّب عند الفشل */
  sources: string[];
  startAt: StartAt | null;
  subtitle: SubtitleTrack | null;
  onLocal: (action: PlaybackAction, time: number) => void;
}

const isHls = (src: string): boolean => /\.m3u8(?=$|[?#&])/i.test(src);

/** مشغل mp4 / webm / m3u8 (عبر hls.js) مع مزامنة كاملة */
const DirectPlayer = forwardRef<PlayerHandle, Props>(function DirectPlayer(
  { sources, startAt, subtitle, onLocal },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // حراس الأحداث: نتجاهل الأحداث التي سببناها نحن عند تطبيق أمر قادم من صديق (تمنع الصدى)
  const guards = useRef({ play: 0, pause: 0, seek: 0 });
  const readyRef = useRef(false);
  const pendingRef = useRef<PlaybackCommand | null>(null);
  const blockedRef = useRef<{ time: number; at: number } | null>(null);
  const startAtRef = useRef<StartAt | null>(startAt);
  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLocalRef = useRef(onLocal);
  onLocalRef.current = onLocal;

  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [subUrl, setSubUrl] = useState<string | null>(null);

  const src = sources[Math.min(idx, Math.max(0, sources.length - 1))] ?? '';

  const applyNow = useCallback((cmd: PlaybackCommand) => {
    const v = videoRef.current;
    if (!v) return;
    const now = Date.now();
    const g = guards.current;
    const elapsed = cmd.action === 'play' && cmd.at ? Math.max(0, now - cmd.at) / 1000 : 0;
    const target = Math.max(0, cmd.time + elapsed);
    const diff = Math.abs(v.currentTime - target);

    if (cmd.action === 'seek') {
      if (blockedRef.current) blockedRef.current = { time: target, at: now };
      if (diff > 0.25) {
        g.seek = now + 5000;
        v.currentTime = target;
      }
      return;
    }

    if (cmd.action === 'play') {
      if (diff > 1) {
        g.seek = now + 5000;
        v.currentTime = target;
      }
      if (v.paused) {
        g.play = now + 2500;
        v.play().then(
          () => {
            blockedRef.current = null;
            setBlocked(false);
          },
          (err: unknown) => {
            g.play = 0;
            if ((err as Error | undefined)?.name === 'NotAllowedError') {
              blockedRef.current = { time: target, at: now };
              setBlocked(true);
            }
          },
        );
      }
      return;
    }

    // pause
    blockedRef.current = null;
    setBlocked(false);
    if (diff > 0.5) {
      g.seek = now + 5000;
      v.currentTime = target;
    }
    if (!v.paused) {
      g.pause = now + 2500;
      v.pause();
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
      getTime: () => videoRef.current?.currentTime ?? 0,
      isPlaying: () => {
        const v = videoRef.current;
        return !!v && !v.paused && !v.ended;
      },
    }),
    [applyNow],
  );

  // تحميل المصدر الحالي (mp4 مباشرة أو HLS عبر hls.js)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    readyRef.current = false;
    setError(null);

    if (isHls(src) && !v.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            setError('المتصفح لا يدعم تشغيل روابط m3u8.');
            return;
          }
          const instance = new Hls({ enableWorker: true });
          hls = instance;
          let netRetries = 0;
          instance.loadSource(src);
          instance.attachMedia(v);
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < 3) {
              netRetries += 1;
              instance.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              instance.recoverMediaError();
            } else {
              setError('تعذّر تحميل البث. تأكد من الرابط أو من السماح بـ CORS.');
            }
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

  // الترجمة (محلية لكل شخص)
  useEffect(() => {
    if (!subtitle) {
      setSubUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([subtitle.vtt], { type: 'text/vtt' }));
    setSubUrl(url);
    // نؤخّر الإلغاء قليلاً كي لا يفشل تحميل مسار ترجمة ما زال قيد القراءة
    return () => {
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    };
  }, [subtitle]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !subUrl) return;
    const show = () => {
      for (const t of Array.from(v.textTracks)) t.mode = 'showing';
    };
    show();
    const timer = setTimeout(show, 150);
    return () => clearTimeout(timer);
  }, [subUrl]);

  useEffect(
    () => () => {
      if (seekTimer.current) clearTimeout(seekTimer.current);
    },
    [],
  );

  const handleLoadedMetadata = () => {
    readyRef.current = true;
    const pending = pendingRef.current;
    pendingRef.current = null;
    const initial = startAtRef.current;
    startAtRef.current = null;
    if (pending) {
      applyNow(pending);
    } else if (initial) {
      applyNow({ action: initial.playing ? 'play' : 'pause', time: initial.time, at: initial.at });
    }
  };

  const handleError = () => {
    const v = videoRef.current;
    if (!v || isHls(src)) return;
    if (!v.getAttribute('src')) return; // أُزيل المصدر عمداً
    if (idx < sources.length - 1) {
      // جرّب النسخة التالية (جودة/صيغة أخرى) مع الحفاظ على موضع التشغيل
      if (!pendingRef.current && !startAtRef.current) {
        startAtRef.current = { time: v.currentTime || 0, playing: !v.paused, at: Date.now() };
      }
      setIdx(idx + 1);
    } else {
      setError('تعذّر تشغيل هذا الفيديو. قد يكون محمياً أو بصيغة غير مدعومة، أو الرابط HTTP على موقع HTTPS.');
    }
  };

  const local = (action: PlaybackAction) => {
    const v = videoRef.current;
    if (!v) return;
    onLocalRef.current(action, v.currentTime);
  };

  const handlePlay = () => {
    setBlocked(false);
    const g = guards.current;
    if (Date.now() < g.play) {
      g.play = 0;
      return;
    }
    local('play');
  };

  const handlePause = () => {
    const v = videoRef.current;
    if (!v || v.ended) return;
    const g = guards.current;
    if (Date.now() < g.pause) {
      g.pause = 0;
      return;
    }
    local('pause');
  };

  const handleSeeked = () => {
    const g = guards.current;
    const now = Date.now();
    if (now < g.seek) {
      g.seek = now + 400;
      return;
    }
    // تأخير بسيط لدمج سلسلة القفزات أثناء سحب شريط التقدم
    if (seekTimer.current) clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(() => {
      seekTimer.current = null;
      local('seek');
    }, 250);
  };

  // المتصفح منع التشغيل التلقائي: عند الضغط نلحق بوقت الغرفة الحالي بدون إرسال أي أمر للآخرين
  const handleUnblock = () => {
    const v = videoRef.current;
    if (!v) return;
    const now = Date.now();
    const b = blockedRef.current;
    const g = guards.current;
    if (b) {
      const target = b.time + (now - b.at) / 1000;
      if (Math.abs(v.currentTime - target) > 1) {
        g.seek = now + 5000;
        v.currentTime = target;
      }
    }
    g.play = now + 2500;
    blockedRef.current = null;
    setBlocked(false);
    v.play().catch(() => {
      g.play = 0;
    });
  };

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        className="h-full w-full"
        controls
        playsInline
        preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        onError={handleError}
      >
        {subUrl && (
          <track
            key={subUrl}
            kind="subtitles"
            srcLang="ar"
            label={subtitle?.label ?? 'ترجمة'}
            src={subUrl}
            default
          />
        )}
      </video>

      {blocked && !error && (
        <button
          type="button"
          onClick={handleUnblock}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-champagne-200 text-brand-purple shadow-glow">
            <Play className="h-8 w-8" />
          </span>
          <span className="text-sm font-semibold text-champagne-100">
            المتصفح منع التشغيل التلقائي — اضغط للانضمام إلى مشهد أصدقائك
          </span>
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
