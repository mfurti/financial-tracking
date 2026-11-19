import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { WealthService } from '../apps/api/src/wealth.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import * as c from '../packages/contracts/src/index.js';

describe('server-derived recorded wealth', /** Freeze exact observed components without fabricating reconstructed bank history. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let service: WealthService;
  let known: string, missing: string, foreign: string, removable: string;
  const now = new Date('2035-02-01T12:00:00Z');
  beforeAll(
    /** Own synthetic balances and metadata in a disposable migrated database. */ async () => {
      resource = await testDatabase();
      service = new WealthService(resource.db);
      const connection = await resource.db.bankConnection.create({
        data: { name: 'Wealth fixture', bankCode: '69050001', connectorType: 'CSV' },
      });
      const run = await resource.db.importRun.create({ data: { source: 'CSV', status: 'COMPLETED' } });
      const accounts = await Promise.all([
        resource.db.account.create({ data: { name: 'Known signed source', bankConnectionId: connection.id } }),
        resource.db.account.create({ data: { name: 'Missing source', bankConnectionId: connection.id } }),
        resource.db.account.create({
          data: { name: 'Foreign source', currency: 'USD', bankConnectionId: connection.id },
        }),
        resource.db.account.create({ data: { name: 'Deleted unknown source', bankConnectionId: connection.id } }),
      ]);
      [known, missing, foreign, removable] = accounts.map(
        /** Keep each source identity explicit. */ (account) => account.id,
      ) as [string, string, string, string];
      await resource.db.balanceSnapshot.createMany({
        data: [
          { accountId: known, amountCents: -9007199254740993n, balanceType: 'BOOKED' },
          { accountId: known, amountCents: 99n, balanceType: 'AVAILABLE' },
          { accountId: missing, amountCents: 123n, balanceType: 'AVAILABLE' },
          { accountId: foreign, amountCents: 99999n, balanceType: 'BOOKED' },
        ].map(
          /** All observations preserve actual import and observation provenance. */ (entry) => ({
            ...entry,
            observedAt: new Date('2035-01-31'),
            importRunId: run.id,
            source: 'CSV',
          }),
        ),
      });
    },
  );
  afterAll(/** Remove only the owned synthetic database. */ async () => resource?.close());

  it('previews without writes and captures immutable signed/unknown/currency components exactly once', /** Repeating or concurrent confirmation keys must return the original source snapshot. */ async () => {
    const financialBefore = await resource.db.balanceSnapshot.findMany({ orderBy: { id: 'asc' } });
    const initial = await service.list(c.wealthRecordsQuerySchema.parse({}), now);
    expect(initial.items).toEqual([]);
    expect(initial.preview).toMatchObject({
      totalCents: '-9007199254740993',
      coverage: 'PARTIAL',
      observedCount: 1,
      componentCount: 4,
      recordable: true,
    });
    expect(await resource.db.wealthRecord.count()).toBe(0);
    const key = randomUUID();
    const records = await Promise.all([
      service.capture({ idempotencyKey: key }, now),
      service.capture({ idempotencyKey: key }, now),
    ]);
    expect(records[0]).toEqual(records[1]);
    expect(await resource.db.wealthRecord.count()).toBe(1);
    const first = records[0]!;
    expect(first).toMatchObject({
      totalCents: '-9007199254740993',
      coverage: 'PARTIAL',
      recordedAt: now.toISOString(),
    });
    expect(
      first.components.find(
        /** Keep a newer available value separate from booked wealth. */ (item) => item.accountId === known,
      ),
    ).toMatchObject({ amountCents: '-9007199254740993', sourceType: 'CSV', observedAt: '2035-01-31T00:00:00.000Z' });
    expect(
      first.components.find(
        /** Missing BOOKED remains unknown rather than observed zero. */ (item) => item.accountId === missing,
      ),
    ).toMatchObject({ amountCents: null, observedAt: null, sourceType: 'MISSING' });
    expect(
      first.components.find(
        /** Foreign cents must never be summed as EUR without conversion. */ (item) => item.accountId === foreign,
      ),
    ).toMatchObject({ amountCents: null, sourceType: 'UNSUPPORTED_CURRENCY:USD' });
    expect(await resource.db.balanceSnapshot.findMany({ orderBy: { id: 'asc' } })).toEqual(financialBefore);
    await resource.db.balanceSnapshot.updateMany({
      where: { accountId: known, balanceType: 'BOOKED' },
      data: { amountCents: 42n },
    });
    await resource.db.account.update({ where: { id: known }, data: { name: 'Later renamed source' } });
    await resource.db.account.delete({ where: { id: removable } });
    const replay = await service.capture({ idempotencyKey: key }, new Date('2035-02-02T12:00:00Z'));
    expect(replay.totalCents).toBe(first.totalCents);
    expect(replay.recordedAt).toBe(first.recordedAt);
    expect(
      replay.components.find(
        /** Frozen labels remain unchanged after source metadata edits. */ (item) => item.accountId === known,
      )?.sourceLabel,
    ).toBe('Known signed source');
    expect(
      replay.components.find(
        /** Deleted source identity becomes null while its original missing observation remains frozen. */ (item) =>
          item.sourceLabel === 'Deleted unknown source',
      ),
    ).toMatchObject({ accountId: null, amountCents: null });
  });

  it('paginates stable equal-time records without omissions and never accepts client real amounts', /** Cursor order is recordedAt then ID, independently of current source changes. */ async () => {
    for (let index = 0; index < 3; index++) await service.capture({ idempotencyKey: `page-${index}` }, now);
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await service.list(c.wealthRecordsQuerySchema.parse({ limit: 1, cursor }), now);
      ids.push(...page.items.map(/** Preserve every immutable public identity across pages. */ (record) => record.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toHaveLength(4);
    expect(c.wealthRecordInputSchema.safeParse({ idempotencyKey: 'bad', totalCents: '1' }).success).toBe(false);
    await expect(service.list(c.wealthRecordsQuerySchema.parse({ cursor: randomUUID() }), now)).rejects.toThrow();
  });

  it('rejects unrepresentable captures without truncating old source labels or altering history', /** Overflow and bounded source metadata block the new record rather than corrupting real observations. */ async () => {
    const connection = await resource.db.bankConnection.findFirstOrThrow();
    const account = await resource.db.account.create({
      data: { name: 'x'.repeat(121), bankConnectionId: connection.id },
    });
    const count = await resource.db.wealthRecord.count();
    expect((await service.list(c.wealthRecordsQuerySchema.parse({}), now)).preview).toMatchObject({
      recordable: false,
      blockingReason: 'SOURCE_LABEL_TOO_LONG',
    });
    await expect(service.capture({ idempotencyKey: 'long-label' }, now)).rejects.toThrow();
    expect((await resource.db.account.findUniqueOrThrow({ where: { id: account.id } })).name).toHaveLength(121);
    await resource.db.account.update({ where: { id: account.id }, data: { isActive: false } });
    const run = await resource.db.importRun.findFirstOrThrow();
    await resource.db.balanceSnapshot.updateMany({
      where: { accountId: known, balanceType: 'BOOKED' },
      data: { amountCents: 9223372036854775807n },
    });
    const extra = await resource.db.account.create({
      data: { name: 'Overflow source', bankConnectionId: connection.id },
    });
    await resource.db.balanceSnapshot.create({
      data: {
        accountId: extra.id,
        importRunId: run.id,
        source: 'CSV',
        balanceType: 'BOOKED',
        observedAt: now,
        amountCents: 1n,
      },
    });
    expect((await service.list(c.wealthRecordsQuerySchema.parse({}), now)).preview).toMatchObject({
      totalCents: '9223372036854775808',
      recordable: false,
      blockingReason: 'TOTAL_OUT_OF_RANGE',
    });
    await expect(service.capture({ idempotencyKey: 'overflow' }, now)).rejects.toThrow();
    expect(await resource.db.wealthRecord.count()).toBe(count);
  });

  it('distinguishes all-unknown coverage from a later genuinely observed zero', /** Empty sources cannot fabricate a record; unknown component cents never become an observed zero. */ async () => {
    const fresh = await testDatabase();
    const local = new WealthService(fresh.db);
    try {
      expect((await local.list(c.wealthRecordsQuerySchema.parse({}), now)).preview).toMatchObject({
        totalCents: null,
        recordable: false,
        blockingReason: 'NO_ACCOUNTS',
      });
      await expect(local.capture({ idempotencyKey: 'empty' }, now)).rejects.toThrow();
      const connection = await fresh.db.bankConnection.create({
        data: { name: 'Unknown source', bankCode: '69050001', connectorType: 'CSV' },
      });
      const account = await fresh.db.account.create({
        data: { name: 'Unknown account', bankConnectionId: connection.id },
      });
      const unknown = await local.capture({ idempotencyKey: 'unknown' }, now);
      expect(unknown).toMatchObject({
        totalCents: '0',
        coverage: 'PARTIAL',
        components: [{ amountCents: null, observedAt: null }],
      });
      const run = await fresh.db.importRun.create({ data: { source: 'CSV', status: 'COMPLETED' } });
      await fresh.db.balanceSnapshot.create({
        data: {
          accountId: account.id,
          importRunId: run.id,
          source: 'CSV',
          balanceType: 'BOOKED',
          observedAt: now,
          amountCents: 0n,
        },
      });
      const observed = await local.capture({ idempotencyKey: 'zero' }, now);
      expect(observed).toMatchObject({
        totalCents: '0',
        coverage: 'COMPLETE',
        components: [{ amountCents: '0', observedAt: now.toISOString() }],
      });
      expect(await local.capture({ idempotencyKey: 'unknown' }, now)).toEqual(unknown);
    } finally {
      await fresh.close();
    }
  });

  it('protects capture and listing through authenticated shared runtime/OpenAPI contracts', /** No API accepts client observations, replay without CSRF or metadata edits to frozen records. */ async () => {
    await resource.db.user.create({
      data: { username: 'wealth', passwordHash: await passwordHash('wealth-test-password') },
    });
    const app = await createApp(resource.db, false);
    try {
      await app.app.getHttpAdapter().getInstance().ready();
      expect((await app.app.inject({ method: 'GET', url: '/api/v1/wealth-records' })).statusCode).toBe(401);
      const login = await app.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'wealth', password: 'wealth-test-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      expect(
        (
          await app.app.inject({
            method: 'POST',
            url: '/api/v1/wealth-records',
            headers: { cookie },
            payload: { idempotencyKey: 'no-csrf' },
          })
        ).statusCode,
      ).toBe(403);
      const headers = { cookie, origin: 'http://localhost:3000', 'x-csrf-token': login.json().csrfToken };
      expect(
        (
          await app.app.inject({
            method: 'POST',
            url: '/api/v1/wealth-records',
            headers,
            payload: { idempotencyKey: 'client-money', totalCents: '1' },
          })
        ).statusCode,
      ).toBe(400);
      const response = await app.app.inject({ method: 'GET', url: '/api/v1/wealth-records?limit=1', headers });
      expect(response.statusCode).toBe(200);
      expect(c.wealthRecordsSchema.safeParse(response.json()).success).toBe(true);
      const existing = await resource.db.wealthRecord.findFirstOrThrow();
      const replay = await app.app.inject({
        method: 'POST',
        url: '/api/v1/wealth-records',
        headers,
        payload: { idempotencyKey: existing.idempotencyKey },
      });
      expect(replay.statusCode).toBe(201);
      expect(replay.json().id).toBe(existing.id);
      expect((await app.app.inject({ method: 'GET', url: '/api/v1/wealth-records?limit=0', headers })).statusCode).toBe(
        400,
      );
      expect(app.openapi.paths['/api/v1/wealth-records']?.post).toBeDefined();
      expect(app.openapi.paths['/api/v1/wealth-records']?.patch).toBeUndefined();
    } finally {
      await app.app.close();
    }
  });
});
