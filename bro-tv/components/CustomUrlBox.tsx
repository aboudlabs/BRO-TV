'use client';

import { useState } from 'react';
import { Link2, Play } from 'lucide-react';
import { parseCustomUrl, type ParsedUrl } from '@/lib/media';

interface Props {
  onPlay: (parsed: ParsedUrl) => void;
}

/** خانة لصق أي رابط خارجي (mp4 / m3u8 / YouTube / صفحة مشغل) */
export default function CustomUrlBox({ onPlay }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCustomUrl(value);
    if (!parsed) {
      setError('الرابط غير صالح. تأكد من لصقه كاملاً.');
      return;
    }
    setError('');
    onPlay(parsed);
    setValue('');
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-4">
      <label htmlFor="custom-url" className="mb-2 flex items-center gap-2 text-sm font-bold text-champagne-100">
        <Link2 className="h-4 w-4 text-champagne-300" />
        شغّل أي رابط للجميع
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="custom-url"
          dir="ltr"
          className="field py-2.5 text-sm"
          placeholder="https://…  (.mp4 / .m3u8 / YouTube / صفحة مشغل)"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError('');
          }}
        />
        <button type="submit" className="btn-primary shrink-0 py-2.5" disabled={!value.trim()}>
          <Play className="h-4 w-4" />
          تشغيل
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-champagne-200/50">
          الروابط المباشرة و YouTube تُزامَن بالكامل (تشغيل · إيقاف · قفز). روابط الصفحات تُفتح في iframe مشترك.
        </p>
      )}
    </form>
  );
}
