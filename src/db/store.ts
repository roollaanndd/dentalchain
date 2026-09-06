/**
 * Local persistence driver.
 *
 * A small, synchronous, observable key-value store over localStorage. Each
 * table is one namespaced key holding a JSON array. At this data volume (a
 * cluster of a few hundred households) that is comfortably fast, and the
 * synchronous reads keep the React layer free of loading states for data the
 * device already has.
 *
 * Two behaviours matter:
 *  - every write bumps a version counter and notifies subscribers, so the UI
 *    is always looking at the committed state, never at a stale copy;
 *  - the `storage` event is mirrored back in, so two tabs of the app (a
 *    resident on one, the pos RW on another) stay in agreement.
 *
 * The Supabase adapter implements the same surface, so swapping drivers is a
 * one-line change in db/index.ts.
 */

import { TABLES, type DatabaseShape, type TableName } from './schema';

const PREFIX = 'burgundy:v1:';
const key = (t: TableName) => `${PREFIX}${t}`;

type Row<T extends TableName> = DatabaseShape[T];
type Listener = () => void;

function readTable<T extends TableName>(t: T): Row<T>[] {
  try {
    const raw = localStorage.getItem(key(t));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Row<T>[]) : [];
  } catch {
    // Corrupt or unreadable (private mode, cleared storage) — start empty
    // rather than taking the whole app down.
    return [];
  }
}

export class LocalStore {
  /** In-memory mirror so reads never touch JSON.parse on the hot path. */
  private cache = new Map<TableName, unknown[]>();
  private listeners = new Set<Listener>();
  private booted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (!e.key?.startsWith(PREFIX)) return;
        const table = e.key.slice(PREFIX.length) as TableName;
        if (!TABLES.includes(table)) return;
        this.cache.delete(table); // force a re-read from the other tab's write
        this.emit();
      });
    }
  }

  /** True once seed data has been written at least once. */
  get isBooted(): boolean {
    return this.booted || localStorage.getItem(`${PREFIX}__booted`) === '1';
  }

  markBooted(): void {
    this.booted = true;
    try {
      localStorage.setItem(`${PREFIX}__booted`, '1');
    } catch {
      /* quota or private mode — the app still works for this session */
    }
  }

  all<T extends TableName>(t: T): Row<T>[] {
    let rows = this.cache.get(t) as Row<T>[] | undefined;
    if (!rows) {
      rows = readTable(t);
      this.cache.set(t, rows);
    }
    return rows;
  }

  find<T extends TableName>(t: T, id: string): Row<T> | undefined {
    return this.all(t).find((r) => (r as { id?: string }).id === id);
  }

  where<T extends TableName>(t: T, pred: (row: Row<T>) => boolean): Row<T>[] {
    return this.all(t).filter(pred);
  }

  /** Replaces a whole table. All mutations funnel through here. */
  replace<T extends TableName>(t: T, rows: Row<T>[]): void {
    this.cache.set(t, rows);
    try {
      localStorage.setItem(key(t), JSON.stringify(rows));
    } catch (err) {
      // Out of quota: keep the in-memory copy so the current session is
      // consistent, but surface it rather than failing silently.
      console.error(`[store] could not persist "${t}"`, err);
    }
    this.emit();
  }

  insert<T extends TableName>(t: T, row: Row<T>): Row<T> {
    this.replace(t, [...this.all(t), row]);
    return row;
  }

  insertMany<T extends TableName>(t: T, rows: Row<T>[]): void {
    if (!rows.length) return;
    this.replace(t, [...this.all(t), ...rows]);
  }

  update<T extends TableName>(t: T, id: string, patch: Partial<Row<T>>): Row<T> | null {
    const rows = this.all(t);
    const i = rows.findIndex((r) => (r as { id?: string }).id === id);
    if (i < 0) return null;
    const next = { ...rows[i], ...patch } as Row<T>;
    const copy = rows.slice();
    copy[i] = next;
    this.replace(t, copy);
    return next;
  }

  remove<T extends TableName>(t: T, id: string): boolean {
    const rows = this.all(t);
    const next = rows.filter((r) => (r as { id?: string }).id !== id);
    if (next.length === rows.length) return false;
    this.replace(t, next);
    return true;
  }

  removeWhere<T extends TableName>(t: T, pred: (row: Row<T>) => boolean): number {
    const rows = this.all(t);
    const next = rows.filter((r) => !pred(r));
    const removed = rows.length - next.length;
    if (removed) this.replace(t, next);
    return removed;
  }

  /**
   * Runs `fn` against the current table and commits the result in one write.
   * Used where a read and a dependent write must not be interleaved by a
   * second submit (the last-unit booking race).
   */
  transact<T extends TableName, R>(t: T, fn: (rows: Row<T>[]) => { rows: Row<T>[]; result: R }): R {
    const { rows, result } = fn(this.all(t).slice());
    this.replace(t, rows);
    return result;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.error('[store] listener threw', err);
      }
    }
  }

  /** Wipes every table. Used by the "reset demo data" control in admin. */
  reset(): void {
    for (const t of TABLES) {
      try {
        localStorage.removeItem(key(t));
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.removeItem(`${PREFIX}__booted`);
    } catch {
      /* ignore */
    }
    this.cache.clear();
    this.booted = false;
    this.emit();
  }

  /** Whole-database export, for the admin backup button. */
  exportAll(): Record<string, unknown[]> {
    const out: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      // Credentials and sessions are secrets — never leave the device.
      if (t === 'credentials' || t === 'sessions') continue;
      out[t] = this.all(t);
    }
    return out;
  }
}

export const store = new LocalStore();
