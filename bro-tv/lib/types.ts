export type MediaKind = 'catalog' | 'direct' | 'youtube' | 'iframe';

/** الوسائط الحالية في الغرفة (تُزامَن بين كل الأعضاء) */
export interface Media {
  kind: MediaKind;
  title: string;
  poster?: string;
  // خاص بالكتالوج (Cinemeta)
  type?: 'movie' | 'series';
  imdbId?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  server?: number;
  // خاص بالروابط الخارجية
  url?: string;
  videoId?: string;
  /** تفعيل Sandbox على الـ iframe لمنع النوافذ المنبثقة */
  sandbox: boolean;
}

export type PlaybackAction = 'play' | 'pause' | 'seek';

export interface PlaybackCommand {
  action: PlaybackAction;
  time: number;
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
