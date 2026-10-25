'use client';

import type { RefObject } from 'react';
import { ScreenShare, Search } from 'lucide-react';
import DirectPlayer from '@/components/player/DirectPlayer';
import EmbedPlayer from '@/components/player/EmbedPlayer';
import YouTubePlayer from '@/components/player/YouTubePlayer';
import ScreenViewer from '@/components/ScreenViewer';
import { LogoMark } from '@/components/Logo';
import type { ViewerState } from '@/lib/rtc';
import { buildEmbedUrl } from '@/lib/servers';
import type {
  FloatingReaction,
  Media,
  PlaybackAction,
  PlayerHandle,
  StartAt,
  SubtitleTrack,
} from '@/lib/types';

interface Props {
  media: Media | null;
  clientId: string;
  /** مصادر الفيديو المباشر مرتبة (المفضل أولاً) */
  sources: string[];
  /** مفتاح يعيد بناء المشغل عند تغيّر الملف أو الجودة */
  playerKey: string;
  startAt: StartAt | null;
  subtitle: SubtitleTrack | null;
  playerRef: RefObject<PlayerHandle>;
  reactions: FloatingReaction[];
  countdown: number | null;
  remoteStream: MediaStream | null;
  viewerState: ViewerState;
  viewerCount: number;
  onLocal: (action: PlaybackAction, time: number) => void;
  onOpenLibrary: () => void;
  onStopShare: () => void;
  onRetryWatch: () => void;
  onCloseScreen: () => void;
}

/** شاشة العرض: المشغل المناسب + التفاعلات الطائرة + العدّ التنازلي */
export default function RoomStage({
  media,
  clientId,
  sources,
  playerKey,
  startAt,
  subtitle,
  playerRef,
  reactions,
  countdown,
  remoteStream,
  viewerState,
  viewerCount,
  onLocal,
  onOpenLibrary,
  onStopShare,
  onRetryWatch,
  onCloseScreen,
}: Props) {
  const embedUrl = media ? buildEmbedUrl(media) : null;
  const isHost = media?.kind === 'screen' && media.hostId === clientId;

  return (
    <div className="glass relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-glow">
      {!media && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <LogoMark size={88} className="!rounded-3xl opacity-90" />
          <div>
            <p className="text-lg font-extrabold text-champagne-100">لا يوجد شيء يُعرض بعد</p>
            <p className="mt-1 text-sm text-champagne-200/60">
              اختر فيلماً من المكتبة، أو الصق رابطاً، أو ابدأ بث شاشتك — وسيظهر عند الجميع فوراً.
            </p>
          </div>
          <button type="button" onClick={onOpenLibrary} className="btn-primary">
            <Search className="h-4 w-4" />
            افتح المكتبة
          </button>
        </div>
      )}

      {media?.kind === 'direct' && sources.length > 0 && (
        <DirectPlayer
          key={playerKey}
          ref={playerRef}
          sources={sources}
          startAt={startAt}
          subtitle={subtitle}
          onLocal={onLocal}
        />
      )}

      {media?.kind === 'youtube' && media.videoId && (
        <YouTubePlayer key={media.videoId} ref={playerRef} videoId={media.videoId} startAt={startAt} onLocal={onLocal} />
      )}

      {media?.kind === 'catalog' && embedUrl && (
        <EmbedPlayer src={embedUrl} title={media.title} sandbox={media.sandbox} />
      )}

      {media?.kind === 'iframe' && media.url && (
        <EmbedPlayer src={media.url} title={media.title} sandbox={media.sandbox} />
      )}

      {media?.kind === 'screen' && !isHost && (
        <ScreenViewer
          key={media.hostId}
          stream={remoteStream}
          state={viewerState}
          hostName={media.hostName}
          onRetry={onRetryWatch}
          onClose={onCloseScreen}
        />
      )}

      {isHost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-400/15">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-400/20" />
            <ScreenShare className="relative h-8 w-8 text-red-300" />
          </span>
          <p className="text-lg font-extrabold text-champagne-100">أنت تبثّ شاشتك الآن</p>
          <p className="max-w-md text-sm leading-relaxed text-champagne-200/70">
            {viewerCount > 0 ? `${viewerCount} مشاهد متصل.` : 'بانتظار اتصال المشاهدين…'} شغّل الفيديو في التبويب أو
            النافذة التي اخترتها وسيراه الجميع بنفس اللحظة. لا تفتح هذه الصفحة نفسها في البث لتفادي المرآة اللانهائية.
          </p>
          <button type="button" onClick={onStopShare} className="btn-ghost">
            إيقاف البث
          </button>
        </div>
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
