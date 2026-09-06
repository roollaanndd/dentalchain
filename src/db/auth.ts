/**
 * Authentication.
 *
 * Offline driver: PBKDF2 credentials in the local store, with a lockout after
 * repeated failures. When VITE_SUPABASE_URL is present this module delegates
 * to Supabase Auth instead (see supabaseAuth.ts) and none of the local
 * credential handling runs at all.
 */

import { store } from './store';
import type { AccountStatus, Credential, Profile, Role, Session } from './schema';
import { hashPassword, newSalt, newToken, PBKDF2_ITERATIONS, passwordProblems, verifyPassword } from '../lib/crypto';
import { clean, isEmail, isPhoneID, LIMITS, normaliseEmail } from '../lib/validate';
import { uid } from '../lib/id';

const SESSION_KEY = 'burgundy:v1:session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;      // 12 hours
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;               // 15 minutes

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const now = () => new Date().toISOString();

function findCredentialByEmail(email: string): Credential | undefined {
  return store.all('credentials').find((c) => c.email === email);
}

/**
 * A deliberately vague message. Telling an attacker which half of the pair
 * was wrong hands them a way to enumerate who lives here.
 */
const BAD_PAIR = 'Email atau kata sandi salah.';

export interface AuthResult {
  profile: Profile;
  session: Session;
}

export const auth = {
  /** Restores a session from storage if it is still valid. */
  currentSession(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      if (!s?.token || !s.user_id || typeof s.expires_at !== 'number') return null;
      if (Date.now() > s.expires_at) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  },

  currentProfile(): Profile | null {
    const s = auth.currentSession();
    if (!s) return null;
    const p = store.find('profiles', s.user_id);
    // A suspended account loses its session immediately, mid-visit.
    if (!p || p.status === 'suspended') {
      auth.logout();
      return null;
    }
    return p;
  },

  async register(input: {
    full_name: string; email: string; phone: string; password: string;
    house_id: string | null;
  }): Promise<{ profile: Profile; needsApproval: boolean }> {
    const full_name = clean(input.full_name, LIMITS.name);
    const email = normaliseEmail(input.email);
    const phone = clean(input.phone, LIMITS.phone);

    if (full_name.length < 2) throw new AuthError('Nama lengkap wajib diisi.');
    if (!isEmail(email)) throw new AuthError('Format email tidak valid.');
    if (!isPhoneID(phone)) throw new AuthError('Nomor HP tidak valid (contoh: 081234567890).');

    const problems = passwordProblems(input.password);
    if (problems.length) throw new AuthError(`Kata sandi belum aman: ${problems.join(', ').toLowerCase()}.`);

    if (findCredentialByEmail(email)) throw new AuthError('Email ini sudah terdaftar.');
    if (input.house_id && !store.find('houses', input.house_id)) {
      throw new AuthError('Rumah yang dipilih tidak ditemukan.');
    }

    const id = uid();
    const salt = newSalt();
    const hash = await hashPassword(input.password, salt);

    // Every new account starts pending. An RT/RW verifies that the person
    // actually lives here before they can see anything.
    const profile: Profile = {
      id, email, full_name, phone,
      role: 'resident' as Role,
      status: 'pending' as AccountStatus,
      house_id: input.house_id,
      avatar_url: null, occupation: null,
      emergency_name: null, emergency_phone: null,
      verified_at: null, created_at: now(), updated_at: now(),
    };

    store.insert('profiles', profile);
    store.insert('credentials', {
      user_id: id, email, hash, salt, iterations: PBKDF2_ITERATIONS,
      failed_attempts: 0, locked_until: null,
    });

    // Tell the people who can approve it.
    for (const officer of store.where('profiles', (p) =>
      p.status === 'active' && (p.role === 'rt' || p.role === 'rw' || p.role === 'admin'))) {
      store.insert('notifications', {
        id: uid(), user_id: officer.id, read: false, created_at: now(),
        title: 'Pendaftaran warga baru',
        body: `${full_name} mendaftar dan menunggu verifikasi.`,
        kind: 'system', link: '/admin/warga',
      });
    }

    return { profile, needsApproval: true };
  },

  async login(emailRaw: string, password: string): Promise<AuthResult> {
    const email = normaliseEmail(emailRaw);
    const cred = findCredentialByEmail(email);

    // Spend roughly the same time whether or not the account exists, so the
    // response time doesn't reveal which emails are registered.
    if (!cred) {
      await hashPassword(password, newSalt());
      throw new AuthError(BAD_PAIR);
    }

    if (cred.locked_until && Date.now() < cred.locked_until) {
      const mins = Math.ceil((cred.locked_until - Date.now()) / 60_000);
      throw new AuthError(`Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.`);
    }

    const ok = await verifyPassword(password, cred.salt, cred.hash, cred.iterations);
    if (!ok) {
      const attempts = cred.failed_attempts + 1;
      const locked = attempts >= MAX_ATTEMPTS;
      store.replace('credentials', store.all('credentials').map((c) =>
        c.user_id === cred.user_id
          ? { ...c, failed_attempts: locked ? 0 : attempts, locked_until: locked ? Date.now() + LOCKOUT_MS : null }
          : c));
      throw new AuthError(locked
        ? 'Terlalu banyak percobaan gagal. Akun dikunci sementara selama 15 menit.'
        : BAD_PAIR);
    }

    const profile = store.find('profiles', cred.user_id);
    if (!profile) throw new AuthError(BAD_PAIR);
    if (profile.status === 'suspended') {
      throw new AuthError('Akun Anda dinonaktifkan. Hubungi pengurus RW.');
    }
    if (profile.status === 'pending') {
      throw new AuthError('Akun Anda menunggu verifikasi pengurus RW.');
    }

    // Reset the failure counter on a good login.
    store.replace('credentials', store.all('credentials').map((c) =>
      c.user_id === cred.user_id ? { ...c, failed_attempts: 0, locked_until: null } : c));

    const session: Session = {
      token: newToken(), user_id: profile.id,
      issued_at: Date.now(), expires_at: Date.now() + SESSION_TTL_MS,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      throw new AuthError('Tidak dapat menyimpan sesi. Aktifkan penyimpanan situs di browser Anda.');
    }
    return { profile, session };
  },

  logout(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const cred = store.all('credentials').find((c) => c.user_id === userId);
    if (!cred) throw new AuthError('Akun tidak ditemukan.');
    if (!(await verifyPassword(oldPassword, cred.salt, cred.hash, cred.iterations))) {
      throw new AuthError('Kata sandi lama salah.');
    }
    const problems = passwordProblems(newPassword);
    if (problems.length) throw new AuthError(`Kata sandi baru belum aman: ${problems.join(', ').toLowerCase()}.`);
    if (await verifyPassword(newPassword, cred.salt, cred.hash, cred.iterations)) {
      throw new AuthError('Kata sandi baru harus berbeda dari yang lama.');
    }

    const salt = newSalt();
    const hash = await hashPassword(newPassword, salt);
    store.replace('credentials', store.all('credentials').map((c) =>
      c.user_id === userId
        ? { ...c, salt, hash, iterations: PBKDF2_ITERATIONS, failed_attempts: 0, locked_until: null }
        : c));
  },

  /** Officer-initiated reset. Returns the temporary password to hand over. */
  async resetPasswordFor(userId: string): Promise<string> {
    const cred = store.all('credentials').find((c) => c.user_id === userId);
    if (!cred) throw new AuthError('Akun tidak ditemukan.');
    const temp = `Br${newToken().slice(0, 8)}9`;
    const salt = newSalt();
    const hash = await hashPassword(temp, salt);
    store.replace('credentials', store.all('credentials').map((c) =>
      c.user_id === userId
        ? { ...c, salt, hash, iterations: PBKDF2_ITERATIONS, failed_attempts: 0, locked_until: null }
        : c));
    return temp;
  },

  /** Used by the seeder to create accounts without going through validation. */
  async seedAccount(profile: Profile, password: string): Promise<void> {
    const salt = newSalt();
    const hash = await hashPassword(password, salt);
    store.insert('profiles', profile);
    store.insert('credentials', {
      user_id: profile.id, email: profile.email, hash, salt,
      iterations: PBKDF2_ITERATIONS, failed_attempts: 0, locked_until: null,
    });
  },
};
