import type { Media } from '../types';
import { formatBytes } from '../utils';

/**
 * المكتبة المجانية — أرشيف الإنترنت (archive.org)
 * أفلام ومسلسلات وكرتون من الملكية العامة / تراخيص مفتوحة، تُشغَّل مباشرة داخل مشغّل BRO TV
 * (وليس داخل iframe) وبالتالي تتزامن بالكامل بين الجميع.
 */

export interface ArchiveSection {
  id: string;
  label: string;
  /** شرط Lucene يحدد القسم */
  filter: string;
}

export const ARCHIVE_SECTIONS: ArchiveSection[] = [
  { id: 'films', label: 'أفلام كاملة', filter: 'collection:feature_films' },
  { id: 'comedy', label: 'كوميديا', filter: 'collection:Comedy_Films' },
  { id: 'scifi', label: 'خيال علمي ورعب', filter: 'collection:SciFi_Horror' },
  { id: 'noir', label: 'جريمة وغموض', filter: 'collection:Film_Noir' },
  { id: 'silent', label: 'أفلام صامتة', filter: 'collection:silent_films' },
  { id: 'cartoons', label: 'كرتون ورسوم متحركة', filter: 'collection:animationandcartoons' },
  { id: 'tv', label: 'مسلسلات قديمة', filter: 'collection:classic_tv' },
  { id: 'blender', label: 'أفلام Blender المفتوحة', filter: 'creator:("Blender Foundation")' },
];

export const PAGE_SIZE = 40;

/** نعرض فقط العناصر التي تحوي ملف فيديو قابلاً للتشغيل في المتصفح */
const PLAYABLE_FORMATS = 'format:("512Kb MPEG4" OR h.264 OR MPEG4)';

const FIELDS = ['identifier', 'title', 'year', 'description', 'subject', 'creator', 'downloads'];

/** فلتر محتوى: إخفاء العناوين غير المناسبة لمشاهدة عائلية */
const BLOCKED =
  /(^|[^a-z])(sex|sexy|sexual|sexploitation|porn|porno|pornographic|xxx|erotic|erotica|nude|nudes|nudist|nudism|naked|striptease|stripper|strippers|fetish|bdsm|hardcore|nympho|nymphos|orgy|lesbian|lesbians|prostitute|prostitutes|brothel|playboy|softcore|topless|burlesque|adults?\s+only|x-rated)([^a-z]|$)/i;

export interface ArchiveItem {
  id: string;
  title: string;
  year?: string;
  description?: string;
  creator?: string;
  downloads: number;
  poster: string;
}

export interface ArchivePage {
  items: ArchiveItem[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface ArchiveVariant {
  url: string;
  label: string;
  tier: number;
  size: number;
  height: number;
}

export interface ArchivePart {
  key: string;
  label: string;
  length: number;
  variants: ArchiveVariant[];
  defaultIndex: number;
}

export interface ArchiveResolved {
  id: string;
  title: string;
  poster: string;
  parts: ArchivePart[];
  defaultPart: number;
}

export class ArchiveError extends Error {
  code: 'restricted' | 'no-playable' | 'network';
  constructor(code: 'restricted' | 'no-playable' | 'network', message: string) {
    super(message);
    this.code = code;
    this.name = 'ArchiveError';
  }
}

/* ----------------------------- أدوات مساعدة ----------------------------- */

function first(v: unknown): string {
  if (Array.isArray(v)) return first(v[0]);
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

function joined(v: unknown): string {
  if (Array.isArray(v)) return v.map(joined).join(' ');
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return '';
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function archivePoster(id: string): string {
  return `https://archive.org/services/img/${encodeURIComponent(id)}`;
}

export function archiveFileUrl(id: string, name: string): string {
  const path = name.split('/').map(encodeURIComponent).join('/');
  return `https://archive.org/download/${encodeURIComponent(id)}/${path}`;
}

/* ------------------------------ الشبكة ------------------------------ */

// إن فشل الاتصال المباشر (CORS مثلاً) نحوّل الطلبات عبر /api/archive في خادمنا
let preferProxy = false;

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const order: Array<'direct' | 'proxy'> = preferProxy ? ['proxy', 'direct'] : ['direct', 'proxy'];
  let lastError: unknown = null;
  for (const mode of order) {
    try {
      const target = mode === 'direct' ? url : `/api/archive?u=${encodeURIComponent(url)}`;
      const res = await fetch(target, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as T;
      preferProxy = mode === 'proxy';
      return data;
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      lastError = e;
    }
  }
  throw new ArchiveError('network', lastError instanceof Error ? lastError.message : 'network');
}

/* ------------------------------- البحث ------------------------------- */

function cleanQuery(input: string): string {
  return input
    .replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function buildSearchUrl(section: ArchiveSection, text: string, page: number): string {
  const words = cleanQuery(text).split(' ').filter(Boolean);
  const parts = ['mediatype:movies', section.filter, PLAYABLE_FORMATS];
  if (words.length > 0) {
    const t = words
      .map((w, i) => (i === words.length - 1 && w.length > 2 ? `${w.toLowerCase()}*` : w))
      .join(' AND ');
    parts.push(`(title:(${t}) OR subject:(${t}) OR creator:(${t}))`);
  }
  const params = new URLSearchParams();
  params.set('q', parts.join(' AND '));
  for (const f of FIELDS) params.append('fl[]', f);
  params.append('sort[]', 'downloads desc');
  params.set('rows', String(PAGE_SIZE));
  params.set('page', String(Math.max(1, page)));
  params.set('output', 'json');
  return `https://archive.org/advancedsearch.php?${params.toString()}`;
}

interface RawSearch {
  response?: { numFound?: number; docs?: Array<Record<string, unknown>> };
  error?: unknown;
}

function isSafe(doc: Record<string, unknown>): boolean {
  const text = `${joined(doc.title)} ${joined(doc.subject)} ${joined(doc.creator)} ${joined(doc.identifier)}`;
  return !BLOCKED.test(text);
}

function toItem(doc: Record<string, unknown>): ArchiveItem | null {
  const id = first(doc.identifier);
  const title = stripHtml(first(doc.title));
  if (!id || !title) return null;
  const description = stripHtml(joined(doc.description)).slice(0, 240);
  return {
    id,
    title,
    year: first(doc.year) || undefined,
    description: description || undefined,
    creator: stripHtml(first(doc.creator)) || undefined,
    downloads: Number(first(doc.downloads)) || 0,
    poster: archivePoster(id),
  };
}

const searchCache = new Map<string, ArchivePage>();

export async function searchArchive(
  section: ArchiveSection,
  text: string,
  page: number,
  signal?: AbortSignal,
): Promise<ArchivePage> {
  const url = buildSearchUrl(section, text, page);
  const cached = searchCache.get(url);
  if (cached) return cached;

  const data = await fetchJson<RawSearch>(url, signal);
  if (data.error) throw new ArchiveError('network', 'search error');
  const docs = data.response?.docs ?? [];
  const total = Number(data.response?.numFound ?? 0) || 0;
  const items: ArchiveItem[] = [];
  for (const doc of docs) {
    if (!isSafe(doc)) continue;
    const item = toItem(doc);
    if (item) items.push(item);
  }
  const result: ArchivePage = { items, total, page, hasMore: page * PAGE_SIZE < total };
  if (searchCache.size > 60) searchCache.clear();
  searchCache.set(url, result);
  return result;
}

/* --------------------------- تفاصيل عنصر وملفاته --------------------------- */

interface RawFile {
  name?: string;
  format?: string;
  source?: string;
  size?: string;
  length?: string;
  height?: string;
  private?: string;
}

interface RawMeta {
  files?: RawFile[];
  metadata?: Record<string, unknown>;
  is_dark?: boolean;
}

const PLAYABLE_EXT = /\.(mp4|m4v|webm|ogv)$/i;

/** ترتيب الجودة: الأقل رقماً هو الأفضل. null = غير قابل للتشغيل في المتصفح */
function tierOf(file: RawFile): number | null {
  const name = file.name ?? '';
  if (!PLAYABLE_EXT.test(name)) return null;
  if (/(^|\/)__ia_|\.thumbs\//.test(name)) return null;
  switch ((file.format ?? '').toLowerCase()) {
    case 'h.264 hd':
      return 0;
    case 'h.264':
    case 'h.264 ia':
      return 1;
    case 'mpeg4':
      return 2;
    case '512kb mpeg4':
      return 3;
    case 'webm':
      return 4;
    case 'ogg video':
      return 5;
    default:
      return null;
  }
}

function variantLabel(tier: number, height: number, size: number): string {
  const q = tier <= 1 ? 'عالية' : tier === 2 ? 'أصلية' : tier === 3 ? 'خفيفة' : 'بديلة';
  const res = height > 0 ? ` · ${height}p` : '';
  const sz = formatBytes(size);
  return `${q}${res}${sz ? ` · ${sz}` : ''}`;
}

function prettyLabel(base: string): string {
  const name = base.split('/').pop() ?? base;
  return name.replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

interface Cand {
  name: string;
  tier: number;
  size: number;
  length: number;
  height: number;
}

const MAX_AUTO_BITRATE = 6_000_000; // 6 Mbps

function pickDefault(variants: ArchiveVariant[], length: number): number {
  if (variants.length === 0) return 0;
  const fits = (v: ArchiveVariant): boolean =>
    length <= 0 || v.size <= 0 || (v.size * 8) / length <= MAX_AUTO_BITRATE;
  const idx = variants.findIndex(fits);
  if (idx >= 0) return idx;
  // كل النسخ ثقيلة: اختر الأصغر حجماً
  let best = 0;
  variants.forEach((v, i) => {
    if (v.size > 0 && (variants[best].size <= 0 || v.size < variants[best].size)) best = i;
  });
  return best;
}

const resolveCache = new Map<string, ArchiveResolved>();

export async function resolveArchiveItem(id: string, signal?: AbortSignal): Promise<ArchiveResolved> {
  const cached = resolveCache.get(id);
  if (cached) return cached;

  const meta = await fetchJson<RawMeta>(`https://archive.org/metadata/${encodeURIComponent(id)}`, signal);
  const info = meta.metadata ?? {};
  if (meta.is_dark || first(info['access-restricted-item']).toLowerCase() === 'true') {
    throw new ArchiveError('restricted', 'restricted');
  }

  // 1) تجميع الملفات حسب الاسم الأساسي (نفس المحتوى بجودات مختلفة)
  const groups = new Map<string, Cand[]>();
  for (const file of meta.files ?? []) {
    if (!file.name || file.private === 'true') continue;
    const tier = tierOf(file);
    if (tier === null) continue;
    const base = file.name.replace(/\.[^./]+$/, '').replace(/_512kb$/i, '');
    const list = groups.get(base) ?? [];
    list.push({
      name: file.name,
      tier,
      size: Number(file.size) || 0,
      length: Number(file.length) || 0,
      height: Number(file.height) || 0,
    });
    groups.set(base, list);
  }

  interface RawPart {
    key: string;
    cands: Cand[];
    length: number;
  }
  let raw: RawPart[] = Array.from(groups.entries()).map(([key, cands]) => ({
    key,
    cands: cands.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)),
    length: Math.max(0, ...cands.map((c) => c.length)),
  }));
  raw.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));

  // 2) دمج المجموعات المتطابقة المدة (مثل نسخة Stereo و Surround لنفس الفيلم)
  const merged: RawPart[] = [];
  for (const part of raw) {
    const twin = part.length > 0 ? merged.find((m) => m.length > 0 && Math.abs(m.length - part.length) < 0.05) : undefined;
    if (twin) {
      for (const c of part.cands) {
        if (!twin.cands.some((t) => t.tier === c.tier)) twin.cands.push(c);
      }
      twin.cands.sort((a, b) => a.tier - b.tier);
    } else {
      merged.push({ ...part, cands: [...part.cands] });
    }
  }
  raw = merged;

  // 3) بناء الأجزاء مع النسخ المتاحة
  const parts: ArchivePart[] = raw.slice(0, 500).map((p, i) => {
    const browserSafe = p.cands.filter((c) => c.tier <= 3);
    const pool = browserSafe.length > 0 ? browserSafe : p.cands;
    const seenTier = new Set<number>();
    const variants: ArchiveVariant[] = [];
    for (const c of pool) {
      if (seenTier.has(c.tier)) continue;
      seenTier.add(c.tier);
      variants.push({
        url: archiveFileUrl(id, c.name),
        label: variantLabel(c.tier, c.height, c.size),
        tier: c.tier,
        size: c.size,
        height: c.height,
      });
    }
    return {
      key: p.key,
      label: prettyLabel(p.key) || `الجزء ${i + 1}`,
      length: p.length,
      variants,
      defaultIndex: pickDefault(variants, p.length),
    };
  });

  if (parts.length === 0) throw new ArchiveError('no-playable', 'no playable files');

  // الجزء الافتراضي: الأطول إذا كان أطول بوضوح (الفيلم الرئيسي وليس العرض الدعائي)
  let defaultPart = 0;
  if (parts.length > 1 && parts.length <= 8) {
    const byLength = parts.map((p, i) => ({ i, len: p.length })).sort((a, b) => b.len - a.len);
    if (byLength[0].len >= 3 * (byLength[1]?.len ?? 0) && byLength[0].len > 0) defaultPart = byLength[0].i;
  }

  const resolved: ArchiveResolved = {
    id,
    title: stripHtml(first(info.title)) || id,
    poster: archivePoster(id),
    parts,
    defaultPart,
  };
  if (resolveCache.size > 80) resolveCache.clear();
  resolveCache.set(id, resolved);
  return resolved;
}

/** يحوّل عنصراً مُحلَّلاً إلى Media جاهز للبث في الغرفة */
export function buildArchiveMedia(resolved: ArchiveResolved, partIndex: number): Media {
  const part = resolved.parts[partIndex] ?? resolved.parts[0];
  const def = part.variants[part.defaultIndex] ?? part.variants[0];
  return {
    kind: 'direct',
    source: 'archive',
    archiveId: resolved.id,
    title: resolved.title,
    poster: resolved.poster,
    partKey: part.key,
    partLabel: resolved.parts.length > 1 ? part.label : undefined,
    url: def.url,
    variants: part.variants.map((v) => ({ url: v.url, label: v.label })),
    sandbox: false,
  };
}

export function archiveErrorMessage(e: unknown): string {
  if (e instanceof ArchiveError) {
    if (e.code === 'restricted') return 'هذا العنصر مقيّد من المصدر ولا يمكن تشغيله.';
    if (e.code === 'no-playable') return 'لا يوجد ملف فيديو قابل للتشغيل لهذا العنصر (ربما حُذف من المصدر).';
  }
  return 'تعذّر الاتصال بالمصدر. تحقق من الإنترنت وحاول مرة أخرى.';
}
