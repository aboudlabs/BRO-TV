'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Volume2, X } from 'lucide-react';
import type { ViewerState } from '@/lib/rtc';

interface Props {
  stream: MediaStream | null;
  state: ViewerState;
  hostName?: string;
  onRetry: () => void;
  onClose: () => void;
}

/** يعرض بث شاشة صديقك (WebRTC) */
export default function ScreenViewer({ stream, state, hostName, onRetry, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsSound, setNeedsSound] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
    if (!stream) return;
    v.muted = false;
    v.play().then(
      () => setNeedsSound(false),
      () => {
        // المتصفح يمنع الصوت التلقائي: نبدأ صامتاً ونعرض زر تفعيل الصوت
        v.muted = true;
        v.play().catch(() => undefined);
        setNeedsSound(true);
      },
    );
  }, [stream]);

  const enableSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => undefined);
    setNeedsSound(false);
  };

  const waiting = !stream && state !== 'failed';

  return (
    <div className="relative h-full w-full bg-black">
      <video ref={videoRef} className="h-full w-full object-contain" autoPlay playsInline controls />

      {waiting && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/85 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-champagne-200" />
          <p className="text-sm font-semibold text-champagne-100">
            جارٍ الاتصال ببث {hostName ? `«${hostName}»` : 'الشاشة'}…
          </p>
        </div>
      )}

      {state === 'failed' && !stream && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/90 p-6 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-champagne-100">
            تعذّر الاتصال بالبث. قد يكون صاحبه أنهاه أو أن شبكتك تمنع الاتصال المباشر (جرّب شبكة أخرى أو أضف خادم TURN).
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              إعادة المحاولة
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              <X className="h-4 w-4" />
              إغلاق العرض
            </button>
          </div>
        </div>
      )}

      {needsSound && stream && (
        <button
          type="button"
          onClick={enableSound}
          className="absolute start-3 top-3 z-20 inline-flex items-center gap-2 rounded-xl bg-champagne-200 px-3 py-2 text-sm font-bold text-brand-purple shadow-glow"
        >
          <Volume2 className="h-4 w-4" />
          اضغط لتفعيل الصوت
        </button>
      )}
    </div>
  );
}
