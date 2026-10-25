'use client';

import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { LogoMark } from '@/components/Logo';

interface Props {
  roomId: string;
  onSubmit: (name: string) => void;
}

/** شاشة الدخول عند فتح رابط غرفة بدون اسم محفوظ */
export default function NamePrompt({ roomId, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 24);
    if (clean.length < 2) {
      setError('اكتب اسمك (حرفان على الأقل).');
      return;
    }
    onSubmit(clean);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="glass w-full max-w-sm rounded-3xl p-6 text-center animate-fade-in">
        <LogoMark size={96} priority className="mx-auto !rounded-3xl shadow-glow" />
        <h1 dir="ltr" className="mt-4 text-3xl font-black tracking-[0.2em] text-champagne-200">
          BRO <span className="text-champagne-400">TV</span>
        </h1>
        <p className="mt-2 text-sm text-champagne-200/70">
          تم دعوتك للغرفة <span dir="ltr" className="font-extrabold tracking-widest text-champagne-200">{roomId}</span>
        </p>

        <input
          autoFocus
          className="field mt-5"
          placeholder="اكتب اسمك"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <button type="submit" className="btn-primary mt-4 w-full">
          <LogIn className="h-5 w-5" />
          دخول الغرفة
        </button>
      </form>
    </main>
  );
}
