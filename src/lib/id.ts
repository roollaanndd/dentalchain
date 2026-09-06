/** Crypto-strong id helpers. No Math.random anywhere that matters. */

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I — read aloud at the pos RW

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function uid(): string {
  return crypto.randomUUID();
}

/** Unbiased pick from ALPHABET (32 chars divides 256 evenly, so modulo is safe here). */
export function shortCode(len = 5): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/**
 * Human-facing reference, e.g. `BR-P-4KX92`.
 * prefix: P=peminjaman, F=fasilitas, L=laporan, T=tamu
 */
export function refCode(prefix: 'P' | 'F' | 'L' | 'T'): string {
  return `BR-${prefix}-${shortCode(5)}`;
}

/** Normalises scanner/OCR confusions before matching a typed code. */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/O/g, '0').replace(/I/g, '1')
    // then map back into our alphabet, which excludes 0 and 1
    .replace(/0/g, 'O').replace(/1/g, 'L');
}
