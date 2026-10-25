'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  RefreshCw,
  ScreenShare,
  ScreenShareOff,
  Server,
  Shield,
  ShieldOff,
  Timer,
} from 'lucide-react';
import Chat from '@/components/Chat';
import CustomUrlBox from '@/components/CustomUrlBox';
import LibraryModal from '@/components/LibraryModal';
import NamePrompt from '@/components/NamePrompt';
import PartsPicker from '@/components/PartsPicker';
import RoomHeader from '@/components/RoomHeader';
import RoomStage from '@/components/RoomStage';
import SeriesPicker from '@/components/SeriesPicker';
import SubtitleControl from '@/components/SubtitleControl';
import { useRoom } from '@/hooks/useRoom';
import { buildArchiveMedia, type ArchiveResolved } from '@/lib/library/archive';
import { mediaKey, mediaTitle, type ParsedUrl } from '@/lib/media';
import { SERVERS } from '@/lib/servers';
import { cuesToVtt, decodeSubtitleBytes, parseSubtitles, type Cue } from '@/lib/subtitles';
import type {
  CatalogItem,
  Episode,
  Media,
  MediaVariant,
  PlaybackAction,
  PlayerHandle,
  StartAt,
  SubtitleTrack,
} from '@/lib/types';
import { CLIENT_KEY, NAME_KEY, cn, randomId, readStorage, writeStorage } from '@/lib/utils';

interface Identity {
  name: string | null;
  clientId: string;
}

const NO_VARIANTS: MediaVariant[] = [];

export default function RoomClient({ roomId }: { roomId: string }) {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    let clientId = '';
    try {
      clientId = window.sessionStorage.getItem(CLIENT_KEY) ?? '';
      if (!clientId) {
        clientId = randomId();
        window.sessionStorage.setItem(CLIENT_KEY, clientId);
      }
    } catch {
      clientId = randomId();
    }
    setIdentity({ name: readStorage(NAME_KEY), clientId });
  }, []);

  if (!identity) {
    return <div className="min-h-screen" aria-busy="true" />;
  }

  if (!identity.name) {
    return (
      <NamePrompt
        roomId={roomId}
        onSubmit={(name) => {
          writeStorage(NAME_KEY, name);
          setIdentity({ ...identity, name });
        }}
      />
    );
  }

  return <RoomView roomId={roomId} name={identity.name} clientId={identity.clientId} />;
}

interface SubtitleState {
  name: string;
  cues: Cue[];
  offset: number;
}

function RoomView({ roomId, name, clientId }: { roomId: string; name: string; clientId: string }) {
  const playerRef = useRef<PlayerHandle>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [canShare, setCanShare] = useState(false);
  // اختيار الجودة محلي لكل شخص (لا يُرسل للآخرين) ومرتبط بالرابط الذي اختير له
  const [variantSel, setVariantSel] = useState<{ forUrl: string; idx: number } | null>(null);
  const [localStart, setLocalStart] = useState<{ forUrl: string; start: StartAt } | null>(null);
  const [subtitle, setSubtitle] = useState<SubtitleState | null>(null);
  const [subError, setSubError] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const room = useRoom({
    roomId,
    clientId,
    name,
    onPlayback: (cmd) => playerRef.current?.apply(cmd),
    onSync: (time, playing) =>
      playerRef.current?.apply({ action: playing ? 'play' : 'pause', time, at: Date.now() }),
    getPlayerState: () => ({
      time: playerRef.current?.getTime() ?? 0,
      playing: playerRef.current?.isPlaying() ?? false,
    }),
  });

  const { media, changeMedia, sendPlayback, sendSync, startCountdown } = room;
  const key = mediaKey(media);

  const flash = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 6000);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  useEffect(() => {
    setCanShare(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getDisplayMedia === 'function',
    );
  }, []);

  useEffect(() => {
    document.title = media ? `${mediaTitle(media)} · ${roomId} | BRO TV` : `${roomId} | BRO TV`;
  }, [media, roomId]);

  // الترجمة خاصة بالملف: تُمسح عند تغيير الفيديو
  useEffect(() => {
    setSubtitle(null);
    setSubError('');
  }, [key]);

  const handleLocal = useCallback(
    (action: PlaybackAction, time: number) => sendPlayback(action, time),
    [sendPlayback],
  );

  /* ------------------------------ اختيار المحتوى ------------------------------ */

  const pickArchive = (resolved: ArchiveResolved) => {
    changeMedia(buildArchiveMedia(resolved, resolved.defaultPart), 'select');
    setLibraryOpen(false);
  };

  const pickPart = (resolved: ArchiveResolved, index: number) => {
    changeMedia(buildArchiveMedia(resolved, index), 'episode');
  };

  const selectCatalog = (item: CatalogItem) => {
    const next: Media = {
      kind: 'catalog',
      type: item.type,
      imdbId: item.imdbId,
      title: item.name,
      poster: item.poster,
      season: item.type === 'series' ? 1 : undefined,
      episode: item.type === 'series' ? 1 : undefined,
      server: 0,
      sandbox: false,
    };
    changeMedia(next, 'select');
    setLibraryOpen(false);
  };

  const pickEpisode = (ep: Episode) => {
    if (!media) return;
    changeMedia({ ...media, season: ep.season, episode: ep.episode, episodeTitle: ep.title }, 'episode');
  };

  const changeServer = (index: number) => {
    if (!media || media.server === index) return;
    changeMedia({ ...media, server: index }, 'server');
  };

  const toggleSandbox = () => {
    if (!media) return;
    changeMedia({ ...media, sandbox: !media.sandbox }, 'sandbox');
  };

  const playCustom = (parsed: ParsedUrl) => {
    const next: Media = {
      kind: parsed.kind,
      source: 'link',
      title: parsed.kind === 'youtube' ? 'فيديو YouTube' : parsed.host,
      url: parsed.url,
      videoId: parsed.videoId,
      sandbox: parsed.kind === 'iframe',
    };
    changeMedia(next, 'custom');
  };

  /* ---------------------------------- الجودة ---------------------------------- */

  const variants = useMemo(() => media?.variants ?? NO_VARIANTS, [media]);
  const defaultIdx = Math.max(
    0,
    variants.findIndex((v) => v.url === media?.url),
  );
  const selIdx = media && variantSel && variantSel.forUrl === media.url ? variantSel.idx : defaultIdx;

  const sources = useMemo(() => {
    if (!media || media.kind !== 'direct' || !media.url) return [] as string[];
    if (variants.length < 2) return [media.url];
    const chosen = variants[selIdx] ?? variants[0];
    return [chosen.url, ...variants.filter((v) => v.url !== chosen.url).map((v) => v.url)];
  }, [media, variants, selIdx]);

  const changeQuality = (i: number) => {
    if (!media?.url || i === selIdx) return;
    const h = playerRef.current;
    setLocalStart(
      h ? { forUrl: media.url, start: { time: h.getTime(), playing: h.isPlaying(), at: Date.now() } } : null,
    );
    setVariantSel({ forUrl: media.url, idx: i });
  };

  const startAt: StartAt | null =
    localStart && media && localStart.forUrl === media.url ? localStart.start : room.startAt;

  /* ---------------------------------- الترجمة ---------------------------------- */

  const subtitleTrack = useMemo<SubtitleTrack | null>(
    () => (subtitle ? { label: subtitle.name, vtt: cuesToVtt(subtitle.cues, subtitle.offset) } : null),
    [subtitle],
  );

  const loadSubtitle = async (file: File) => {
    setSubError('');
    if (file.size > 3 * 1024 * 1024) {
      setSubError('الملف كبير جداً (الحد الأقصى 3 ميغابايت).');
      return;
    }
    try {
      const text = decodeSubtitleBytes(await file.arrayBuffer());
      const cues = parseSubtitles(text);
      if (cues.length === 0) {
        setSubError('لم أستطع قراءة هذا الملف. تأكد أنه بصيغة SRT أو VTT.');
        return;
      }
      setSubtitle({ name: file.name, cues, offset: 0 });
    } catch {
      setSubError('تعذّر قراءة الملف.');
    }
  };

  const shiftSubtitle = (delta: number) => {
    setSubtitle((s) => (s ? { ...s, offset: Math.round((s.offset + delta) * 10) / 10 } : s));
  };

  /* --------------------------------- بث الشاشة --------------------------------- */

  const toggleShare = async () => {
    if (room.sharing) {
      room.stopShare();
      return;
    }
    try {
      await room.startShare();
    } catch (e) {
      const err = e as Error;
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') return; // ألغى المستخدم الاختيار
      flash(
        err.message === 'unsupported'
          ? 'متصفحك لا يدعم بث الشاشة. استخدم Chrome أو Edge على الكمبيوتر.'
          : 'تعذّر بدء بث الشاشة. حاول مرة أخرى.',
      );
    }
  };

  const syncScene = () => {
    if (!media) return;
    if (media.kind === 'direct' || media.kind === 'youtube') {
      sendSync(playerRef.current?.getTime() ?? 0, playerRef.current?.isPlaying() ?? false);
    } else if (media.kind !== 'screen') {
      // المشغلات المضمّنة (iframe) لا يمكن التحكم بها — نستخدم عدّاً تنازلياً مشتركاً
      startCountdown();
    }
  };

  const isEmbed = media?.kind === 'catalog' || media?.kind === 'iframe';
  const autoSync = media?.kind === 'direct' || media?.kind === 'youtube' || media?.kind === 'screen';

  return (
    <div className="flex min-h-screen flex-col">
      <RoomHeader roomId={roomId} members={room.members} status={room.status} selfId={clientId} />

      <main className="mx-auto w-full max-w-[1600px] flex-1 p-3 sm:p-4 lg:p-6">
        {room.status === 'unconfigured' && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-champagne-400/30 bg-champagne-400/10 p-4 text-sm text-champagne-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-champagne-400" />
            <p>
              Supabase غير مضبوط، لذلك لن تتم المزامنة مع الآخرين. أضف{' '}
              <code dir="ltr">NEXT_PUBLIC_SUPABASE_URL</code> و <code dir="ltr">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> في{' '}
              <code dir="ltr">.env.local</code> وأعد تشغيل الموقع.
            </p>
          </div>
        )}
        {room.status === 'error' && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-300/30 bg-red-300/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>تعذّر الاتصال بخادم المزامنة. تحقق من بيانات Supabase ومن أن Realtime مفعّل، ثم حدّث الصفحة.</p>
          </div>
        )}

        {/* الشبكة: المشغل يسار/أعلى — الدردشة يمين/أسفل */}
        <div dir="ltr" className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section dir="rtl" className="min-w-0 space-y-4">
            <RoomStage
              media={media}
              clientId={clientId}
              sources={sources}
              playerKey={`${media?.url ?? ''}|${selIdx}`}
              startAt={startAt}
              subtitle={subtitleTrack}
              playerRef={playerRef}
              reactions={room.reactions}
              countdown={room.countdown}
              remoteStream={room.remoteStream}
              viewerState={room.viewerState}
              viewerCount={room.viewerCount}
              onLocal={handleLocal}
              onOpenLibrary={() => setLibraryOpen(true)}
              onStopShare={room.stopShare}
              onRetryWatch={room.retryWatch}
              onCloseScreen={() => room.clearMedia('stop')}
            />

            {/* شريط المعلومات والتحكم */}
            <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-xs text-champagne-200/55">
                  يُعرض الآن
                  {media && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                        autoSync ? 'bg-emerald-300/15 text-emerald-300' : 'bg-amber-300/15 text-amber-300',
                      )}
                    >
                      {autoSync ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          مزامنة تلقائية كاملة
                        </>
                      ) : (
                        <>
                          <Timer className="h-3 w-3" />
                          مزامنة يدوية — أو استخدم بث الشاشة
                        </>
                      )}
                    </span>
                  )}
                </p>
                <h1 dir="auto" className="truncate text-lg font-extrabold text-champagne-100">
                  {media ? mediaTitle(media) : '—'}
                  {media?.type === 'series' && (
                    <span className="ms-2 text-sm font-semibold text-champagne-300">
                      · موسم {media.season} حلقة {media.episode}
                    </span>
                  )}
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary px-4 py-2.5 text-sm" onClick={() => setLibraryOpen(true)}>
                  <Clapperboard className="h-4 w-4" />
                  المكتبة والبحث
                </button>
                {canShare && (
                  <button
                    type="button"
                    className={cn('btn-ghost', room.sharing && 'border-red-300/40 text-red-200')}
                    onClick={toggleShare}
                  >
                    {room.sharing ? <ScreenShareOff className="h-4 w-4" /> : <ScreenShare className="h-4 w-4" />}
                    {room.sharing ? 'إيقاف بث الشاشة' : 'بث الشاشة'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={syncScene}
                  disabled={!media || media.kind === 'screen'}
                >
                  {isEmbed ? <Timer className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                  مزامنة المشهد مع صديقي
                </button>
              </div>
            </div>

            {notice && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {notice}
              </div>
            )}

            {/* الجودة (محلية لكل شخص) */}
            {media?.kind === 'direct' && variants.length > 1 && (
              <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-4">
                <p className="me-2 text-sm font-bold text-champagne-100">
                  جودة التشغيل
                  <span className="ms-2 text-xs font-normal text-champagne-200/55">(اختيارك لا يؤثر على الآخرين)</span>
                </p>
                {variants.map((v, i) => (
                  <button
                    key={v.url}
                    type="button"
                    onClick={() => changeQuality(i)}
                    className={cn('btn-chip', i === selIdx && 'btn-chip-active')}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}

            {/* السيرفرات + Sandbox */}
            {isEmbed && media && (
              <div className="glass space-y-3 rounded-2xl p-4">
                {media.kind === 'catalog' && (
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold text-champagne-100">
                      <Server className="h-4 w-4 text-champagne-300" />
                      سيرفرات المشاهدة
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SERVERS.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => changeServer(i)}
                          className={cn('btn-chip', (media.server ?? 0) === i && 'btn-chip-active')}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={toggleSandbox} className={cn('btn-chip', media.sandbox && 'btn-chip-active')}>
                    {media.sandbox ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                    Sandbox: {media.sandbox ? 'مفعّل' : 'متوقف'}
                  </button>
                  <p className="text-xs leading-relaxed text-champagne-200/55">
                    هذه السيرفرات تعمل داخل iframe خارجي ولا يمكن التحكم بتشغيلها من الموقع. للمزامنة الكاملة: افتح الفيلم في
                    تبويب آخر واضغط «بث الشاشة»، أو استخدم «مزامنة المشهد» للعدّ التنازلي. إذا لم يعمل الفيديو جرّب سيرفراً
                    آخر أو أوقف الـ Sandbox.
                  </p>
                </div>
              </div>
            )}

            {media?.kind === 'catalog' && media.type === 'series' && <SeriesPicker media={media} onPick={pickEpisode} />}

            {media?.source === 'archive' && <PartsPicker media={media} onPick={pickPart} />}

            {media?.kind === 'direct' && (
              <SubtitleControl
                name={subtitle?.name ?? null}
                offset={subtitle?.offset ?? 0}
                error={subError}
                onFile={loadSubtitle}
                onShift={shiftSubtitle}
                onClear={() => setSubtitle(null)}
              />
            )}

            <CustomUrlBox onPlay={playCustom} />
          </section>

          <aside dir="rtl" className="h-[520px] min-h-0 min-w-0 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
            <Chat
              messages={room.messages}
              selfId={clientId}
              onSend={room.sendChat}
              onReaction={room.sendReaction}
            />
          </aside>
        </div>
      </main>

      <LibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPickArchive={pickArchive}
        onPickCatalog={selectCatalog}
      />
    </div>
  );
}
