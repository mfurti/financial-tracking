import {
  commitDemoStorage,
  demoStorageKey,
  DemoConflictError,
  readDemoStorage,
  resetDemoStorage,
  type DemoLock,
  type DemoSnapshot,
  type DemoStorage,
} from '../utils/demo-storage';
import { seedDemoState } from '../utils/demo-state';
import type { DemoAction } from '../utils/demo-finance';

/** Share only dedicated synthetic state; every mutation stays outside useApi and real account models. */
export function useDemoPortfolio() {
  const snapshot = useState<DemoSnapshot>(
    'demo-portfolio',
    /** SSR has no device state; restore only on client mount. */ () => ({
      state: seedDemoState(),
      status: 'ready',
      raw: null,
    }),
  );
  const initialized = useState(
    'demo-initialized',
    /** Restore once across simultaneous portfolio children. */ () => false,
  );
  const saving = useState(
    'demo-saving',
    /** Serialize same-tab UI actions before acquiring the cross-tab lock. */ () => false,
  );
  const error = useState('demo-error', /** Recoverable errors preserve the visible form draft. */ () => '');
  const state = computed(
    /** Expose validated state without supplying arbitrary state replacement. */ () => snapshot.value.state,
  );
  const status = computed(
    /** Surface storage failures and stale-tab conflicts to every demo screen. */ () => snapshot.value.status,
  );

  /** Access blocked browser storage without failing SSR or navigation. */
  function storage(): DemoStorage | null {
    try {
      return import.meta.client ? localStorage : null;
    } catch {
      return null;
    }
  }
  /** Return the browser's origin-wide lock, or explicitly disable persistence on unsupported browsers. */
  function lock(): DemoLock | null {
    if (!import.meta.client || !navigator.locks) return null;
    return /** Hold a single named lock across the complete compare/write transaction. */ async <T>(
      work: () => T | Promise<T>,
    ): Promise<T> => await navigator.locks.request(demoStorageKey, work);
  }
  /** Explicit reload accepts another tab's version and clears a previous conflict notice. */
  function reload() {
    if (saving.value) return;
    snapshot.value = readDemoStorage(storage());
    if (!lock() && snapshot.value.status === 'ready') snapshot.value.status = 'memory';
    error.value = '';
  }
  /** Ignore unrelated keys and require reload before overwriting another tab's changed simulation. */
  function changed(event: StorageEvent) {
    if (
      (event.key === demoStorageKey || event.key === null) &&
      snapshot.value.status !== 'memory' &&
      event.newValue !== snapshot.value.raw
    )
      snapshot.value = { ...snapshot.value, status: 'conflict' };
  }
  onMounted(
    /** Restore and subscribe only in the browser; no synthetic state enters a real session. */ () => {
      if (!initialized.value) {
        reload();
        initialized.value = true;
      }
      window.addEventListener('storage', changed);
    },
  );
  onBeforeUnmount(
    /** Remove this consumer's listener without clearing shared portfolio state. */ () => {
      window.removeEventListener('storage', changed);
    },
  );

  /** Commit a validated action or confirmed reset and retain drafts on rejection. */
  async function apply(action: DemoAction | null) {
    if (saving.value) return false;
    saving.value = true;
    error.value = '';
    try {
      const previous = snapshot.value;
      snapshot.value = action
        ? await commitDemoStorage(
            previous,
            action,
            `demo-${crypto.randomUUID()}`,
            new Date().toISOString(),
            storage(),
            lock(),
          )
        : await resetDemoStorage(previous, true, storage(), lock());
      return true;
    } catch (caught) {
      if (caught instanceof DemoConflictError) snapshot.value = { ...snapshot.value, status: 'conflict' };
      error.value =
        caught instanceof Error && caught.name === 'ZodError'
          ? 'Demo-Eingaben prüfen: gültige Konten, ganze Anteile und positive Beträge wählen.'
          : caught instanceof Error
            ? caught.message
            : 'Demo-Aktion fehlgeschlagen.';
      return false;
    } finally {
      saving.value = false;
    }
  }
  /** Explicit simulation commands cannot alter a server-side financial resource. */
  function execute(action: DemoAction) {
    return apply(action);
  }
  /** Call only after a visible confirmation dialog accepts the dedicated demo reset. */
  function reset(confirmed: boolean) {
    return confirmed ? apply(null) : Promise.resolve(false);
  }
  return { state, status, saving, error, reload, execute, reset };
}
