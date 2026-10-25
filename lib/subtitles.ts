export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** يفك ترميز ملف الترجمة: UTF-8 ثم UTF-16 ثم windows-1256 (شائع في ترجمات العربية القديمة) */
export function decodeSubtitleBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    /* ليس UTF-8 */
  }
  for (const enc of ['windows-1256', 'iso-8859-6', 'windows-1252']) {
    try {
      return new TextDecoder(enc).decode(bytes);
    } catch {
      /* جرّب الترميز التالي */
    }
  }
  return new TextDecoder().decode(bytes);
}

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

function toSeconds(match: RegExpMatchArray): number {
  const h = Number(match[1] ?? 0);
  const m = Number(match[2]);
  const s = Number(match[3]);
  const ms = Number(match[4].padEnd(3, '0'));
  return h * 3600 + m * 60 + s + ms / 1000;
}

function cleanCueText(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/\{\\[^}]*\}/g, '') // وسوم ASS مثل {\an8}
    .replace(/<(?!\/?(?:i|b|u)\b)[^>]*>/gi, '') // نبقي i/b/u فقط
    .replace(/&(?!(?:amp|lt|gt|nbsp|lrm|rlm);)/g, '&amp;')
    .trim();
}

/** يحلل SRT أو VTT إلى مقاطع */
export function parseSubtitles(input: string): Cue[] {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx === -1) continue;
    const [a, b] = lines[timeIdx].split('-->');
    const ma = a.match(TIME);
    const mb = b?.match(TIME);
    if (!ma || !mb) continue;
    const body = cleanCueText(lines.slice(timeIdx + 1));
    if (!body) continue;
    cues.push({ start: toSeconds(ma), end: toSeconds(mb), text: body });
  }
  return cues;
}

function fmt(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const ms = total % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}.${p(ms, 3)}`;
}

/** يبني ملف WebVTT مع إزاحة زمنية (بالثواني، موجبة = تأخير الترجمة) */
export function cuesToVtt(cues: Cue[], offset = 0): string {
  const out: string[] = ['WEBVTT', ''];
  let n = 1;
  for (const c of cues) {
    const start = c.start + offset;
    const end = c.end + offset;
    if (end <= 0) continue;
    out.push(String(n), `${fmt(Math.max(0, start))} --> ${fmt(end)}`, c.text, '');
    n += 1;
  }
  return out.join('\n');
}
