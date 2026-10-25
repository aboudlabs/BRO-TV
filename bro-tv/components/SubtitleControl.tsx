'use client';

import { useRef } from 'react';
import { Captions, Minus, Plus, Trash2, Upload } from 'lucide-react';

interface Props {
  name: string | null;
  offset: number;
  error: string;
  onFile: (file: File) => void;
  onShift: (delta: number) => void;
  onClear: () => void;
}

/** تحميل ترجمة (SRT / VTT) تظهر عندك فقط، مع ضبط توقيتها */
export default function SubtitleControl({ name, offset, error, onFile, onShift, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-champagne-100">
            <Captions className="h-4 w-4 text-champagne-300" />
            الترجمة
            <span className="text-xs font-normal text-champagne-200/55">(تظهر عندك فقط)</span>
          </p>
          {name && (
            <p dir="auto" className="mt-1 truncate text-xs text-champagne-200/70">
              {name}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {name && (
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              <button type="button" className="btn-chip px-2" onClick={() => onShift(-0.5)} aria-label="تقديم الترجمة نصف ثانية">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span dir="ltr" className="min-w-[3.5rem] text-center text-xs font-bold text-champagne-100">
                {offset > 0 ? '+' : ''}
                {offset.toFixed(1)}s
              </span>
              <button type="button" className="btn-chip px-2" onClick={() => onShift(0.5)} aria-label="تأخير الترجمة نصف ثانية">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".srt,.vtt,text/vtt,application/x-subrip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn-ghost" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {name ? 'تغيير الملف' : 'تحميل ملف ترجمة'}
          </button>
          {name && (
            <button type="button" className="btn-ghost" onClick={onClear} aria-label="إزالة الترجمة">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
