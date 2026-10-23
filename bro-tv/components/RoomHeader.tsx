'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Link2, Wifi, WifiOff } from 'lucide-react';
import { Wordmark } from '@/components/Logo';
import type { RoomStatus } from '@/hooks/useRoom';
import type { Member } from '@/lib/types';
import { cn, copyText } from '@/lib/utils';

interface Props {
  roomId: string;
  members: Member[];
  status: RoomStatus;
  selfId: string;
}

const STATUS_LABEL: Record<RoomStatus, string> = {
  connecting: 'جارٍ الاتصال…',
  connected: 'متصل',
  error: 'انقطع الاتصال',
  unconfigured: 'Supabase غير مضبوط',
};

export default function RoomHeader({ roomId, members, status, selfId }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const ok = await copyText(window.location.href);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const online = status === 'connected';

  return (
    <header className="glass-strong sticky top-0 z-40 border-x-0 border-t-0">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 sm:px-4 lg:px-6">
        <Link href="/" aria-label="BRO TV — الصفحة الرئيسية">
          <Wordmark size={40} textClassName="text-lg sm:text-xl" />
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1 ps-3 pe-1">
            <span className="text-xs text-champagne-200/60">الغرفة</span>
            <span dir="ltr" className="font-extrabold tracking-widest text-champagne-200">
              {roomId}
            </span>
            <button
              type="button"
              onClick={copyLink}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition',
                copied ? 'bg-emerald-300/90 text-ink-950' : 'bg-champagne-200 text-brand-purple hover:bg-champagne-100',
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              'hidden items-center gap-1.5 text-xs sm:inline-flex',
              online ? 'text-emerald-300' : 'text-amber-300',
            )}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {STATUS_LABEL[status]}
          </span>

          <div className="flex items-center gap-2" aria-label="المتواجدون الآن">
            <div className="flex -space-x-2 space-x-reverse">
              {members.slice(0, 5).map((m) => (
                <span
                  key={m.id}
                  title={m.id === selfId ? `${m.name} (أنت)` : m.name}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-800 text-sm font-black text-ink-950"
                  style={{ background: m.color }}
                >
                  {m.name.trim().charAt(0).toUpperCase()}
                </span>
              ))}
            </div>
            <div className="hidden max-w-[180px] truncate text-xs text-champagne-200/80 md:block">
              {members.length > 0 ? (
                <>
                  <span className="font-bold text-champagne-100">{members.length} متصل: </span>
                  {members.map((m) => m.name).join('، ')}
                </>
              ) : (
                '—'
              )}
            </div>
            <span className="rounded-full bg-champagne-200/15 px-2 py-0.5 text-xs font-bold text-champagne-200 md:hidden">
              {members.length}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
