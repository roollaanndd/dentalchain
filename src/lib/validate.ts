/**
 * Input validation + sanitisation.
 *
 * Every value that reaches the data layer passes through here first. React
 * escapes on render and we never call dangerouslySetInnerHTML, so this is
 * about data integrity and about what gets persisted - not about trusting
 * the client, which we never do once Supabase is wired up.
 */

export const LIMITS = {
  name: 80, email: 160, phone: 24, title: 140, body: 5000,
  short: 240, purpose: 300, plate: 12, address: 300, note: 1000,
} as const;

/**
 * Control characters we never persist. Built from escapes rather than a
 * literal class so the source file itself stays free of control bytes.
 */
const CONTROL_ALL = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');
/** Same, but spares \\n and \\t so textareas keep their shape. */
const CONTROL_KEEP_NEWLINE = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');

/** Strips control characters and collapses whitespace. */
export function clean(v: unknown, max: number = LIMITS.short): string {
  if (typeof v !== 'string') return '';
  return v.replace(CONTROL_ALL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Same, but keeps newlines for textareas. */
export function cleanMultiline(v: unknown, max: number = LIMITS.body): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/\r\n/g, '\n')
    .replace(CONTROL_KEEP_NEWLINE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export function isEmail(v: string): boolean {
  return v.length <= LIMITS.email && EMAIL_RE.test(v);
}
export function normaliseEmail(v: string): string {
  return clean(v, LIMITS.email).toLowerCase();
}

/** Indonesian mobile: 08xx / +628xx / 628xx, 9-15 digits. */
export function isPhoneID(v: string): boolean {
  const d = v.replace(/[\s()-]/g, '');
  return /^(\+?62|0)8\d{7,12}$/.test(d);
}

export function isPlate(v: string): boolean {
  return /^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{0,3}$/.test(v.trim().toUpperCase());
}
export function normalisePlate(v: string): string {
  return clean(v, LIMITS.plate).toUpperCase().replace(/\s+/g, ' ');
}

export function isISODate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Only http(s) and data:image - blocks javascript: and other URL schemes. */
export function safeUrl(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function clampInt(v: unknown, min: number, max: number, fallback = min): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function clampMoney(v: unknown, max = 1_000_000_000): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.round(n));
}

/** Masks a NIK down to its last 4 digits - we never persist the full number. */
export function maskNIK(v: string): string | null {
  const d = v.replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : null;
}

export type FieldErrors = Record<string, string>;

export function firstError(errors: FieldErrors): string | null {
  const k = Object.keys(errors)[0];
  return k ? errors[k]! : null;
}
