/**
 * Application context: session, live store subscription, and toasts.
 *
 * One provider rather than four, because all three concerns share the same
 * re-render trigger — a store write. `useSyncExternalStore` subscribes the
 * whole tree to the local store's version counter, so any component reading
 * through the repository sees committed state without prop drilling or a
 * cache layer.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  useSyncExternalStore, type ReactNode,
} from 'react';
import { auth, store, seedIfEmpty, dues, guests, type Actor, type Profile } from '../db';

// ── Store subscription ──────────────────────────────────────────────────

let version = 0;
const bump = () => { version += 1; };
store.subscribe(bump);

function subscribe(cb: () => void): () => void {
  return store.subscribe(cb);
}
function getSnapshot(): number {
  return version;
}

/** Re-renders the calling component whenever the store commits a write. */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ── Toasts ──────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info';
  message: string;
}

// ── Context ─────────────────────────────────────────────────────────────

interface AppContextValue {
  profile: Profile | null;
  actor: Actor | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<Profile>;
  signOut: () => void;
  refresh: () => void;
  toasts: Toast[];
  toast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const v = useStoreVersion();

  // Boot: seed demo data, then restore any live session.
  useEffect(() => {
    let cancelled = false;
    seedIfEmpty()
      .then(() => {
        if (cancelled) return;
        // Housekeeping that would be a cron job against a real backend.
        dues.refreshOverdue();
        guests.refreshExpired();
        setProfile(auth.currentProfile());
      })
      .catch((err) => console.error('[boot] seed failed', err))
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  // Keep the session in step with store writes from any tab — a suspension
  // applied by an admin elsewhere ends this session on the next commit.
  useEffect(() => {
    if (!ready) return;
    const live = auth.currentProfile();
    setProfile((prev) => {
      if (prev?.id !== live?.id) return live;
      if (prev && live && prev.updated_at !== live.updated_at) return live;
      return prev;
    });
  }, [v, ready]);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, kind === 'error' ? 6000 : 3800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { profile: p } = await auth.login(email, password);
    setProfile(p);
    return p;
  }, []);

  const signOut = useCallback(() => {
    auth.logout();
    setProfile(null);
  }, []);

  const refresh = useCallback(() => setProfile(auth.currentProfile()), []);

  const actor: Actor | null = useMemo(
    () => (profile ? { id: profile.id, role: profile.role, status: profile.status } : null),
    [profile],
  );

  const value = useMemo<AppContextValue>(
    () => ({ profile, actor, ready, signIn, signOut, refresh, toasts, toast, dismissToast }),
    [profile, actor, ready, signIn, signOut, refresh, toasts, toast, dismissToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** For screens that are already behind a auth guard. */
export function useActor(): Actor {
  const { actor } = useApp();
  if (!actor) throw new Error('useActor used outside an authenticated route');
  return actor;
}

/**
 * Wraps a repository mutation so every screen gets the same error handling:
 * ValidationError and ForbiddenError surface their message as a toast,
 * anything unexpected is logged and reported generically.
 */
export function useAction() {
  const { toast } = useApp();
  return useCallback(
    <T,>(fn: () => T, successMessage?: string): T | null => {
      try {
        const result = fn();
        if (successMessage) toast(successMessage, 'success');
        return result;
      } catch (err) {
        const message =
          err instanceof Error && err.message ? err.message : 'Terjadi kesalahan. Coba lagi.';
        toast(message, 'error');
        if (!(err instanceof Error) || !['ValidationError', 'ForbiddenError', 'AuthError'].includes(err.name)) {
          console.error('[action]', err);
        }
        return null;
      }
    },
    [toast],
  );
}
