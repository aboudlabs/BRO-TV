'use client';

import { SANDBOX_FLAGS } from '@/lib/media';

interface Props {
  src: string;
  title: string;
  sandbox: boolean;
}

/** iframe مشترك لسيرفرات الأفلام والروابط الخارجية (مع Sandbox اختياري) */
export default function EmbedPlayer({ src, title, sandbox }: Props) {
  return (
    <iframe
      key={`${src}|${sandbox}`}
      src={src}
      title={title}
      className="h-full w-full border-0 bg-black"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
      allowFullScreen
      referrerPolicy="origin"
      sandbox={sandbox ? SANDBOX_FLAGS : undefined}
    />
  );
}
