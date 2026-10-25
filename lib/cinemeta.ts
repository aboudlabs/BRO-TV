import type { CatalogItem, CatalogType, Episode, SeriesMeta } from './types';

const BASE = 'https://v3-cinemeta.strem.io';

interface RawMeta {
  id?: string;
  imdb_id?: string;
  type?: string;
  name?: string;
  poster?: string;
  releaseInfo?: string;
  year?: string;
  imdbRating?: string;
  description?: string;
  videos?: RawVideo[];
}

interface RawVideo {
  season?: number;
  episode?: number;
  number?: number;
  name?: string;
  title?: string;
  thumbnail?: string;
  released?: string;
}

function mapItem(raw: RawMeta, type: CatalogType): CatalogItem | null {
  const imdbId = raw.imdb_id || raw.id;
  if (!imdbId || !raw.name) return null;
  return {
    id: imdbId,
    imdbId,
    type,
    name: raw.name,
    poster: raw.poster,
    year: raw.releaseInfo || raw.year,
    rating: raw.imdbRating,
    description: raw.description,
  };
}

async function fetchCatalog(url: string, type: CatalogType, signal?: AbortSignal): Promise<CatalogItem[]> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Cinemeta ${res.status}`);
  const json = (await res.json()) as { metas?: RawMeta[] };
  const items: CatalogItem[] = [];
  for (const raw of json.metas ?? []) {
    const item = mapItem(raw, type);
    if (item) items.push(item);
  }
  return items;
}

/** الأفلام/المسلسلات الشائعة (skip للصفحات التالية، كل صفحة ~100 عنصر) */
export function fetchTop(type: CatalogType, signal?: AbortSignal, skip = 0): Promise<CatalogItem[]> {
  const path = skip > 0 ? `top/skip=${skip}.json` : 'top.json';
  return fetchCatalog(`${BASE}/catalog/${type}/${path}`, type, signal);
}

/** البحث بالاسم */
export function searchCatalog(type: CatalogType, query: string, signal?: AbortSignal): Promise<CatalogItem[]> {
  const q = encodeURIComponent(query.trim());
  return fetchCatalog(`${BASE}/catalog/${type}/top/search=${q}.json`, type, signal);
}

const seriesCache = new Map<string, SeriesMeta>();

/** تفاصيل المسلسل: المواسم والحلقات */
export async function getSeriesMeta(imdbId: string, signal?: AbortSignal): Promise<SeriesMeta> {
  const cached = seriesCache.get(imdbId);
  if (cached) return cached;

  const res = await fetch(`${BASE}/meta/series/${imdbId}.json`, { signal });
  if (!res.ok) throw new Error(`Cinemeta ${res.status}`);
  const json = (await res.json()) as { meta?: RawMeta };
  const meta = json.meta;

  const episodes: Episode[] = [];
  for (const v of meta?.videos ?? []) {
    const season = v.season ?? 0;
    const episode = v.episode ?? v.number ?? 0;
    if (season < 1 || episode < 1) continue; // تجاهل الحلقات الخاصة (الموسم 0)
    episodes.push({
      season,
      episode,
      title: v.name || v.title || `الحلقة ${episode}`,
      thumbnail: v.thumbnail,
      released: v.released,
    });
  }
  episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);

  const result: SeriesMeta = { imdbId, name: meta?.name ?? '', episodes };
  seriesCache.set(imdbId, result);
  return result;
}
