'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clapperboard, RefreshCw, Server, Shield, ShieldOff, Timer } from 'lucide-react';
import Chat from '@/components/Chat';
import CustomUrlBox from '@/components/CustomUrlBox';
import NamePrompt from '@/components/NamePrompt';
import RoomHeader from '@/components/RoomHeader';
import RoomStage from '@/components/RoomStage';
import SearchModal from '@/components/SearchModal';
import SeriesPicker from '@/components/SeriesPicker';
import { useRoom } from '@/hooks/useRoom';
import type { ParsedUrl } from '@/lib/media';
import { SERVERS } from '@/lib/servers';
import type { CatalogItem, Episode, Media, PlaybackAction, PlayerHandle } from '@/lib/types';
import { CLIENT_KEY, NAME_KEY, cn, randomId, readStorage, writeStorage } from '@/lib/utils';

interface Identity {
  name: string | null;
  clientId: string;
}

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

  const isOwner = readStorage(`brotv:owner:${roomId}`) === identity.clientId;
  return <RoomView roomId={roomId} name={identity.name} clientId={identity.clientId} isOwner={isOwner} />;
}

function RoomView({ roomId, name, clientId, isOwner }: { roomId: string; name: string; clientId: string; isOwner: boolean }) {
  const playerRef = useRef<PlayerHandle>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const room = useRoom({
    roomId,
    clientId,
    name,
    isOwner,
    onPlayback: (cmd) => playerRef.current?.apply(cmd),
    onSync: (time, playing) => playerRef.current?.apply({ action: playing ? 'play' : 'pause', time }),
    getPlayerState: () => ({
      time: playerRef.current?.getTime() ?? 0,
      playing: playerRef.current?.isPlaying() ?? false,
    }),
  });

  const { media, changeMedia, sendPlayback, startCountdown } = room;

  useEffect(() => {
    document.title = media ? `${media.title} · ${roomId} | BRO TV` : `${roomId} | BRO TV`;
  }, [media, roomId]);

  const handleLocal = useCallback(
    (action: PlaybackAction, time: number) => sendPlayback(action, time),
    [sendPlayback],
  );

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
    setSearchOpen(false);
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
      title: parsed.kind === 'youtube' ? 'فيديو YouTube' : parsed.host,
      url: parsed.url,
      videoId: parsed.videoId,
      sandbox: parsed.kind === 'iframe',
    };
    changeMedia(next, 'custom');
  };

  const syncScene = () => {
    if (!media || !isOwner) return;
    // العدّ التنازلي موحّد لكل أنواع المشغلات، ثم يرسل أمراً بالتشغيل تلقائياً.
    startCountdown();
  };

  const isEmbed = media?.kind === 'catalog' || media?.kind === 'iframe';

  return (
    <div className="flex min-h-screen flex-col">
      <RoomHeader roomId={roomId} members={room.members} status={room.status} selfId={clientId} />

      <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-2 py-3 sm:p-4 lg:p-6">
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
        <div dir="ltr" className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section dir="rtl" className="min-w-0 space-y-3 sm:space-y-4">
            <RoomStage
              media={media}
              startAt={room.startAt}
              playerRef={playerRef}
              reactions={room.reactions}
              countdown={room.countdown}
              isOwner={isOwner}
              onLocal={handleLocal}
              onOpenSearch={() => setSearchOpen(true)}
            />

            {/* شريط المعلومات والتحكم */}
            <div className="glass flex min-w-0 flex-col items-stretch gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
              <div className="min-w-0">
                <p className="text-xs text-champagne-200/55">يُعرض الآن</p>
                <h1 dir="auto" className="break-words text-base font-extrabold text-champagne-100 sm:truncate sm:text-lg">
                  {media ? media.title : '—'}
                  {media?.type === 'series' && (
                    <span className="ms-2 text-sm font-semibold text-champagne-300">
                      · موسم {media.season} حلقة {media.episode}
                    </span>
                  )}
                </h1>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                <button type="button" className="btn-primary w-full px-4 py-2.5 text-sm sm:w-auto" onClick={() => setSearchOpen(true)}>
                  <Clapperboard className="h-4 w-4" />
                  المكتبة والبحث
                </button>
                <button type="button" className="btn-ghost w-full sm:w-auto" onClick={syncScene} disabled={!media || !isOwner}>
                  {media && (media.kind === 'catalog' || media.kind === 'iframe') ? (
                    <Timer className="h-4 w-4" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  مزامنة المشهد مع صديقي
                </button>
              </div>
            </div>

            {/* السيرفرات + Sandbox */}
            {isEmbed && media && (
              <div className="glass min-w-0 space-y-3 rounded-2xl p-3 sm:p-4">
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

                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <button type="button" onClick={toggleSandbox} className={cn('btn-chip', media.sandbox && 'btn-chip-active')}>
                    {media.sandbox ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                    Sandbox: {media.sandbox ? 'مفعّل' : 'متوقف'}
                  </button>
                  <p className="text-xs leading-relaxed text-champagne-200/55">
                    إذا لم يعمل الفيديو جرّب سيرفراً آخر، أو أوقف الـ Sandbox (بعض المشغلات ترفضه). التشغيل داخل الـ iframe
                    يتم يدوياً عند كل شخص — استخدم «مزامنة المشهد» للعدّ التنازلي.
                  </p>
                </div>
              </div>
            )}

            {media?.kind === 'catalog' && media.type === 'series' && <SeriesPicker media={media} onPick={pickEpisode} />}

            <CustomUrlBox onPlay={playCustom} />
          </section>

          <aside dir="rtl" className="h-[420px] min-h-0 min-w-0 sm:h-[480px] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
            <Chat
              messages={room.messages}
              selfId={clientId}
              onSend={room.sendChat}
              onReaction={room.sendReaction}
            />
          </aside>
        </div>
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={selectCatalog} />
    </div>
  );
}
