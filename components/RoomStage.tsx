'use client';

import type { RefObject } from 'react';
import { Search } from 'lucide-react';
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
  onOpenSearch: () => void;
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
  onOpenSearch,
}: Props) {
  const embedUrl = media ? buildEmbedUrl(media) : null;

  return (
    <div className="glass relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-glow">
      {!media && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <LogoMark size={88} className="!rounded-3xl opacity-90" />
          <div>
            <p className="text-lg font-extrabold text-champagne-100">لا يوجد شيء يُعرض بعد</p>
            <p className="mt-1 text-sm text-champagne-200/60">اختر فيلماً أو مسلسلاً، أو الصق رابطاً — وسيظهر عند الجميع فوراً.</p>
          </div>
          <button type="button" onClick={onOpenSearch} className="btn-primary">
            <Search className="h-4 w-4" />
            ابحث في المكتبة
          </button>
        </div>
      )}

      {media?.kind === 'direct' && media.url && (
        <DirectPlayer key={media.url} ref={playerRef} src={media.url} startAt={startAt} onLocal={onLocal} controls={isOwner} />
      )}

      {media?.kind === 'youtube' && media.videoId && (
        <YouTubePlayer key={media.videoId} ref={playerRef} videoId={media.videoId} startAt={startAt} onLocal={onLocal} controls={isOwner} />
      )}

      {media?.kind === 'catalog' && embedUrl && (
        <div className={isOwner ? 'h-full w-full' : 'pointer-events-none h-full w-full'}><EmbedPlayer src={embedUrl} title={media.title} sandbox={media.sandbox} /></div>
      )}

      {media?.kind === 'iframe' && media.url && (
        <div className={isOwner ? 'h-full w-full' : 'pointer-events-none h-full w-full'}><EmbedPlayer src={media.url} title={media.title} sandbox={media.sandbox} /></div>
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
          <span key={countdown} className="animate-pop text-8xl font-black text-champagne-200 sm:text-9xl">
            {countdown > 0 ? countdown : '▶'}
          </span>
          <span className="mt-3 text-lg font-bold text-champagne-100">
            {countdown > 0 ? 'استعدّوا… اضغطوا تشغيل عند الصفر' : 'شغّل الآن!'}
          </span>
        </div>
      )}
    </div>
  );
}
