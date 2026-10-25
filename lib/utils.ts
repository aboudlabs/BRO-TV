export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export const NAME_KEY = 'brotv:name';
export const CLIENT_KEY = 'brotv:client';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** يولّد كود غرفة قصير مثل BRO-92X */
export function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < 3; i++) {
    out += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return `BRO-${out}`;
}

/** يقبل: 92X أو bro-92x أو رابط كامل للغرفة، ويرجع BRO-92X */
export function normalizeRoomCode(input: string): string {
  let text = input.trim();
  const idx = text.toLowerCase().indexOf('/room/');
  if (idx !== -1) {
    text = text.slice(idx + 6).split(/[/?#]/)[0] ?? '';
  }
  let clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.startsWith('BRO') && clean.length > 3) clean = clean.slice(3);
  if (!clean) return '';
  return `BRO-${clean.slice(0, 12)}`;
}

export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const text = n >= 100 || i === 0 ? String(Math.round(n)) : n.toFixed(1);
  return `${text} ${units[i]}`;
}

/** لون ثابت لكل مستخدم (باستيل يناسب الثيم الداكن) */
export function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 72%)`;
}

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
