'use client';

import { useEffect, useState } from 'react';
import { Clapperboard, Globe2, Library, X } from 'lucide-react';
import ArchivePanel from '@/components/library/ArchivePanel';
import CinemetaPanel from '@/components/library/CinemetaPanel';
import type { ArchiveResolved } from '@/lib/library/archive';
import type { CatalogItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onPickArchive: (resolved: ArchiveResolved) => void;
  onPickCatalog: (item: CatalogItem) => void;
}

type Tab = 'archive' | 'catalog';

export default function LibraryModal({ open, onClose, onPickArchive, onPickCatalog }: Props) {
  const [tab, setTab] = useState<Tab>('archive');

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
        className="glass-strong flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl sm:h-[85vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <Clapperboard className="h-5 w-5 shrink-0 text-champagne-300" />
          <h2 className="text-lg font-extrabold text-champagne-100">المكتبة</h2>
          <button type="button" onClick={onClose} className="btn-ghost ms-auto px-3 py-2" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-3">
          <button
            type="button"
            onClick={() => setTab('archive')}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-sm font-bold transition sm:flex-row sm:justify-center sm:gap-2',
              tab === 'archive'
                ? 'border-champagne-200 bg-champagne-200 text-brand-purple'
                : 'border-white/10 bg-white/5 text-champagne-100 hover:bg-white/10',
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Library className="h-4 w-4" />
              المكتبة المجانية
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                tab === 'archive' ? 'bg-brand-purple/15 text-brand-purple' : 'bg-emerald-300/15 text-emerald-300',
              )}
            >
              مزامنة كاملة ✓
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-sm font-bold transition sm:flex-row sm:justify-center sm:gap-2',
              tab === 'catalog'
                ? 'border-champagne-200 bg-champagne-200 text-brand-purple'
                : 'border-white/10 bg-white/5 text-champagne-100 hover:bg-white/10',
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              الكتالوج العالمي
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                tab === 'catalog' ? 'bg-brand-purple/15 text-brand-purple' : 'bg-amber-300/15 text-amber-300',
              )}
            >
              مزامنة يدوية / بث الشاشة
            </span>
          </button>
        </div>

        {tab === 'archive' ? <ArchivePanel onPick={onPickArchive} /> : <CinemetaPanel onPick={onPickCatalog} />}
      </div>
    </div>
  );
}
