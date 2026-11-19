import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testDatabase } from './database.js';
import { AnalyticsService } from '../apps/api/src/analytics.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import * as c from '../packages/contracts/src/index.js';

describe('exact merchant analytics and contributing pages', /** Real PostgreSQL identity, pagination, serialization and authenticated access. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let analytics: AnalyticsService, ledger: LedgerService;
  beforeAll(
    /** Own synthetic financial records in a disposable database only. */ async () => {
      resource = await testDatabase();
      analytics = new AnalyticsService(resource.db);
      ledger = new LedgerService(resource.db);
    },
  );
  afterAll(/** Release only this suite's database. */ async () => resource?.close());

  it('groups exact trimmed names, reconciles paginated expenses and preserves unknown, case and refund distinctions', /** Neither substring search nor post-pagination filtering can satisfy this invariant. */ async () => {
    const connection = await ledger.createConnection({
      name: 'merchant fixture',
      bankCode: '69050001',
      connectorType: 'CSV',
    });
    const account = await ledger.createAccount({
      bankConnectionId: connection.id,
      name: 'Merchant account',
      accountType: 'CHECKING',
    });
    const category = await ledger.createCategory({ name: 'Merchant category', kind: 'BOTH' });
    const entries = [
      { counterpartyName: '  Markt\t', amountCents: -9007199254740993n },
      { counterpartyName: '\u00a0Markt\uFEFF', amountCents: -7n },
      { counterpartyName: 'Markt', amountCents: 299n },
      { counterpartyName: 'markt', amountCents: -13n },
      { counterpartyName: 'Markt Extra', amountCents: -17n },
      { counterpartyName: null, amountCents: -19n },
      { counterpartyName: '\t\u00a0 ', amountCents: -23n },
      { counterpartyName: 'Markt', amountCents: -1000n, isTransfer: true },
      { counterpartyName: 'Markt', amountCents: -2000n, status: 'PENDING' as const },
    ];
    await resource.db.transaction.createMany({
      data: entries.map(
        /** Keep fixed dates and explicit account/category provenance. */ (entry) => ({
          ...entry,
          accountId: account.id,
          categoryId: category.id,
          description: 'synthetic merchant booking',
          bookingDate: new Date('2026-10-15'),
        }),
      ),
    });
    await resource.db.transaction.create({
      data: {
        description: 'accountless',
        bookingDate: new Date('2026-10-16'),
        counterpartyName: 'Markt',
        amountCents: -5n,
      },
    });
    const query = { from: '2026-10-01', to: '2026-10-31' };
    const report = await analytics.merchants(query);
    expect(report.expenseCents).toBe('9007199254741077');
    expect(report.scope).toEqual({
      ...query,
      accountId: null,
      categoryId: null,
      unassigned: false,
      uncategorized: false,
    });
    expect(report.merchants).toHaveLength(4);
    expect(
      report.merchants.find(/** Unknown names share one explicit bucket. */ (bucket) => bucket.name === null),
    ).toMatchObject({ key: 'unknown', expenseCents: '42', count: 2 });
    const market = report.merchants.find(
      /** Case folding and aliases are deliberately excluded. */ (bucket) => bucket.name === 'Markt',
    )!;
    expect(market.expenseCents).toBe('9007199254741005');
    expect(market.count).toBe(3);
    const merchantOverview = await analytics.overview({ ...query, merchantKey: market.key });
    expect(merchantOverview.expenseCents).toBe(market.expenseCents);
    expect(merchantOverview.incomeCents).toBe('299');
    for (const bucket of report.merchants) {
      let cursor: string | undefined,
        sum = 0n,
        count = 0;
      do {
        const page = await ledger.transactions(
          c.transactionQuerySchema.parse({
            ...query,
            merchantKey: bucket.key,
            status: 'BOOKED',
            excludeTransfers: 'true',
            direction: 'EXPENSE',
            limit: 1,
            cursor,
          }),
        );
        for (const row of page.items) {
          sum -= BigInt(row.amountCents);
          count++;
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      expect(String(sum)).toBe(bucket.expenseCents);
      expect(count).toBe(bucket.count);
    }
    const refunds = await ledger.transactions(
      c.transactionQuerySchema.parse({ ...query, merchantKey: market.key, direction: 'INCOME' }),
    );
    expect(
      refunds.items.map(/** Refunds are income and retain exact merchant identity. */ (row) => row.amountCents),
    ).toEqual(['299']);
    expect(
      (await analytics.merchants({ ...query, accountId: account.id, categoryId: category.id })).merchants.find(
        /** Filter before aggregation. */ (bucket) => bucket.name === 'Markt',
      )!.expenseCents,
    ).toBe('9007199254741000');
    expect((await analytics.merchants({ ...query, unassigned: 'true' })).expenseCents).toBe('5');
    expect((await analytics.merchants({ ...query, uncategorized: 'true' })).expenseCents).toBe('5');
    expect(
      (await ledger.transactions(c.transactionQuerySchema.parse({ ...query, merchantKey: 'name:TWlzc2luZw' }))).items,
    ).toEqual([]);
    expect((await analytics.merchants({}, '2026-11-18')).scope).toMatchObject({ from: '2025-11-01', to: '2026-10-31' });
  });

  it('rejects malformed merchant keys, guards the real API and publishes exact OpenAPI shapes', /** GET additions preserve cookie access and do not introduce unauthenticated data exposure. */ async () => {
    await resource.db.user.create({
      data: { username: 'merchant-user', passwordHash: await passwordHash('synthetic-merchant-password') },
    });
    const service = await createApp(resource.db, false);
    try {
      await service.app.getHttpAdapter().getInstance().ready();
      expect((await service.app.inject({ method: 'GET', url: '/api/v1/analytics/merchants' })).statusCode).toBe(401);
      expect(
        (await service.app.inject({ method: 'GET', url: '/api/v1/transactions?merchantKey=unknown' })).statusCode,
      ).toBe(401);
      const login = await service.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'merchant-user', password: 'synthetic-merchant-password' },
      });
      const headers = { cookie: String(login.headers['set-cookie']).split(';')[0]! };
      for (const key of ['broken', 'name:', 'name:_w', 'name:IA', 'name:AA', 'name:TWFya3Q=']) {
        const response = await service.app.inject({
          method: 'GET',
          url: `/api/v1/transactions?merchantKey=${encodeURIComponent(key)}`,
          headers,
        });
        expect(response.statusCode, key).toBe(400);
      }
      const result = await service.app.inject({
        method: 'GET',
        url: '/api/v1/analytics/merchants?from=2026-10-01&to=2026-10-31',
        headers,
      });
      expect(result.statusCode).toBe(200);
      expect(c.merchantAnalyticsSchema.parse(result.json()).expenseCents).toBe('9007199254741077');
      expect(
        (
          await service.app.inject({
            method: 'GET',
            url: '/api/v1/analytics/merchants?from=2020-01-01&to=2026-10-31',
            headers,
          })
        ).statusCode,
      ).toBe(400);
      expect(service.openapi.paths['/api/v1/analytics/merchants']?.get?.security).toEqual([{ cookie: [] }]);
      expect(service.openapi.paths['/api/v1/transactions']?.get?.parameters).toContainEqual(
        expect.objectContaining({ name: 'merchantKey', in: 'query' }),
      );
      expect(
        (
          await service.app.inject({
            method: 'POST',
            url: '/api/v1/transactions/bulk-category',
            headers,
            payload: { ids: [], categoryId: null },
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await service.app.close();
    }
  });
});
