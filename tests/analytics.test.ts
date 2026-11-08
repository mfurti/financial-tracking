import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AnalyticsService, analyticsRange, calculateAnalytics, type AnalyticsRow } from '../apps/api/src/analytics.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { ContractsService } from '../apps/api/src/contracts.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { testDatabase } from './database.js';
import {
  analyticsOverviewQuerySchema,
  contractInputSchema,
  transactionQuerySchema,
} from '../packages/contracts/src/index.js';

/** Build one observed actual row for pure exact-arithmetic/calendar cases. */
function row(date: string, amountCents: bigint): AnalyticsRow {
  return { bookingDate: new Date(date), amountCents, categoryId: null, classification: null };
}
describe('exact multi-month analytics', /** No gaps, partial months or forecast records may fabricate observed history. */ () => {
  it('uses twelve closed months by default and bounds inclusive calendar spans to 36', /** Year changes and clipped month boundaries still count calendar buckets. */ () => {
    expect(analyticsRange({}, '2026-01-01')).toEqual({ from: '2025-01-01', to: '2025-12-31', months: 12 });
    expect(analyticsRange({ from: '2024-02-29', to: '2027-01-31' }, '2027-02-01').months).toBe(36);
    expect(() => analyticsRange({ from: '2024-02-29', to: '2027-02-01' })).toThrow('36');
    expect(analyticsOverviewQuerySchema.safeParse({ from: '2026-02-01', to: '2026-01-31' }).success).toBe(false);
  });
  it('counts income-only closed months as observed zero expense and rounds average cents once', /** Missing months never enter the denominator. */ () => {
    const result = calculateAnalytics(
      [row('2025-01-15', -1n), row('2025-02-01', 10000n)],
      '2025-01-01',
      '2025-03-31',
      '2025-04-01',
    );
    expect(result.average.expenseCents).toBe('1');
    expect(result.average.monthCount).toBe(2);
    expect(result.average.excludedMonths).toEqual([{ month: '2025-03', reason: 'NO_DATA' }]);
    expect(result.trend).toMatchObject({
      month: '2025-02',
      previousMonth: '2025-01',
      changeCents: '-1',
      percent: -100,
    });
  });
  it('discloses clipped, current, future and absent observations without a false zero average', /** Actual totals remain available even when no month qualifies. */ () => {
    const result = calculateAnalytics(
      [row('2026-10-20', -100n), row('2026-11-02', -200n), row('2026-12-01', -300n)],
      '2026-10-15',
      '2026-12-31',
      '2026-11-08',
    );
    expect(result.expenseCents).toBe('600');
    expect(result.average.expenseCents).toBeNull();
    expect(result.average.monthCount).toBe(0);
    expect(
      result.average.excludedMonths.map(
        /** Each excluded bucket must give its concrete reason. */ (month) => month.reason,
      ),
    ).toEqual(['PARTIAL', 'CURRENT', 'FUTURE']);
    expect(calculateAnalytics([], '2025-01-01', '2025-01-31', '2026-11-08').average.expenseCents).toBeNull();
  });
  it('does not skip calendar gaps for a trend and omits percentage on a zero base', /** A null comparison differs from an actual observed zero-expense month. */ () => {
    expect(
      calculateAnalytics([row('2025-01-01', -100n), row('2025-03-01', -200n)], '2025-01-01', '2025-03-31', '2026-01-01')
        .trend,
    ).toBeNull();
    const zero = calculateAnalytics(
      [row('2025-01-01', 1n), row('2025-02-01', -200n)],
      '2025-01-01',
      '2025-02-28',
      '2026-01-01',
    );
    expect(zero.trend).toMatchObject({ changeCents: '200', percent: null });
  });
  it('retains precision beyond both Number and a single BIGINT aggregate', /** Display-only chart geometry never participates in these calculations. */ () => {
    const result = calculateAnalytics(
      [row('2024-12-31', -9223372036854775807n), row('2025-01-01', -9223372036854775807n)],
      '2024-12-01',
      '2025-01-31',
      '2026-01-01',
    );
    expect(result.expenseCents).toBe('18446744073709551614');
    expect(result.netCents).toBe('-18446744073709551614');
    expect(result.average.expenseCents).toBe('9223372036854775807');
    expect(result.categories[0]!.expenseCents).toBe(result.expenseCents);
  });
});

describe('analytics API and exact drill-down filters', /** Real data filtering, manual/contract precedence, transport and security. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let analytics: AnalyticsService, ledger: LedgerService;
  beforeAll(
    /** Own a migrated disposable PostgreSQL database. */ async () => {
      resource = await testDatabase();
      analytics = new AnalyticsService(resource.db);
      ledger = new LedgerService(resource.db);
    },
  );
  afterAll(/** Release only owned test resources. */ async () => resource?.close());
  it('includes accountless booked actuals, excludes pending/transfers and matches all classification/category drill-downs', /** Existing positive refunds remain income and confirmed forecasts add no actuals. */ async () => {
    const connection = await ledger.createConnection({ name: 'synthetic', bankCode: '69050001', connectorType: 'CSV' });
    const account = await ledger.createAccount({
      bankConnectionId: connection.id,
      name: 'Giro',
      accountType: 'CHECKING',
    });
    const category = await ledger.createCategory({ name: 'Food', kind: 'EXPENSE' });
    const provider = randomUUID();
    await resource.db.transaction.createMany({
      data: [
        {
          accountId: account.id,
          bookingDate: new Date('2025-01-01'),
          amountCents: -1200n,
          description: 'actual variable',
          counterpartyName: provider,
          categoryId: category.id,
          classification: 'VARIABLE',
        },
        { bookingDate: new Date('2025-01-02'), amountCents: -300n, description: 'standalone', categoryId: category.id },
        {
          accountId: account.id,
          bookingDate: new Date('2025-01-03'),
          amountCents: -9999n,
          description: 'pending',
          status: 'PENDING',
        },
        {
          accountId: account.id,
          bookingDate: new Date('2025-01-04'),
          amountCents: -9999n,
          description: 'transfer',
          isTransfer: true,
        },
        { accountId: account.id, bookingDate: new Date('2025-01-05'), amountCents: 200n, description: 'refund' },
        {
          accountId: account.id,
          bookingDate: new Date('2025-02-01'),
          amountCents: 100000n,
          description: 'income-only month',
        },
      ],
    });
    await new ContractsService(resource.db).create(
      contractInputSchema.parse({
        name: provider,
        provider,
        kind: 'SUBSCRIPTION',
        startDate: '2025-01-01',
        amountCents: '1200',
        intervalMonths: 1,
      }),
    );
    const query = { from: '2025-01-01', to: '2025-02-28' },
      result = await analytics.overview(query, '2026-01-01');
    expect(result.expenseCents).toBe('1500');
    expect(result.incomeCents).toBe('100200');
    expect(result.average.expenseCents).toBe('750');
    expect(
      result.classification.find(
        /** Manual variable overrides confirmed-contract fixed fallback. */ (bucket) =>
          bucket.classification === 'VARIABLE',
      )!.expenseCents,
    ).toBe('1200');
    for (const bucket of result.classification) {
      const records = await ledger.transactions(
        transactionQuerySchema.parse({
          ...query,
          status: 'BOOKED',
          direction: 'EXPENSE',
          excludeTransfers: 'true',
          classification: bucket.classification,
        }),
      );
      expect(
        String(
          records.items.reduce(
            /** Compare exact amounts contributing to each navigable bucket. */ (sum, transaction) =>
              sum - BigInt(transaction.amountCents),
            0n,
          ),
        ),
      ).toBe(bucket.expenseCents);
    }
    expect((await analytics.overview({ ...query, accountId: account.id }, '2026-01-01')).expenseCents).toBe('1200');
    expect((await analytics.overview({ ...query, unassigned: 'true' }, '2026-01-01')).expenseCents).toBe('300');
    expect((await analytics.overview({ ...query, categoryId: category.id }, '2026-01-01')).average.monthCount).toBe(1);
  });
  it('validates inclusive ranges and exact serialized totals behind real cookie authentication', /** OpenAPI and actual wire behavior share the same inventory. */ async () => {
    await resource.db.user.create({
      data: { username: 'analytics-user', passwordHash: await passwordHash('synthetic-analytics-password') },
    });
    const service = await createApp(resource.db, false);
    try {
      await service.app.getHttpAdapter().getInstance().ready();
      expect((await service.app.inject({ method: 'GET', url: '/api/v1/analytics/overview' })).statusCode).toBe(401);
      const login = await service.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'analytics-user', password: 'synthetic-analytics-password' },
      });
      const headers = { cookie: String(login.headers['set-cookie']).split(';')[0]! };
      expect(
        (
          await service.app.inject({
            method: 'GET',
            url: '/api/v1/analytics/overview?from=2020-01-01&to=2026-12-31',
            headers,
          })
        ).statusCode,
      ).toBe(400);
      const response = await service.app.inject({
        method: 'GET',
        url: '/api/v1/analytics/overview?from=2025-01-01&to=2025-02-28',
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().expenseCents).toBe('1500');
      expect(response.json().average.expenseCents).toBe('750');
      expect(service.openapi.paths['/api/v1/analytics/overview']?.get?.security).toEqual([{ cookie: [] }]);
    } finally {
      await service.app.close();
    }
  });
});
