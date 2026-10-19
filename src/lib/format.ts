/** Formatting helpers. Dates are handled as local 'YYYY-MM-DD' strings to avoid UTC shifts. */

/** Local calendar date, e.g. '2026-10-19'. (toISOString() would give the UTC date.) */
export function localDateISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD HH:MM:SS' in local time, for DATETIME columns. */
export function localDateTime(date = new Date()): string {
  const t = [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  return `${localDateISO(date)} ${t}`;
}

/** Parse 'YYYY-MM-DD' as a local date (new Date('2026-10-19') would be UTC midnight). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(fromIso: string, to = new Date()): number {
  const a = parseLocalDate(fromIso);
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function relativeDay(iso: string): string {
  const diff = daysBetween(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return shortDate(iso);
}

export function shortDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function longDate(date = new Date()): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** 82.5 -> '82.5', 80 -> '80' */
export function kg(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  return Number.isInteger(n) ? String(n) : n.toFixed(n * 10 === Math.round(n * 10) ? 1 : 2);
}

/** 18450 -> '18.5k' */
export function compact(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

/** seconds -> '1:05' or '1:02:05' */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function minutesBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const a = new Date(start.replace(' ', 'T')).getTime();
  const b = new Date(end.replace(' ', 'T')).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** UUID v4. crypto.randomUUID only exists in secure contexts (https / localhost),
 *  but the app is often opened over plain http on a phone in the same Wi-Fi. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Epley estimated 1RM, same formula as fn_calculate_1rm in MySQL. */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 100) / 100;
}
