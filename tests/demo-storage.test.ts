import { describe, expect, it } from 'vitest';
import {
  commitDemoStorage,
  demoStorageKey,
  DemoConflictError,
  readDemoStorage,
  resetDemoStorage,
  type DemoLock,
  type DemoStorage,
} from '../apps/web/app/utils/demo-storage.js';
import { seedDemoState } from '../apps/web/app/utils/demo-state.js';

/** Owned fake origin models atomic string writes and never touches real browser namespaces. */
function fixture() {
  const data = new Map<string, string>([
    ['real-preferences', 'keep'],
    ['session', 'untouched'],
  ]);
  const storage: DemoStorage = {
    getItem: /** Read only the requested synthetic key. */ (key) => data.get(key) ?? null,
    setItem: /** Replace one complete JSON string atomically. */ (key, value) => {
      data.set(key, value);
    },
  };
  let tail: Promise<unknown> = Promise.resolve();
  const lock: DemoLock = /** Serialize complete transactions just as origin-scoped Web Locks do. */ <T>(
    work: () => T | Promise<T>,
  ): Promise<T> => {
    const result = tail.then(work);
    tail = result.catch(/** A rejected writer cannot poison the next lock holder. */ () => undefined);
    return result;
  };
  return { data, storage, lock };
}
/** Explicit deterministic command needs no background task or API. */
const action = { kind: 'scenario', basisPoints: 100 };
/** Stable synthetic clock for replay and conflict assertions. */
const at = '2026-11-30T12:00:00.000Z';

describe('dedicated demo persistence', /** Validate recovery and serialized cross-tab commits independently of browser storage. */ () => {
  it('persists and reloads a validated revision without touching unrelated keys', /** A real/device namespace cannot enter or be cleared by the demo store. */ async () => {
    const { storage, lock, data } = fixture();
    const initial = readDemoStorage(storage);
    const next = await commitDemoStorage(initial, action, 'demo-action', at, storage, lock);
    expect(next.status).toBe('ready');
    expect(next.state.revision).toBe(1);
    expect(readDemoStorage(storage)).toEqual(next);
    expect([...data.keys()].sort()).toEqual([demoStorageKey, 'real-preferences', 'session'].sort());
    expect(data.get('session')).toBe('untouched');
    const replay = await commitDemoStorage(next, action, 'demo-action', at, storage, lock);
    expect(replay).toEqual(next);
  });
  it('serializes racing initial writers and requires explicit reload before retry', /** Compare/write inside a lock prevents both tabs from accepting revision one. */ async () => {
    const { storage, lock } = fixture();
    const first = readDemoStorage(storage),
      second = readDemoStorage(storage);
    const results = await Promise.allSettled([
      commitDemoStorage(first, action, 'demo-one', at, storage, lock),
      commitDemoStorage(second, { kind: 'scenario', basisPoints: 200 }, 'demo-two', at, storage, lock),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    if (results[1].status === 'rejected') expect(results[1].reason).toBeInstanceOf(DemoConflictError);
    const reloaded = readDemoStorage(storage);
    expect(reloaded.state.scenarioBps).toBe(100);
    const retry = await commitDemoStorage(
      reloaded,
      { kind: 'scenario', basisPoints: 200 },
      'demo-two',
      at,
      storage,
      lock,
    );
    expect(retry.state.revision).toBe(2);
    expect(retry.state.activity).toHaveLength(2);
  });
  it('detects equal-revision replacement, deletion and stale reset without overwriting', /** Revision alone cannot identify a changed stored payload. */ async () => {
    const { storage, lock, data } = fixture();
    data.set(demoStorageKey, JSON.stringify(seedDemoState()));
    const loaded = readDemoStorage(storage);
    const changed = seedDemoState();
    changed.roles[0]!.name = 'Anderer Tab';
    data.set(demoStorageKey, JSON.stringify(changed));
    await expect(commitDemoStorage(loaded, action, 'demo-stale', at, storage, lock)).rejects.toBeInstanceOf(
      DemoConflictError,
    );
    await expect(resetDemoStorage(loaded, true, storage, lock)).rejects.toBeInstanceOf(DemoConflictError);
    expect(readDemoStorage(storage).state.roles[0]!.name).toBe('Anderer Tab');
    const beforeDelete = readDemoStorage(storage);
    data.delete(demoStorageKey);
    await expect(commitDemoStorage(beforeDelete, action, 'demo-stale', at, storage, lock)).rejects.toBeInstanceOf(
      DemoConflictError,
    );
    expect(data.has(demoStorageKey)).toBe(false);
  });
  it.each(['not-json', '{}', JSON.stringify({ ...seedDemoState(), accounts: [] })])(
    'preserves corrupt state until confirmed reset: %s',
    /** Loading never destroys corrupt data or silently persists a replacement seed. */ async (raw) => {
      const { storage, lock, data } = fixture();
      data.set(demoStorageKey, raw);
      const loaded = readDemoStorage(storage);
      expect(loaded.status).toBe('corrupt');
      await expect(commitDemoStorage(loaded, action, 'demo-invalid', at, storage, lock)).rejects.toThrow(
        /zurücksetzen/,
      );
      expect(await resetDemoStorage(loaded, false, storage, lock)).toBe(loaded);
      expect(data.get(demoStorageKey)).toBe(raw);
      const reset = await resetDemoStorage(loaded, true, storage, lock);
      expect(reset.state).toEqual({ ...seedDemoState(), revision: 1 });
      expect(reset.status).toBe('ready');
      expect(data.get('real-preferences')).toBe('keep');
    },
  );
  it('never guesses an unsupported historical or future schema migration', /** Version one is the first published shape; unknown schemas require confirmed replacement. */ async () => {
    const { storage, lock, data } = fixture();
    for (const schemaVersion of [0, 2]) {
      const raw = JSON.stringify({ ...seedDemoState(), schemaVersion });
      data.set(demoStorageKey, raw);
      const loaded = readDemoStorage(storage);
      expect(loaded.status).toBe('unsupported');
      await expect(commitDemoStorage(loaded, action, 'demo-version', at, storage, lock)).rejects.toThrow();
      expect(data.get(demoStorageKey)).toBe(raw);
      expect((await resetDemoStorage(loaded, true, storage, lock)).state.schemaVersion).toBe(1);
    }
  });
  it('keeps blocked reads, quota failures and unavailable locks visibly memory-only', /** Unsafe localStorage compare/write without a lock is never used as concurrency protection. */ async () => {
    const { storage, lock, data } = fixture();
    const blocked: DemoStorage = {
      getItem: /** Simulate denied device access. */ () => {
        throw new Error('blocked');
      },
      setItem: storage.setItem,
    };
    const memory = readDemoStorage(blocked);
    expect(memory.status).toBe('memory');
    expect((await commitDemoStorage(memory, action, 'demo-memory', at, blocked, lock)).state.revision).toBe(1);
    const quota: DemoStorage = {
      getItem: storage.getItem,
      setItem: /** Simulate an atomic quota rejection. */ () => {
        throw new Error('quota');
      },
    };
    expect((await commitDemoStorage(readDemoStorage(quota), action, 'demo-quota', at, quota, lock)).status).toBe(
      'memory',
    );
    expect((await commitDemoStorage(readDemoStorage(storage), action, 'demo-no-lock', at, storage, null)).status).toBe(
      'memory',
    );
    expect(data.has(demoStorageKey)).toBe(false);
    expect(data.get('session')).toBe('untouched');
    expect(readDemoStorage(null).status).toBe('memory');
  });
  it('does not persist or partially mutate rejected commands', /** Pure validation failures precede any storage write. */ async () => {
    const { storage, lock, data } = fixture();
    const snapshot = readDemoStorage(storage);
    await expect(
      commitDemoStorage(
        snapshot,
        { kind: 'buy', accountId: 'demo-cash', securityId: 'demo-world', quantity: 1000 },
        'demo-reject',
        at,
        storage,
        lock,
      ),
    ).rejects.toThrow();
    expect(data.has(demoStorageKey)).toBe(false);
    expect(snapshot.state).toEqual(seedDemoState());
  });
});
