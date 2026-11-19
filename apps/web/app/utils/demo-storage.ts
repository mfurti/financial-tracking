import { demoStateSchema, seedDemoState, type DemoState } from './demo-state.js';
import { transitionDemo } from './demo-finance.js';

/** The only browser key this store may read or replace; real preferences remain independent. */
export const demoStorageKey = 'haushaltsbuch-demo-v1';
/** Minimal storage boundary supports quota/security failures without reading other namespaces. */
export type DemoStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
/** Web Locks serialize the entire read/compare/write, rather than pretending localStorage provides CAS. */
export type DemoLock = <T>(work: () => T | Promise<T>) => Promise<T>;
/** Persistence outcomes remain visible independently of usable synthetic values. */
export type DemoStorageStatus = 'ready' | 'memory' | 'corrupt' | 'unsupported' | 'conflict';
/** Raw identity detects conflicting equal-revision payloads and deletion as well as later revisions. */
export type DemoSnapshot = { state: DemoState; status: DemoStorageStatus; raw: string | null };
/** A stale tab must explicitly reload instead of silently overwriting another writer. */
export class DemoConflictError extends Error {
  constructor() {
    super('Demo-Daten wurden in einem anderen Tab geändert. Bitte neu laden.');
    this.name = 'DemoConflictError';
  }
}

/** Validate the only published schema; unsupported versions are never guessed or destructively migrated. */
export function readDemoStorage(storage: DemoStorage | null): DemoSnapshot {
  const fallback = seedDemoState();
  if (!storage) return { state: fallback, status: 'memory', raw: null };
  let raw: string | null;
  try {
    raw = storage.getItem(demoStorageKey);
  } catch {
    return { state: fallback, status: 'memory', raw: null };
  }
  if (raw === null) return { state: fallback, status: 'ready', raw };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && parsed.schemaVersion !== 1)
      return { state: fallback, status: 'unsupported', raw };
    const state = demoStateSchema.safeParse(parsed);
    return state.success ? { state: state.data, status: 'ready', raw } : { state: fallback, status: 'corrupt', raw };
  } catch {
    return { state: fallback, status: 'corrupt', raw };
  }
}

/** Commit only under an origin-wide lock; unavailable persistence becomes explicit memory-only operation. */
async function writeDemoSnapshot(
  snapshot: DemoSnapshot,
  next: DemoState,
  storage: DemoStorage | null,
  lock: DemoLock | null,
): Promise<DemoSnapshot> {
  if (snapshot.status === 'memory' || !storage || !lock) return { state: next, status: 'memory', raw: snapshot.raw };
  return lock(
    /** Atomically compare the loaded identity and write a single validated JSON payload. */ () => {
      let current: string | null;
      try {
        current = storage.getItem(demoStorageKey);
      } catch {
        return { state: next, status: 'memory' as const, raw: snapshot.raw };
      }
      if (current !== snapshot.raw) throw new DemoConflictError();
      const raw = JSON.stringify(next);
      try {
        storage.setItem(demoStorageKey, raw);
      } catch {
        return { state: next, status: 'memory' as const, raw: snapshot.raw };
      }
      return { state: next, status: 'ready' as const, raw };
    },
  );
}

/** Validate and store one transition; corrupt/future/stale data requires an explicit recovery decision. */
export async function commitDemoStorage(
  snapshot: DemoSnapshot,
  action: unknown,
  id: string,
  at: string,
  storage: DemoStorage | null,
  lock: DemoLock | null,
): Promise<DemoSnapshot> {
  if (!['ready', 'memory'].includes(snapshot.status))
    throw new Error('Demo-Speicher zuerst neu laden oder bestätigt zurücksetzen.');
  const next = transitionDemo(snapshot.state, action, id, at);
  return writeDemoSnapshot(snapshot, next, storage, lock);
}

/** Replace only the dedicated simulation after confirmation; stale reset attempts still cannot overwrite. */
export async function resetDemoStorage(
  snapshot: DemoSnapshot,
  confirmed: boolean,
  storage: DemoStorage | null,
  lock: DemoLock | null,
): Promise<DemoSnapshot> {
  if (!confirmed) return snapshot;
  if (snapshot.status === 'conflict') throw new DemoConflictError();
  const state = seedDemoState();
  state.revision = snapshot.state.revision + 1;
  return writeDemoSnapshot(snapshot, demoStateSchema.parse(state), storage, lock);
}
