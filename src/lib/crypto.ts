/**
 * Password hashing via WebCrypto PBKDF2-SHA256.
 *
 * Honest scope note: in offline mode this runs in the resident's own browser,
 * so it protects against a *casual* read of stored data (a shared family
 * laptop, a synced profile folder) — it is not a server-side security
 * boundary, because there is no server. The real boundary is Supabase Auth +
 * the RLS policies in supabase/migrations/, which take over the moment the
 * VITE_SUPABASE_* env vars are set. What this does guarantee is that we never
 * write a plaintext password anywhere, ever.
 */

const ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-SHA256
const KEY_LEN = 32;

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function newSalt(): string {
  const s = new Uint8Array(16);
  crypto.getRandomValues(s);
  return b64(s);
}

export async function hashPassword(
  password: string,
  salt: string,
  iterations = ITERATIONS,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(salt) as BufferSource, iterations, hash: 'SHA-256' },
    key, KEY_LEN * 8,
  );
  return b64(new Uint8Array(bits));
}

/** Length-invariant comparison, so a wrong password can't be timed out. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(
  password: string, salt: string, expected: string, iterations = ITERATIONS,
): Promise<boolean> {
  return timingSafeEqual(await hashPassword(password, salt, iterations), expected);
}

export function newToken(): string {
  const t = new Uint8Array(32);
  crypto.getRandomValues(t);
  return b64(t).replace(/[+/=]/g, '');
}

export const PBKDF2_ITERATIONS = ITERATIONS;

/** Rejects the passwords that actually get people breached. */
export function passwordProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 8) out.push('Minimal 8 karakter');
  if (!/[a-z]/.test(pw)) out.push('Perlu huruf kecil');
  if (!/[A-Z]/.test(pw)) out.push('Perlu huruf besar');
  if (!/\d/.test(pw)) out.push('Perlu angka');
  const weak = ['password', '12345678', 'qwerty', 'admin', 'warga', 'burgundy', 'indonesia'];
  if (weak.some((w) => pw.toLowerCase().includes(w))) out.push('Terlalu mudah ditebak');
  return out;
}

export function passwordScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (passwordProblems(pw).length) s = Math.min(s, 2);
  return Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
}
