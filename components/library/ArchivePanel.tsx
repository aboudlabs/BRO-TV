'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Film, Loader2, Search } from 'lucide-react';
import {
  ARCHIVE_SECTIONS,
  archiveErrorMessage,
  resolveArchiveItem,
  searchArchive,
  type ArchiveItem,
  type ArchiveResolved,
  type ArchiveSection,
} from '@/lib/library/archive';
import { cn } from '@/lib/utils';

interface Props {
  onPick: (resolved: ArchiveResolved) => void;
}

function Poster({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="flex h-full items-center justify-center text-champagne-200/30">
        <Film className="h-10 w-10" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover transition group-hover:scale-105"
    />
  );
}

/** المكتبة المجانية (أرشيف الإنترنت): تُشغَّل داخل مشغّلنا فتتزامن بالكامل */
export default function ArchivePanel({ onPick }: Props) {
  const [section, setSection] = useState<ArchiveSection>(ARCHIVE_SECTIONS[0]);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});
  // رقم الجلسة الحالية للبحث: يمنع دمج نتائج قديمة في قائمة جديدة
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
    setPage(1);
    setHasMore(false);
    searchArchive(section, term, 1, controller.signal)
      .then((res) => {
        if (session.current !== id) return;
        setItems(res.items);
        setHasMore(res.hasMore);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError' && session.current === id) setError(archiveErrorMessage(e));
      })
      .finally(() => {
        if (session.current === id) setLoading(false);
      });
    return () => controller.abort();
  }, [section, term]);

  const loadMore = async () => {
    if (loadingMore) return;
    const id = session.current;
    setLoadingMore(true);
    try {
      const res = await searchArchive(section, term, page + 1);
      if (session.current !== id) return;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setPage(page + 1);
      setHasMore(res.hasMore);
    } catch (e) {
      if (session.current === id) setError(archiveErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const pick = async (item: ArchiveItem) => {
    if (resolvingId) return;
    setResolvingId(item.id);
    setFailed((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    try {
      const resolved = await resolveArchiveItem(item.id);
      onPick(resolved);
    } catch (e) {
      setFailed((prev) => ({ ...prev, [item.id]: archiveErrorMessage(e) }));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-white/10 p-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-champagne-200/70">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          أفلام ومسلسلات وكرتون من أرشيف الإنترنت (ملكية عامة وتراخيص مفتوحة). تعمل داخل مشغّل BRO TV لذلك تتزامن بالكامل:
          تشغيل، إيقاف، وقفز.
        </p>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {ARCHIVE_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s)}
              className={cn('btn-chip shrink-0', s.id === section.id && 'btn-chip-active')}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-champagne-200/50" />
          <input
            dir="auto"
            className="field ps-10"
            placeholder="ابحث بالإنجليزية داخل هذا القسم… (مثال: Dracula)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="بحث في المكتبة المجانية"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-champagne-200/70">
            <Loader2 className="h-5 w-5 animate-spin" />
            جارٍ التحميل…
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-red-300">
            <AlertTriangle className="h-6 w-6" />
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="py-16 text-center text-sm text-champagne-200/60">لا توجد نتائج. جرّب كلمة إنجليزية أخرى أو قسماً آخر.</p>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => {
                const busy = resolvingId === item.id;
                const problem = failed[item.id];
                return (
                  <div key={item.id} className="flex flex-col">
                    <button
                      type="button"
                      disabled={resolvingId !== null}
                      onClick={() => pick(item)}
                      className={cn(
                        'group overflow-hidden rounded-2xl border bg-white/5 text-start transition hover:-translate-y-1 hover:shadow-glow disabled:cursor-wait',
                        problem ? 'border-red-300/40' : 'border-white/10 hover:border-champagne-200/50',
                      )}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-700">
                        <Poster src={item.poster} alt={item.title} />
                        {busy && (
                          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
                            <Loader2 className="h-6 w-6 animate-spin text-champagne-200" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p dir="auto" className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-champagne-100">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-champagne-200/55">{item.year ?? ' '}</p>
                      </div>
                    </button>
                    {problem && <p className="mt-1 text-xs leading-relaxed text-red-300">{problem}</p>}
                  </div>
                );
              })}
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
