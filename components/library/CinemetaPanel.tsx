'use client';

import { useEffect, useRef, useState } from 'react';
import { Film, Info, Loader2, Search, Star, Tv } from 'lucide-react';
import { fetchTop, searchCatalog } from '@/lib/cinemeta';
import type { CatalogItem, CatalogType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  onPick: (item: CatalogItem) => void;
}

const PAGE = 100;

/** الكتالوج العالمي (Cinemeta) — يُشغَّل عبر سيرفرات iframe خارجية: مزامنة يدوية فقط */
export default function CinemetaPanel({ onPick }: Props) {
  const [type, setType] = useState<CatalogType>('movie');
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const session = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const id = ++session.current;
    setLoading(true);
    setError('');
    setItems([]);
    setPageIdx(0);
    setHasMore(false);
    const run = term ? searchCatalog(type, term, controller.signal) : fetchTop(type, controller.signal);
    run
      .then((list) => {
        if (session.current !== id) return;
        setItems(list);
        setHasMore(!term && list.length >= PAGE - 5);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError' && session.current === id) {
          setError('تعذّر جلب النتائج. تحقق من اتصالك وحاول مجدداً.');
        }
      })
      .finally(() => {
        if (session.current === id) setLoading(false);
      });
    return () => controller.abort();
  }, [type, term]);

  const loadMore = async () => {
    if (loadingMore) return;
    const id = session.current;
    setLoadingMore(true);
    try {
      const next = pageIdx + 1;
      const list = await fetchTop(type, undefined, next * PAGE);
      if (session.current !== id) return;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...list.filter((i) => !seen.has(i.id))];
      });
      setPageIdx(next);
      setHasMore(list.length >= PAGE - 5);
    } catch {
      if (session.current === id) setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-white/10 p-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-champagne-200/70">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-champagne-400" />
          هذه الأعمال تُعرض عبر سيرفرات خارجية داخل iframe، ولا يمكن للموقع التحكم بتشغيلها. للمزامنة استخدم «مزامنة المشهد»
          (عدّ تنازلي) أو الأفضل: زر «بث الشاشة» ليشاهد الجميع نفس الصورة بالضبط.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setType('movie')}
              className={cn('btn-chip', type === 'movie' && 'btn-chip-active')}
            >
              <Film className="h-4 w-4" />
              أفلام
            </button>
            <button
              type="button"
              onClick={() => setType('series')}
              className={cn('btn-chip', type === 'series' && 'btn-chip-active')}
            >
              <Tv className="h-4 w-4" />
              مسلسلات
            </button>
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-champagne-200/50" />
            <input
              dir="auto"
              className="field ps-10"
              placeholder={type === 'movie' ? 'ابحث عن فيلم… (مثال: Inception)' : 'ابحث عن مسلسل… (مثال: Breaking Bad)'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="بحث في الكتالوج العالمي"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-xs font-semibold text-champagne-200/60">
          {term ? `نتائج البحث عن «${term}»` : type === 'movie' ? 'الأفلام الشائعة' : 'المسلسلات الشائعة'}
        </p>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-champagne-200/70">
            <Loader2 className="h-5 w-5 animate-spin" />
            جارٍ التحميل…
          </div>
        )}

        {!loading && error && <p className="py-16 text-center text-sm text-red-300">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="py-16 text-center text-sm text-champagne-200/60">لا توجد نتائج. جرّب البحث بالإنجليزية.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPick(item)}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-start transition hover:-translate-y-1 hover:border-champagne-200/50 hover:shadow-glow"
                >
                  <div className="relative aspect-[2/3] w-full bg-ink-700">
                    {item.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.poster}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-champagne-200/30">
                        <Film className="h-10 w-10" />
                      </div>
                    )}
                    {item.rating && (
                      <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink-950/80 px-2 py-0.5 text-xs font-bold text-champagne-200 backdrop-blur">
                        <Star className="h-3 w-3 fill-champagne-300 text-champagne-300" />
                        {item.rating}
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p dir="auto" className="line-clamp-1 text-sm font-bold text-champagne-100">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-champagne-200/55">{item.year ?? ''}</p>
                  </div>
                </button>
              ))}
            </div>

            {hasMore && (
              <div className="mt-5 flex justify-center">
                <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-ghost">
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  عرض المزيد
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
