import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

/** Authenticate through the existing private boundary before observing demo-only actions. */
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Finish the real session before installing request observation. */ (url) => url.pathname === '/',
  );
}
/** Observe only endpoint names, without recording credentials or banking payloads. */
function writes(page: Page) {
  const mutations: string[] = [];
  page.context().on(
    'request',
    /** A synthetic operation must never issue a real write or remote bank request. */ (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/v1/') && !['GET', 'HEAD'].includes(request.method()))
        mutations.push(url.pathname);
      // The existing static browser harness serves Nuxt UI's missing Lucide assets through Iconify.
      const iconAsset =
        url.hostname === 'api.iconify.design' && url.pathname === '/lucide.json' && request.method() === 'GET';
      if (!['localhost', '127.0.0.1'].includes(url.hostname) && !iconAsset) mutations.push('unexpected-remote-origin');
    },
  );
  return mutations;
}

test('racing demo tabs serialize writes and explicitly recover without changing real records', /** Both commands queue behind an actual browser Web Lock so the race is deterministic. */ async ({
  page,
}, info) => {
  await login(page);
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  const mutations = writes(page);
  await page.goto('/wealth');
  const other = await page.context().newPage();
  await other.goto('/wealth');
  const first = page.getByRole('region', { name: 'Investment-Demo', exact: true });
  const second = other.getByRole('region', { name: 'Investment-Demo', exact: true });
  await expect(first).toContainText('13.734,50 €');
  await expect(second).toContainText('13.734,50 €');
  await page.evaluate(
    /** Hold the same origin-wide lock used by the product while both writers queue. */ () =>
      new Promise<void>(
        /** Resolve only after acquiring the gate lock. */ (acquired) => {
          let release!: () => void;
          const gate = new Promise<void>(
            /** Keep the gate closed until both UI actions are pending. */ (resolveGate) => {
              release = resolveGate;
            },
          );
          (window as Window & { releaseDemoLock?: () => void }).releaseDemoLock = release;
          void navigator.locks.request(
            'haushaltsbuch-demo-v1',
            /** Release only when the test explicitly opens the race gate. */ async () => {
              acquired();
              await gate;
            },
          );
        },
      ),
  );
  await first.getByLabel('Simulierte Änderung in Basispunkten').fill('100');
  await second.getByLabel('Simulierte Änderung in Basispunkten').fill('200');
  await first.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true }).click();
  await second.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true })).toBeDisabled();
  await expect(second.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true })).toBeDisabled();
  await page.evaluate(
    /** Allow the browser's queued compare/write transactions to run in order. */ () =>
      (window as Window & { releaseDemoLock?: () => void }).releaseDemoLock?.(),
  );
  await expect(first).toContainText('Demo-Szenario gespeichert.');
  await expect(second).toContainText('Demo-Daten wurden in einem anderen Tab geändert.');
  await expect(second.getByRole('button', { name: 'Demo zurücksetzen', exact: true })).toBeDisabled();
  const winner = await page.evaluate(
    /** Read only the dedicated synthetic winner, never a real financial ID. */ () =>
      JSON.parse(localStorage.getItem('haushaltsbuch-demo-v1')!),
  );
  expect(winner.revision).toBe(1);
  expect(winner.scenarioBps).toBe(100);
  expect(winner.activity).toHaveLength(1);
  await second.getByRole('button', { name: 'Demo neu laden', exact: true }).click();
  await expect(second.getByLabel('Simulierte Änderung in Basispunkten')).toHaveValue('100');
  await second.getByLabel('Simulierte Änderung in Basispunkten').fill('200');
  await second.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true }).click();
  await expect(second).toContainText('Demo-Szenario gespeichert.');
  await expect(first).toContainText('Demo-Daten wurden in einem anderen Tab geändert.');
  expect(
    await page.evaluate(
      /** Recovery advances the existing revision rather than overwriting revision one. */ () =>
        JSON.parse(localStorage.getItem('haushaltsbuch-demo-v1')!).revision,
    ),
  ).toBe(2);
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
  expect(mutations).toEqual([]);
  await other.screenshot({ path: `.local/concept-demo-conflict-${info.project.name}.png`, fullPage: true });
  await other.close();
});

test('corrupt and unsupported demo data require a cancellable confirmed replacement', /** Invalid storage cannot silently seed and overwrite an unknown payload. */ async ({
  page,
}) => {
  await login(page);
  const mutations = writes(page);
  for (const raw of [
    'invalid-json',
    JSON.stringify({ schemaVersion: 999, valuableFutureData: 'preserve until confirmed' }),
  ]) {
    await page.evaluate(
      /** Modify only this test's dedicated demo namespace. */ (value) =>
        localStorage.setItem('haushaltsbuch-demo-v1', value),
      raw,
    );
    await page.goto('/wealth');
    const portfolio = page.getByRole('region', { name: 'Investment-Demo', exact: true });
    await expect(portfolio.getByRole('alert')).toContainText(
      'Demo-Speicher ist beschädigt oder seine Version wird nicht unterstützt.',
    );
    await expect(portfolio.getByRole('button', { name: 'Kauf / Verkauf simulieren', exact: true })).toBeDisabled();
    await portfolio.getByRole('button', { name: 'Demo zurücksetzen', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Demo zurücksetzen', exact: true });
    await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(
      await page.evaluate(
        /** Cancel retains the exact invalid payload for explicit recovery. */ () =>
          localStorage.getItem('haushaltsbuch-demo-v1'),
      ),
    ).toBe(raw);
    await portfolio.getByRole('button', { name: 'Demo zurücksetzen', exact: true }).click();
    await dialog.getByRole('button', { name: 'Nur Demo-Daten zurücksetzen', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(portfolio.getByRole('button', { name: 'Kauf / Verkauf simulieren', exact: true })).toBeEnabled();
    expect(
      await page.evaluate(
        /** Only confirmed recovery writes a supported seed. */ () =>
          JSON.parse(localStorage.getItem('haushaltsbuch-demo-v1')!).schemaVersion,
      ),
    ).toBe(1);
  }
  expect(mutations).toEqual([]);
});

for (const failure of ['read', 'write'] as const) {
  test(`blocked demo ${failure} remains visibly memory-only without real mutations`, /** Denied reads and quota failures preserve a usable simulation without unsafe persistent retries. */ async ({
    page,
  }) => {
    await page.addInitScript(
      /** Fail only the dedicated namespace; leave login/theme/preferences storage intact. */ (operation) => {
        const get = Storage.prototype.getItem,
          set = Storage.prototype.setItem;
        (window as Window & { demoWriteAttempts?: number }).demoWriteAttempts = 0;
        Storage.prototype.getItem = /** Simulate a security denial on synthetic reads only. */ function (key) {
          if (key === 'haushaltsbuch-demo-v1' && operation === 'read')
            throw new DOMException('blocked', 'SecurityError');
          return get.call(this, key);
        };
        Storage.prototype.setItem =
          /** Simulate an atomic quota failure and count attempted synthetic writes. */ function (key, value) {
            if (key === 'haushaltsbuch-demo-v1') {
              const harness = window as Window & { demoWriteAttempts?: number };
              harness.demoWriteAttempts = (harness.demoWriteAttempts ?? 0) + 1;
              if (operation === 'write') throw new DOMException('quota', 'QuotaExceededError');
            }
            return set.call(this, key, value);
          };
      },
      failure,
    );
    await login(page);
    const mutations = writes(page);
    const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
    await page.goto('/wealth');
    const portfolio = page.getByRole('region', { name: 'Investment-Demo', exact: true });
    await portfolio.getByLabel('Simulierte Änderung in Basispunkten').fill('100');
    await portfolio.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true }).click();
    await expect(portfolio).toContainText('Nur im Arbeitsspeicher: Änderungen gehen beim Neuladen verloren.');
    await expect(portfolio.getByLabel('Simulierte Änderung in Basispunkten')).toHaveValue('100');
    await portfolio.getByLabel('Simulierte Änderung in Basispunkten').fill('200');
    await portfolio.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true }).click();
    await expect(portfolio.getByLabel('Simulierte Änderung in Basispunkten')).toHaveValue('200');
    expect(
      await page.evaluate(
        /** Subsequent memory actions do not retry a failed persistent write. */ () =>
          (window as Window & { demoWriteAttempts?: number }).demoWriteAttempts,
      ),
    ).toBe(failure === 'write' ? 1 : 0);
    await page.reload();
    await expect(portfolio.getByLabel('Simulierte Änderung in Basispunkten')).toHaveValue('0');
    expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
    expect(mutations).toEqual([]);
  });
}
