'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';
import { cn, colorFromString } from '@/lib/utils';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '🔥', '👏', '😢', '🍿', '👍'];

interface Props {
  messages: ChatMessage[];
  selfId: string;
  onSend: (text: string) => void;
  onReaction: (emoji: string) => void;
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
}

export default function Chat({ messages, selfId, onSend, onReaction }: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <MessageCircle className="h-4 w-4 text-champagne-300" />
        <h2 className="text-sm font-bold text-champagne-100">الدردشة الحية</h2>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-champagne-200/45">
            لا توجد رسائل بعد… ابدأ الدردشة مع أصدقائك 👋
          </p>
        )}

        {messages.map((m) => {
          if (m.kind === 'system') {
            return (
              <div key={m.id} className="flex justify-center animate-fade-in">
                <span className="rounded-full bg-white/5 px-3 py-1 text-center text-xs leading-relaxed text-champagne-200/70">
                  {m.text}
                </span>
              </div>
            );
          }
          const mine = m.clientId === selfId;
          return (
            <div key={m.id} className={cn('flex animate-fade-in', mine ? 'justify-start' : 'justify-end')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2',
                  mine
                    ? 'rounded-ss-sm bg-champagne-200 text-brand-purple'
                    : 'rounded-se-sm border border-white/10 bg-white/10 text-champagne-100',
                )}
              >
                {!mine && (
                  <p className="mb-0.5 text-xs font-bold" style={{ color: colorFromString(m.clientId ?? m.name ?? '') }}>
                    {m.name}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.text}</p>
                <p className={cn('mt-0.5 text-[10px]', mine ? 'text-brand-purple/60' : 'text-champagne-200/40')}>
                  {timeLabel(m.ts)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReaction(emoji)}
              className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1 text-lg transition hover:scale-110 hover:bg-white/10 active:scale-95"
              aria-label={`تفاعل ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            className="field py-2.5"
            placeholder="اكتب رسالة…"
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="btn-primary shrink-0 px-4 py-2.5" disabled={!text.trim()} aria-label="إرسال">
            <Send className="h-4 w-4 -scale-x-100" />
          </button>
        </form>
      </div>
    </div>
  );
}
