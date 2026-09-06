/**
 * Data layer entry point.
 *
 * Today this exports the local driver. When VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY are set, swap the repository import here for the
 * Supabase adapter — the call signatures are identical, so nothing in the UI
 * changes. The SQL that backs that adapter is already written and verified in
 * supabase/migrations/0001_init.sql.
 */

export * from './schema';
export * from './permissions';
export * from './availability';
export { store } from './store';
export { auth, AuthError } from './auth';
export { seedIfEmpty, resetAndReseed, DEMO_PASSWORD } from './seed';
export * from './repo';

/** True when a real backend is configured. Drives the badge in the UI. */
export const IS_REMOTE = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
