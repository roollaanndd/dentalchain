/**
 * Date helpers. Everything user-facing is Asia/Jakarta (WIB, UTC+7) and every
 * calendar date is handled as a plain `YYYY-MM-DD` string — never a Date
 * object — so a booking on the 5th never becomes the 4th for a user in a
 * different timezone.
 */

export const DAY_MS = 86_400_000;

export function todayISO(): string {
  // Shift into WIB before slicing, so "today" flips at midnight Jakarta time.
  const now = new Date();
  const wib = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
  return toISO(wib);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses YYYY-MM-DD as a UTC-noon Date — immune to DST and tz drift. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive day count: same start and end = 1 day. */
export function daysBetween(startISO: string, endISO: string): number {
  return Math.round((parseISO(endISO).getTime() - parseISO(startISO).getTime()) / DAY_MS) + 1;
}

/** Do two inclusive date ranges share at least one day? */
export function rangesOverlap(aS: string, aE: string, bS: string, bE: string): boolean {
  return aS <= bE && bS <= aE;
}

/** Do two "HH:MM" time ranges overlap? Touching endpoints do NOT overlap. */
export function timesOverlap(aS: string, aE: string, bS: string, bE: string): boolean {
  return aS < bE && bS < aE;
}

export function eachDay(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  for (let d = startISO; d <= endISO; d = addDays(d, 1)) {
    out.push(d);
    if (out.length > 400) break; // guard against a malformed range looping forever
  }
  return out;
}

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

export function formatDateID(iso: string, opts: { weekday?: boolean; short?: boolean } = {}): string {
  const d = parseISO(iso);
  const month = opts.short ? MONTHS_ID[d.getUTCMonth()]!.slice(0, 3) : MONTHS_ID[d.getUTCMonth()];
  const base = `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
  return opts.weekday ? `${DAYS_ID[d.getUTCDay()]}, ${base}` : base;
}

export function formatPeriodID(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS_ID[(m ?? 1) - 1]} ${y}`;
}

export function formatDateTimeID(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDateID(toISO(d), { short: true })} · ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

export function relativeID(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  if (Number.isNaN(diff)) return '—';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} hari lalu`;
  return formatDateID(toISO(new Date(isoTimestamp)), { short: true });
}

export function currentPeriod(): string {
  return todayISO().slice(0, 7);
}
