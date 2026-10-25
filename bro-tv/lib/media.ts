import type { Media } from './types';

export interface ParsedUrl {
  kind: 'direct' | 'youtube' | 'iframe';
  url: string;
  videoId?: string;
  host: string;
}

const YT_ID = /^[\w-]{11}$/;

function extractYouTubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0] ?? '';
    return YT_ID.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v');
    if (v && YT_ID.test(v)) return v;
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

const DIRECT_EXT = /\.(mp4|m4v|webm|ogv|mov|m3u8)$/i;

/** يحلل الرابط ويحدد نوع المشغل المناسب */
export function parseCustomUrl(raw: string): ParsedUrl | null {
  let text = raw.trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;

  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;

  const host = u.hostname.replace(/^www\./, '');

  const ytId = extractYouTubeId(u);
  if (ytId) return { kind: 'youtube', url: u.toString(), videoId: ytId, host };

  if (DIRECT_EXT.test(u.pathname) || /\.m3u8(?=$|[?#&])/i.test(u.href)) {
    return { kind: 'direct', url: u.toString(), host };
  }

  return { kind: 'iframe', url: u.toString(), host };
}

/** صلاحيات الـ Sandbox: تسمح بتشغيل المشغل لكن تمنع النوافذ المنبثقة وإعادة توجيه الصفحة */
export const SANDBOX_FLAGS =
  'allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock';

/** مفتاح يميّز الوسائط (لتجاهل نبضات المزامنة الخاصة بفيديو آخر) */
export function mediaKey(media: Media | null | undefined): string {
  if (!media) return '';
  return `${media.kind}|${media.url ?? media.videoId ?? media.imdbId ?? media.hostId ?? ''}`;
}

/** العنوان الكامل للعرض (يشمل اسم الجزء/الحلقة إن وُجد) */
export function mediaTitle(media: Media): string {
  if (media.partLabel) return `${media.title} — ${media.partLabel}`;
  return media.title;
}

/** هل يمكن مزامنة المشغل تلقائياً (تشغيل/إيقاف/قفز)؟ */
export function isSyncable(media: Media | null | undefined): boolean {
  return media?.kind === 'direct' || media?.kind === 'youtube' || media?.kind === 'screen';
}
