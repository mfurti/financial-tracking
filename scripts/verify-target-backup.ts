import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { chromium, type Browser } from '@playwright/test';
import { freePort, testDatabase } from '../tests/database.js';
import { createApp } from '../apps/api/dist/app.js';
import { passwordHash } from '../apps/api/dist/auth.js';
import { createDb } from '../apps/api/dist/db.js';

if (process.env.CI || process.env.TEST_DATABASE_URL)
  throw new Error('Target backup checks require an owned local database, never CI/shared PostgreSQL.');
const [archiveArg, identityArg, ageArg, restoreArg] = process.argv.slice(2);
if (!archiveArg?.endsWith('.age') || !identityArg || !ageArg || !restoreArg)
  throw new Error('Usage: verify-target-backup.ts ARCHIVE.age IDENTITY AGE_EXECUTABLE PG_RESTORE_EXECUTABLE');
const archive = resolve(archiveArg),
  identity = resolve(identityArg),
  age = resolve(ageArg),
  restore = resolve(restoreArg);
await Promise.all([readFile(archive), readFile(identity)]);
process.env.FINTS_PRODUCT_ID = '';
process.env.FINTS_BANK_URL = '';
process.env.NODE_ENV = 'test';
const started = Date.now(),
  resource = await testDatabase({ empty: true, isolated: true });
let app: Awaited<ReturnType<typeof createApp>>['app'] | undefined,
  appDb: ReturnType<typeof createDb> | undefined,
  browser: Browser | undefined,
  web: ChildProcess | undefined;
let step = 'encrypted restore';

/** Wait for an owned child without ever printing its potentially sensitive output. */
async function completed(child: ChildProcess) {
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error('Owned recovery child failed');
}
/** Keep only in-memory rows for preservation comparison; never write them to logs or files. */
async function snapshot(connection: Client) {
  const tables = [
    'User',
    'BankConnection',
    'Account',
    'Transaction',
    'Category',
    'ImportRun',
    'ImportIssue',
    'TransactionIdentity',
    'TransferGroup',
  ];
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const table of tables) result[table] = (await connection.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
  return result;
}

try {
  const url = new URL(resource.url);
  const decrypt = spawn(age, ['--decrypt', '--identity', identity, archive], {
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });
  const importer = spawn(
    restore,
    [
      '--no-owner',
      '--no-privileges',
      '--single-transaction',
      '--host',
      url.hostname,
      '--port',
      url.port,
      '--username',
      decodeURIComponent(url.username),
      '--dbname',
      url.pathname.slice(1),
    ],
    {
      env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
    },
  );
  const timeout = setTimeout(
    /** Bound decryption/import subprocesses even if their streams stall. */ () => {
      decrypt.kill();
      importer.kill();
    },
    120_000,
  );
  try {
    await Promise.all([completed(decrypt), completed(importer), pipeline(decrypt.stdout!, importer.stdin!)]);
  } finally {
    clearTimeout(timeout);
    if (decrypt.exitCode === null) decrypt.kill();
    if (importer.exitCode === null) importer.kill();
  }

  const connection = new Client({ connectionString: resource.url });
  await connection.connect();
  try {
    const before = await snapshot(connection);
    assert.ok(before.User!.length > 0, 'Backup must contain an initialized application');
    step = 'forward migrations and preservation';
    await completed(
      spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
        cwd: resolve('apps/api'),
        env: { ...process.env, DATABASE_URL: resource.url },
        stdio: 'ignore',
        windowsHide: true,
      }),
    );
    const after = await snapshot(connection);
    for (const [table, rows] of Object.entries(before)) {
      assert.equal(after[table]!.length, rows.length);
      for (let index = 0; index < rows.length; index++)
        for (const [key, value] of Object.entries(rows[index]!)) assert.deepEqual(after[table]![index]![key], value);
    }

    step = 'isolated authentication and application';
    const user = await resource.db.user.findFirstOrThrow();
    const temporaryPassword = randomBytes(32).toString('hex');
    // Verify the original password hash was preserved above; rotate only the disposable copy to exercise login.
    await resource.db.user.update({
      where: { id: user.id },
      data: { passwordHash: await passwordHash(temporaryPassword) },
    });
    await resource.db.session.deleteMany();
    const port = await freePort();
    process.env.PUBLIC_APP_URL = `http://127.0.0.1:${port}`;
    appDb = createDb(resource.url);
    ({ app } = await createApp(appDb, false));
    await app.listen(0, '127.0.0.1');
    const apiUrl = await app.getUrl();
    web = spawn(process.execPath, ['apps/web/.output/server/index.mjs'], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: String(port),
        NUXT_API_INTERNAL_URL: apiUrl,
        NUXT_REQUIRE_TRUSTED_PROXY: 'false',
      },
      stdio: 'ignore',
      windowsHide: true,
    });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (web.exitCode !== null) throw new Error('Owned web fixture exited');
      try {
        ready = (await fetch(`http://127.0.0.1:${port}/health`)).ok;
      } catch {
        /* Startup is bounded by the retry count. */
      }
      if (ready) break;
      await new Promise(/** Allow the local web runtime to start. */ (done) => setTimeout(done, 100));
    }
    assert.ok(ready);
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/login`);
    await page.getByLabel('Benutzername', { exact: true }).fill(user.username);
    await page.getByLabel('Passwort', { exact: true }).fill(temporaryPassword);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.getByRole('heading', { name: 'Finanzieller Überblick' }).waitFor();
    for (const [path, table] of [
      ['accounts', 'Account'],
      ['categories', 'Category'],
      ['imports', 'ImportRun'],
    ] as const) {
      const response = await context.request.get(`http://127.0.0.1:${port}/api/v1/${path}`);
      assert.equal(response.status(), 200);
      assert.equal(
        (await response.json()).length,
        path === 'imports' ? Math.min(after[table]!.length, 100) : after[table]!.length,
      );
    }
    const transactionMonth =
      (await connection.query('SELECT to_char(max("bookingDate"), \'YYYY-MM\') AS month FROM "Transaction"')).rows[0]
        ?.month ?? '2026-11';
    const expected = (
      await connection.query(
        `SELECT COALESCE(SUM("amountCents"),0)::text AS net FROM "Transaction" WHERE status='BOOKED' AND NOT "isTransfer" AND "bookingDate">=$1::date AND "bookingDate"<($1::date + INTERVAL '1 month')`,
        [`${transactionMonth}-01`],
      )
    ).rows[0]!.net;
    const report = await context.request.get(
      `http://127.0.0.1:${port}/api/v1/analytics/monthly?month=${transactionMonth}`,
    );
    assert.equal(report.status(), 200);
    assert.equal((await report.json()).netCents, expected);
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://127.0.0.1:${port}/?month=${transactionMonth}`);
      await page.getByRole('heading', { name: 'Finanzieller Überblick' }).waitFor();
      assert.ok(
        await page.evaluate(
          /** Check restored UI geometry without taking financial screenshots. */ () =>
            document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    const proof = {
      archiveSha256: createHash('sha256')
        .update(await readFile(archive))
        .digest('hex'),
      durationSeconds: Math.ceil((Date.now() - started) / 1000),
      initializedBackup: true,
      populatedFinancialBackup: after.Transaction!.length > 0,
      preservation: true,
      forwardMigrations: true,
      isolatedPasswordRotation: true,
      login: true,
      accountsCategoriesHistory: true,
      monthlyReport: true,
      responsive: true,
      plaintextDumpFilesCreated: false,
    };
    process.stdout.write(`${JSON.stringify(proof)}\n`);
  } finally {
    await connection.end();
  }
} catch {
  process.stderr.write(`Isolated target backup check failed at: ${step}. No production mutation performed.\n`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (web && web.exitCode === null) {
    web.kill();
    await once(web, 'exit');
  }
  await app?.close();
  await appDb?.$disconnect();
  await resource.close();
}
