'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getSeriesMeta } from '@/lib/cinemeta';
import type { Episode, Media, SeriesMeta } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  media: Media;
  onPick: (episode: Episode) => void;
}

/** محدد المواسم والحلقات للمسلسلات */
export default function SeriesPicker({ media, onPick }: Props) {
  const [meta, setMeta] = useState<SeriesMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [viewSeason, setViewSeason] = useState(media.season ?? 1);

  const imdbId = media.imdbId;

  useEffect(() => {
    if (!imdbId) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    getSeriesMeta(imdbId, controller.signal)
      .then((m) => setMeta(m))
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [imdbId]);

  // عندما يغيّر صديقك الحلقة، ينتقل العرض لموسمها
  useEffect(() => {
    if (media.season) setViewSeason(media.season);
  }, [media.season]);

  const seasons = useMemo(() => {
    const set = new Set<number>();
    meta?.episodes.forEach((e) => set.add(e.season));
    return Array.from(set).sort((a, b) => a - b);
  }, [meta]);

  const episodes = useMemo(() => meta?.episodes.filter((e) => e.season === viewSeason) ?? [], [meta, viewSeason]);

  const flat = meta?.episodes ?? [];
  const currentIndex = flat.findIndex((e) => e.season === media.season && e.episode === media.episode);
  const prev = currentIndex > 0 ? flat[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null;

  if (loading) {
    return (
      <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-champagne-200/70">
        <Loader2 className="h-4 w-4 animate-spin" />
        جارٍ تحميل المواسم والحلقات…
      </div>
    );
  }

  if (failed || !meta || flat.length === 0) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-champagne-200/70">
        تعذّر جلب قائمة الحلقات لهذا المسلسل. يمكنك المتابعة بالحلقة الحالية.
      </div>
    );
  }

  return (
    <div className="glass space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-champagne-100">
          المواسم والحلقات
          <span className="ms-2 text-xs font-normal text-champagne-200/60">
            الحالية: موسم {media.season} · حلقة {media.episode}
          </span>
        </h3>
        <div className="flex gap-2">
          <button type="button" className="btn-chip" disabled={!prev} onClick={() => prev && onPick(prev)}>
            <ChevronRight className="h-4 w-4" />
            السابقة
          </button>
          <button type="button" className="btn-chip" disabled={!next} onClick={() => next && onPick(next)}>
            التالية
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {seasons.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setViewSeason(s)}
            className={cn('btn-chip shrink-0', s === viewSeason && 'btn-chip-active')}
          >
            موسم {s}
          </button>
        ))}
      </div>

      <div className="grid max-h-44 grid-cols-5 gap-1.5 overflow-y-auto pe-1 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-12">
        {episodes.map((ep) => {
          const active = ep.season === media.season && ep.episode === media.episode;
          return (
            <button
              key={`${ep.season}-${ep.episode}`}
              type="button"
              title={ep.title}
              onClick={() => onPick(ep)}
              className={cn(
                'rounded-lg border py-1.5 text-sm font-bold transition',
                active
                  ? 'border-champagne-200 bg-champagne-200 text-brand-purple'
                  : 'border-white/10 bg-white/5 text-champagne-100 hover:bg-white/10',
              )}
            >
              {ep.episode}
            </button>
          );
        })}
      </div>
    </div>
  );
}
