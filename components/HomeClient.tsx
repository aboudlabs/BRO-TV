'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, LogIn, Plus, Popcorn, RefreshCw, Search, Users } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { isSupabaseConfigured } from '@/lib/supabase';
import { NAME_KEY, generateRoomCode, normalizeRoomCode, readStorage, writeStorage } from '@/lib/utils';

const FEATURES = [
  { icon: RefreshCw, title: 'مزامنة فورية', text: 'تشغيل وإيقاف وقفز لحظي بين الجميع.' },
  { icon: Search, title: 'مكتبة ضخمة', text: 'ابحث عن أي فيلم أو مسلسل وشغّله للغرفة.' },
  { icon: Users, title: 'دردشة حية', text: 'شات وتفاعلات تطير على الشاشة.' },
];

export default function HomeClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const configured = isSupabaseConfigured();

  useEffect(() => {
    setName(readStorage(NAME_KEY) ?? '');
  }, []);

  const validName = (): string | null => {
    const clean = name.trim().slice(0, 24);
    if (clean.length < 2) {
      setError('اكتب اسمك أولاً (حرفان على الأقل).');
      return null;
    }
    writeStorage(NAME_KEY, clean);
    return clean;
  };

  const createRoom = () => {
    setError('');
    if (!validName()) return;
    router.push(`/room/${generateRoomCode()}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validName()) return;
    const id = normalizeRoomCode(code);
    if (!id) {
      setError('أدخل كود الغرفة، مثل BRO-92X.');
      return;
    }
    router.push(`/room/${id}`);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* هالات ضوئية خلفية */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-ink-500/40 blur-[120px] animate-glow" />
      <div className="pointer-events-none absolute -bottom-40 end-0 h-[360px] w-[360px] rounded-full bg-champagne-200/10 blur-[120px] animate-glow" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-[2rem] bg-champagne-200/20 blur-2xl" />
          <LogoMark size={148} priority className="relative !rounded-[2rem] shadow-glow" />
        </div>

        <h1 dir="ltr" className="mt-6 text-5xl font-black tracking-[0.2em] text-champagne-200 sm:text-6xl">
          BRO <span className="text-champagne-400">TV</span>
        </h1>
        <p className="mt-3 flex items-center gap-2 text-champagne-200/70">
          <Popcorn className="h-4 w-4" />
          غرفة مشاهدة مشتركة لك ولأصدقائك
        </p>

        {!configured && (
          <div className="mt-6 flex w-full items-start gap-3 rounded-2xl border border-champagne-400/30 bg-champagne-400/10 p-4 text-start text-sm text-champagne-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-champagne-400" />
            <p>
              لم يتم ضبط Supabase بعد. أضف <code dir="ltr">NEXT_PUBLIC_SUPABASE_URL</code> و{' '}
              <code dir="ltr">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> في ملف <code dir="ltr">.env.local</code> ثم أعد تشغيل
              الموقع.
            </p>
          </div>
        )}

        <div className="glass mt-8 w-full rounded-3xl p-5 text-start sm:p-6">
          <label htmlFor="name" className="mb-2 block text-sm font-semibold text-champagne-200/80">
            اسمك في الغرفة
          </label>
          <input
            id="name"
            className="field"
            placeholder="مثلاً: أبو خالد"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createRoom();
            }}
          />

          <button type="button" onClick={createRoom} className="btn-primary mt-4 w-full text-lg">
            <Plus className="h-5 w-5" />
            إنشاء غرفة جديدة
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-champagne-200/40">
            <span className="h-px flex-1 bg-white/10" />
            أو انضم لغرفة
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={joinRoom} className="flex gap-2">
            <input
              dir="ltr"
              className="field text-center font-bold uppercase tracking-widest"
              placeholder="BRO-92X"
              value={code}
              maxLength={24}
              onChange={(e) => setCode(e.target.value)}
              aria-label="كود الغرفة"
            />
            <button type="submit" className="btn-ghost shrink-0 px-5">
              <LogIn className="h-4 w-4" />
              انضمام
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>

        <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="glass rounded-2xl p-3 text-center">
              <Icon className="mx-auto h-5 w-5 text-champagne-300" />
              <p className="mt-2 text-sm font-bold text-champagne-100">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-champagne-200/60">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
