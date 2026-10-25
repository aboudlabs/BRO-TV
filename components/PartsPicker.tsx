'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ListVideo } from 'lucide-react';
import { resolveArchiveItem, type ArchiveResolved } from '@/lib/library/archive';
import type { Media } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';

interface Props {
  media: Media;
  onPick: (resolved: ArchiveResolved, index: number) => void;
}

/** قائمة الحلقات/الأجزاء لعناصر المكتبة المجانية التي تحوي أكثر من ملف (مثل مسلسل كامل) */
export default function PartsPicker({ media, onPick }: Props) {
  const [resolved, setResolved] = useState<ArchiveResolved | null>(null);
  const id = media.archiveId;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    resolveArchiveItem(id)
      .then((r) => {
        if (alive) setResolved(r);
      })
      .catch(() => {
        if (alive) setResolved(null);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (!resolved || resolved.id !== id || resolved.parts.length < 2) return null;

  const current = resolved.parts.findIndex((p) => p.key === media.partKey);
  const prev = current > 0 ? current - 1 : -1;
  const next = current >= 0 && current < resolved.parts.length - 1 ? current + 1 : -1;

  return (
    <div className="glass space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-champagne-100">
          <ListVideo className="h-4 w-4 text-champagne-300" />
          الحلقات والأجزاء ({resolved.parts.length})
        </h3>
        <div className="flex gap-2">
          <button type="button" className="btn-chip" disabled={prev < 0} onClick={() => prev >= 0 && onPick(resolved, prev)}>
            <ChevronRight className="h-4 w-4" />
            السابق
          </button>
          <button type="button" className="btn-chip" disabled={next < 0} onClick={() => next >= 0 && onPick(resolved, next)}>
            التالي
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto pe-1 sm:grid-cols-2">
        {resolved.parts.map((part, i) => {
          const active = i === current;
          return (
            <button
              key={part.key}
              type="button"
              onClick={() => onPick(resolved, i)}
              title={part.label}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-sm transition',
                active
                  ? 'border-champagne-200 bg-champagne-200 font-bold text-brand-purple'
                  : 'border-white/10 bg-white/5 text-champagne-100 hover:bg-white/10',
              )}
            >
              <span dir="auto" className="truncate">
                {i + 1}. {part.label}
              </span>
              {part.length > 0 && (
                <span className={cn('shrink-0 text-xs', active ? 'text-brand-purple/70' : 'text-champagne-200/50')}>
                  {formatTime(part.length)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
