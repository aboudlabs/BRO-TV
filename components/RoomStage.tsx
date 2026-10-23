'use client';

import type { RefObject } from 'react';
import DirectPlayer from '@/components/player/DirectPlayer';
import EmbedPlayer from '@/components/player/EmbedPlayer';
import YouTubePlayer from '@/components/player/YouTubePlayer';
import { LogoMark } from '@/components/Logo';
import { buildEmbedUrl } from '@/lib/servers';
import type { FloatingReaction, Media, PlaybackAction, PlayerHandle, StartAt } from '@/lib/types';

interface Props {
  media: Media | null;
  startAt: StartAt | null;
  playerRef: RefObject<PlayerHandle>;
  reactions: FloatingReaction[];
  countdown: number | null;
  isOwner: boolean;
  onLocal: (action: PlaybackAction, time: number) => void;
}

/** شاشة العرض: المشغل المناسب + التفاعلات الطائرة + العدّ التنازلي */
export default function RoomStage({
  media,
  startAt,
  playerRef,
  reactions,
  countdown,
  isOwner,
  onLocal,
}: Props) {
  const embedUrl = media ? buildEmbedUrl(media) : null;

  return (
    <div className="glass relative aspect-video w-full min-w-0 overflow-hidden rounded-xl bg-black shadow-glow sm:rounded-2xl">
      {!media && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center sm:gap-4 sm:p-6">
          <LogoMark size={72} className="!h-14 !w-14 !rounded-2xl opacity-90 sm:!h-20 sm:!w-20 sm:!rounded-3xl" />
          <div className="max-w-xl">
            <p className="text-base font-extrabold text-champagne-100 sm:text-lg">لا يوجد شيء يُعرض بعد</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-champagne-200/60 sm:text-sm">
              اختر فيلماً أو مسلسلاً، أو الصق رابطاً — وسيظهر عند الجميع فوراً.
            </p>
          </div>
        </div>
      )}

      {media?.kind === 'direct' && media.url && (
        <DirectPlayer key={media.url} ref={playerRef} src={media.url} startAt={startAt} onLocal={onLocal} controls={isOwner} />
      )}

      {media?.kind === 'youtube' && media.videoId && (
        <YouTubePlayer key={media.videoId} ref={playerRef} videoId={media.videoId} startAt={startAt} onLocal={onLocal} controls={isOwner} />
      )}

      {media?.kind === 'catalog' && embedUrl && (
        <div className="h-full w-full"><EmbedPlayer src={embedUrl} title={media.title} sandbox={media.sandbox} /></div>
      )}

      {media?.kind === 'iframe' && media.url && (
        <div className="h-full w-full"><EmbedPlayer src={media.url} title={media.title} sandbox={media.sandbox} /></div>
      )}

      {/* تفاعلات طائرة */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-6 flex animate-float-up flex-col items-center"
            style={{ left: `${r.left}%` }}
          >
            <span className="text-4xl drop-shadow-lg sm:text-5xl">{r.emoji}</span>
            <span className="mt-1 rounded-full bg-ink-950/70 px-2 py-0.5 text-[10px] font-bold text-champagne-100">
              {r.name}
            </span>
          </div>
        ))}
      </div>

      {/* العدّ التنازلي للمزامنة */}
      {countdown !== null && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-ink-950/65 backdrop-blur-sm">
          <span key={countdown} className="animate-pop text-7xl font-black text-champagne-200 sm:text-9xl">
            {countdown > 0 ? countdown : '▶'}
          </span>
          <span className="mt-3 px-4 text-center text-sm font-bold text-champagne-100 sm:text-lg">
            {countdown > 0 ? 'استعدّوا… عند الصفر اضغطوا تشغيل إذا طلب السيرفر ذلك' : 'انتهى العدّ التنازلي — اضغط تشغيل داخل المشغّل عند الحاجة'}
          </span>
        </div>
      )}
    </div>
  );
}
