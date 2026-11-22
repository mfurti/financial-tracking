import { it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse } from 'yaml';
import { mkdir, mkdtemp, readFile, realpath, symlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { testDatabase } from './database.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { createApp } from '../apps/api/src/app.js';
import * as currentContracts from '../packages/contracts/src/index.js';

/** The approved feature base, before either additive integrated-concept migration. */
const baseline = '1f8d113bfa9294707bcd3b6ea6a3a03e8e12ec62';
const preRebuildBase = '740f2103a068c9401d9c1e194b3986a12983eeae';
const run = promisify(execFile);

/** Lockfile records needed to rebuild the old API against installed immutable resolutions. */
type RuntimeLock = {
  importers: Record<
    string,
    { dependencies?: Record<string, { version: string }>; devDependencies?: Record<string, { version: string }> }
  >;
  packages: Record<string, unknown>;
  snapshots: Record<string, { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> }>;
};

/** Compare the archived API and compiler dependency closures while allowing additive app packages. */
function assertPreviousRuntime(previous: RuntimeLock, current: RuntimeLock) {
  const verified = new Set<string>();
  /** Compare every reachable snapshot, including optional resolutions and package integrity. */
  function verify(name: string, version: string) {
    if (version.startsWith('link:')) return;
    const key = `${name}@${version}`;
    if (verified.has(key)) return;
    verified.add(key);
    const oldSnapshot = previous.snapshots[key];
    expect(oldSnapshot, key).toBeDefined();
    expect(current.snapshots[key], key).toEqual(oldSnapshot);
    const packageKey = key.split('(')[0]!;
    expect(current.packages[packageKey], packageKey).toEqual(previous.packages[packageKey]);
    for (const [name, version] of Object.entries({
      ...oldSnapshot?.dependencies,
      ...oldSnapshot?.optionalDependencies,
    }))
      verify(name, version);
  }
  for (const path of ['apps/api', 'packages/contracts'] as const) {
    const archived = previous.importers[path]?.dependencies ?? {};
    const installed = current.importers[path]?.dependencies ?? {};
    for (const [name, dependency] of Object.entries(archived)) {
      expect(installed[name], name).toEqual(dependency);
      verify(name, dependency.version);
    }
  }
  const compiler = previous.importers['.']?.devDependencies?.typescript;
  expect(compiler).toBeDefined();
  expect(current.importers['.']?.devDependencies?.typescript).toEqual(compiler);
  verify('typescript', compiler!.version);
}

/** Rebuild actual baseline sources, contracts and generated Prisma client without changing this checkout. */
async function previousApplication(revision: string) {
  try {
    await run('git', ['cat-file', '-e', `${revision}^{commit}`]);
  } catch {
    // A shallow CI checkout may retrieve only this reviewed immutable commit using its existing read-only origin credentials.
    await run('git', ['fetch', '--no-tags', '--depth=1', 'origin', revision], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  }
  await mkdir('.local', { recursive: true });
  const root = await mkdtemp(resolve('.local/previous-app-'));
  await run('git', ['archive', revision, '--output', resolve(root, 'source.tar')]);
  await run('tar', ['-xf', resolve(root, 'source.tar'), '-C', root]);
  await symlink(await realpath('node_modules'), resolve(root, 'node_modules'), 'junction');
  await symlink(
    await realpath('packages/contracts/node_modules'),
    resolve(root, 'packages/contracts/node_modules'),
    'junction',
  );
  const api = resolve(root, 'apps/api');
  const manifest = JSON.parse(await readFile(resolve(api, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  assertPreviousRuntime(
    parse(await readFile(resolve(root, 'pnpm-lock.yaml'), 'utf8')) as RuntimeLock,
    parse(await readFile('pnpm-lock.yaml', 'utf8')) as RuntimeLock,
  );
  for (const name of Object.keys(manifest.dependencies)) {
    const destination = resolve(api, 'node_modules', name);
    await mkdir(dirname(destination), { recursive: true });
    await symlink(
      name === '@financial-tracking/contracts'
        ? resolve(root, 'packages/contracts')
        : await realpath(resolve('apps/api/node_modules', name)),
      destination,
      'junction',
    );
  }
  await run(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], {
    cwd: resolve(root, 'packages/contracts'),
  });
  await run(process.execPath, [resolve('apps/api/node_modules/prisma/build/index.js'), 'generate'], { cwd: api });
  await run(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: api });
  const oldApp = (await import(
    pathToFileURL(resolve(api, 'dist/app.js')).href
  )) as typeof import('../apps/api/src/app.js');
  const oldDb = (await import(
    pathToFileURL(resolve(api, 'dist/db.js')).href
  )) as typeof import('../apps/api/src/db.js');
  const contracts = (await import(
    pathToFileURL(resolve(root, 'packages/contracts/dist/index.js')).href
  )) as typeof currentContracts;
  return { ...oldApp, ...oldDb, contracts };
}

it.each([baseline, preRebuildBase])(
  'runs archived API %s without changing frozen or financial values',
  /** Old compiled controllers/contracts and the old generated client must read and write the expanded schema; current readers must still accept their output. */ async (
    revision,
  ) => {
    const previous = await previousApplication(revision);
    const resource = await testDatabase();
    const oldDb = previous.createDb(resource.url);
    let oldService: Awaited<ReturnType<typeof createApp>> | undefined;
    let newService: Awaited<ReturnType<typeof createApp>> | undefined;
    try {
      const owner = await resource.db.user.create({
        data: { username: 'previous-owner', passwordHash: await passwordHash('previous-app-test-password') },
      });
      const connection = await resource.db.bankConnection.create({
        data: { name: 'Previous source', bankCode: '69050001', connectorType: 'CSV' },
      });
      const account = await resource.db.account.create({
        data: { name: 'Previous account', bankConnectionId: connection.id },
      });
      const booking = await resource.db.transaction.create({
        data: {
          accountId: account.id,
          bookingDate: new Date('2026-10-15'),
          amountCents: -9007199254740993n,
          description: 'Previous exact expense',
        },
      });
      await resource.db.transaction.create({
        data: { bookingDate: new Date('2026-10-16'), amountCents: 99n, description: 'Previous accountless income' },
      });
      await resource.db.ownerProfile.create({ data: { userId: owner.id, displayName: 'Expanded owner' } });
      await resource.db.accountGroup.create({
        data: { name: 'Expanded group', members: { create: { accountId: account.id } } },
      });
      await resource.db.accountPresentation.create({ data: { accountId: account.id, reserveEligible: true } });
      await resource.db.notificationAcknowledgement.create({
        data: { userId: owner.id, sourceKey: 'previous-compatibility-source' },
      });
      const record = await resource.db.wealthRecord.create({
        data: {
          idempotencyKey: 'previous-compatibility',
          coverage: 'COMPLETE',
          totalCents: -9007199254740993n,
          components: {
            create: {
              accountId: account.id,
              sourceLabel: 'Frozen original',
              sourceType: 'LEGACY',
              amountCents: -9007199254740993n,
              observedAt: new Date('2026-10-15'),
            },
          },
        },
        include: { components: true },
      });
      const metadata = {
        profile: await resource.db.ownerProfile.findMany(),
        groups: await resource.db.accountGroup.findMany({ include: { members: true } }),
        presentation: await resource.db.accountPresentation.findMany(),
        goal: await resource.db.reserveGoal.findMany(),
        acknowledgements: await resource.db.notificationAcknowledgement.findMany(),
      };
      const financialRows = await resource.db.transaction.findMany({ orderBy: { id: 'asc' } });
      oldService = await previous.createApp(oldDb);
      await oldService.app.getHttpAdapter().getInstance().ready();
      expect((await oldService.app.inject({ method: 'GET', url: '/api/v1/accounts' })).statusCode).toBe(401);
      const login = await oldService.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'previous-owner', password: 'previous-app-test-password' },
      });
      expect(login.statusCode).toBe(201);
      const headers = {
        origin: 'http://localhost:3000',
        cookie: String(login.headers['set-cookie']).split(';')[0]!,
        'x-csrf-token': String(login.json().csrfToken),
      };
      for (const [url, schema] of [
        ['/api/v1/accounts', previous.contracts.accountSchema.array()],
        ['/api/v1/transactions?limit=100', previous.contracts.transactionPageSchema],
        ['/api/v1/analytics/monthly?month=2026-10', previous.contracts.monthlySchema],
        ['/api/v1/analytics/overview?from=2026-10-01&to=2026-10-31', previous.contracts.analyticsOverviewSchema],
      ] as const) {
        const response = await oldService.app.inject({ method: 'GET', url, headers });
        expect(response.statusCode, url).toBe(200);
        expect(schema.safeParse(response.json()).success, url).toBe(true);
      }
      const monthly = await oldService.app.inject({
        method: 'GET',
        url: '/api/v1/analytics/monthly?month=2026-10',
        headers,
      });
      expect(monthly.json()).toMatchObject({
        incomeCents: '99',
        expenseCents: '9007199254740993',
        netCents: '-9007199254740894',
      });
      const denied = await oldService.app.inject({
        method: 'PATCH',
        url: `/api/v1/accounts/${account.id}`,
        headers: { ...headers, 'x-csrf-token': 'invalid' },
        payload: { name: 'Rejected' },
      });
      expect(denied.statusCode).toBe(403);
      const renamed = await oldService.app.inject({
        method: 'PATCH',
        url: `/api/v1/accounts/${account.id}`,
        headers,
        payload: { name: 'Previous application writer' },
      });
      expect(renamed.statusCode).toBe(200);
      expect(previous.contracts.accountSchema.parse(renamed.json()).name).toBe('Previous application writer');
      expect(currentContracts.accountSchema.safeParse(renamed.json()).success).toBe(true);
      expect(await resource.db.transaction.findUnique({ where: { id: booking.id } })).toEqual(booking);
      expect(await resource.db.transaction.findMany({ orderBy: { id: 'asc' } })).toEqual(financialRows);
      expect(await resource.db.user.findUnique({ where: { id: owner.id } })).toEqual(owner);
      expect(
        await resource.db.wealthRecord.findUnique({ where: { id: record.id }, include: { components: true } }),
      ).toEqual(record);
      expect({
        profile: await resource.db.ownerProfile.findMany(),
        groups: await resource.db.accountGroup.findMany({ include: { members: true } }),
        presentation: await resource.db.accountPresentation.findMany(),
        goal: await resource.db.reserveGoal.findMany(),
        acknowledgements: await resource.db.notificationAcknowledgement.findMany(),
      }).toEqual(metadata);
      newService = await createApp(resource.db);
      await newService.app.getHttpAdapter().getInstance().ready();
      const current = await newService.app.inject({ method: 'GET', url: '/api/v1/accounts', headers });
      expect(current.statusCode).toBe(200);
      expect(previous.contracts.accountSchema.array().safeParse(current.json()).success).toBe(true);
      expect(currentContracts.accountSchema.array().parse(current.json())[0]?.name).toBe('Previous application writer');
      expect(
        (await newService.app.inject({ method: 'GET', url: '/api/v1/workspace/profile', headers })).json(),
      ).toMatchObject({ displayName: 'Expanded owner' });
    } finally {
      await newService?.app.close();
      await oldService?.app.close();
      await oldDb.$disconnect();
      await resource.close();
    }
  },
  180000,
);
