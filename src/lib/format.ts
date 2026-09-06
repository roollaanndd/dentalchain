export function idr(amount: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(amount)) return 'Rp0';
  if (opts.compact && Math.abs(amount) >= 1_000_000) {
    return `Rp${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)} jt`;
  }
  if (opts.compact && Math.abs(amount) >= 1_000) {
    return `Rp${(amount / 1_000).toFixed(0)} rb`;
  }
  return 'Rp' + Math.round(amount).toLocaleString('id-ID');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** +62 normalisation for WhatsApp links. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  return digits;
}

export function pluralID(n: number, word: string): string {
  return `${n} ${word}`;
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}
