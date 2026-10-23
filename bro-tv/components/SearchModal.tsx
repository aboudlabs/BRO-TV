'use client';

import { useEffect, useState } from 'react';
import { Clapperboard, Film, Loader2, Search, Star, Tv, X } from 'lucide-react';
import { fetchTop, searchCatalog } from '@/lib/cinemeta';
import type { CatalogItem, CatalogType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (item: CatalogItem) => void;
}

export default function SearchModal({ open, onClose, onSelect }: Props) {
  const [type, setType] = useState<CatalogType>('movie');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const q = query.trim();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError('');
        try {
          const list = q
            ? await searchCatalog(type, q, controller.signal)
            : await fetchTop(type, controller.signal);
          setItems(list.slice(0, 60));
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            setError('تعذّر جلب النتائج. تحقق من اتصالك وحاول مجدداً.');
            setItems([]);
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      q ? 400 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, type, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="مكتبة الأفلام والمسلسلات"
    >
      <div
        className="glass-strong flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl sm:h-[85vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <Clapperboard className="h-5 w-5 shrink-0 text-champagne-300" />
          <h2 className="text-lg font-extrabold text-champagne-100">المكتبة</h2>
          <button type="button" onClick={onClose} className="btn-ghost ms-auto px-3 py-2" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center">
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
              autoFocus
              dir="auto"
              className="field ps-10"
              placeholder={type === 'movie' ? 'ابحث عن فيلم… (مثال: Inception)' : 'ابحث عن مسلسل… (مثال: Breaking Bad)'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs font-semibold text-champagne-200/60">
            {query.trim() ? `نتائج البحث عن «${query.trim()}»` : type === 'movie' ? 'الأفلام الشائعة' : 'المسلسلات الشائعة'}
          </p>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-champagne-200/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              جارٍ التحميل…
            </div>
          )}

          {!loading && error && <p className="py-16 text-center text-sm text-red-300">{error}</p>}

          {!loading && !error && items.length === 0 && (
            <p className="py-16 text-center text-sm text-champagne-200/60">لا توجد نتائج.</p>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
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
          )}
        </div>
      </div>
    </div>
  );
}
