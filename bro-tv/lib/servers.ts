import type { Media } from './types';

export interface EmbedServer {
  id: number;
  name: string;
  movie: (imdbId: string) => string;
  series: (imdbId: string, season: number, episode: number) => string;
}

/** سيرفرات التشغيل (كلها تعمل عبر imdb_id) */
export const SERVERS: EmbedServer[] = [
  {
    id: 0,
    name: 'سيرفر 1 · VidSrc',
    movie: (id) => `https://vidsrc.xyz/embed/movie/${id}`,
    series: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}-${e}`,
  },
  {
    id: 1,
    name: 'سيرفر 2 · 2Embed',
    movie: (id) => `https://www.2embed.cc/embed/${id}`,
    series: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    id: 2,
    name: 'سيرفر 3 · MultiEmbed',
    movie: (id) => `https://multiembed.mov/?video_id=${id}`,
    series: (id, s, e) => `https://multiembed.mov/?video_id=${id}&s=${s}&e=${e}`,
  },
  {
    id: 3,
    name: 'سيرفر 4 · AutoEmbed',
    movie: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    series: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
];

/** يبني رابط الـ iframe لفيلم/حلقة من الكتالوج */
export function buildEmbedUrl(media: Media): string | null {
  if (media.kind !== 'catalog' || !media.imdbId) return null;
  const server = SERVERS[media.server ?? 0] ?? SERVERS[0];
  if (media.type === 'series') {
    return server.series(media.imdbId, media.season ?? 1, media.episode ?? 1);
  }
  return server.movie(media.imdbId);
}
