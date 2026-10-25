export type MediaKind = 'catalog' | 'direct' | 'youtube' | 'iframe' | 'screen';

/** نسخة من نفس الفيديو بجودة مختلفة (الأفضل أولاً) */
export interface MediaVariant {
  url: string;
  label: string;
}

/** الوسائط الحالية في الغرفة (تُزامَن بين كل الأعضاء) */
export interface Media {
  kind: MediaKind;
  title: string;
  poster?: string;
  // خاص بالكتالوج العالمي (Cinemeta + سيرفرات iframe)
  type?: 'movie' | 'series';
  imdbId?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  server?: number;
  // خاص بالملفات والروابط
  url?: string;
  videoId?: string;
  variants?: MediaVariant[];
  // خاص بالمكتبة المجانية (أرشيف الإنترنت)
  source?: 'archive' | 'link';
  archiveId?: string;
  partKey?: string;
  partLabel?: string;
  // خاص ببث الشاشة
  hostId?: string;
  hostName?: string;
  /** تفعيل Sandbox على الـ iframe لمنع النوافذ المنبثقة */
  sandbox: boolean;
}

export type PlaybackAction = 'play' | 'pause' | 'seek';

export interface PlaybackCommand {
  action: PlaybackAction;
  time: number;
  /** لحظة استلام الأمر محلياً (لتعويض الزمن المنقضي) */
  at?: number;
}

/** واجهة موحدة للتحكم بالمشغلات (mp4 / m3u8 / YouTube) */
export interface PlayerHandle {
  apply(cmd: PlaybackCommand): void;
  getTime(): number;
  isPlaying(): boolean;
}

export interface StartAt {
  time: number;
  playing: boolean;
  at: number;
}

export interface SubtitleTrack {
  label: string;
  vtt: string;
}

export interface Member {
  id: string;
  name: string;
  joinedAt: number;
  color: string;
}

export interface ChatMessage {
  id: string;
  kind: 'user' | 'system';
  clientId?: string;
  name?: string;
  text: string;
  ts: number;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  name: string;
  left: number;
}

export type CatalogType = 'movie' | 'series';

export interface CatalogItem {
  id: string;
  imdbId: string;
  type: CatalogType;
  name: string;
  poster?: string;
  year?: string;
  rating?: string;
  description?: string;
}

export interface Episode {
  season: number;
  episode: number;
  title: string;
  thumbnail?: string;
  released?: string;
}

export interface SeriesMeta {
  imdbId: string;
  name: string;
  episodes: Episode[];
}
