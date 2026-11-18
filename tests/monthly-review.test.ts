import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AnalyticsService } from '../apps/api/src/analytics.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { testDatabase } from './database.js';
import * as c from '../packages/contracts/src/index.js';

describe('exact monthly review and contributing scopes', /** Calendar completeness must never claim complete bank history. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let analytics: AnalyticsService, ledger: LedgerService;
  beforeAll(
    /** Migrate an owned disposable database with synthetic boundary observations. */ async () => {
      resource = await testDatabase();
      analytics = new AnalyticsService(resource.db);
      ledger = new LedgerService(resource.db);
      await resource.db.transaction.createMany({
        data: [
          { description: 'before leap month', bookingDate: new Date('2024-01-31'), amountCents: -999n },
          { description: 'first day', bookingDate: new Date('2024-02-01'), amountCents: 9007199254740993n },
          { description: 'leap day expense', bookingDate: new Date('2024-02-29'), amountCents: -101n },
          { description: 'leap day refund', bookingDate: new Date('2024-02-29'), amountCents: 3n },
          { description: 'transfer out', bookingDate: new Date('2024-02-29'), amountCents: -99n, isTransfer: true },
          { description: 'transfer in', bookingDate: new Date('2024-02-29'), amountCents: 99n, isTransfer: true },
          { description: 'pending', bookingDate: new Date('2024-02-29'), amountCents: -88n, status: 'PENDING' },
          { description: 'next month', bookingDate: new Date('2024-03-01'), amountCents: -777n },
          { description: 'year end', bookingDate: new Date('2024-12-31'), amountCents: -1n },
          { description: 'year start', bookingDate: new Date('2025-01-01'), amountCents: 2n },
        ],
      });
    },
  );
  afterAll(/** Release only the suite-owned database resources. */ async () => resource?.close());
  it('reconciles leap-month income/expense queries exactly, including accountless refunds without transfers', /** Inclusive Berlin calendar dates retain beyond-Number integer precision. */ async () => {
    const review = await analytics.review({ month: '2024-02' }, '2026-11-18');
    expect(review.scope).toEqual({ from: '2024-02-01', to: '2024-02-29', accountId: null });
    expect(review).toMatchObject({
      month: '2024-02',
      incomeCents: '9007199254740996',
      expenseCents: '101',
      netCents: '9007199254740895',
      bookedCount: 3,
    });
    expect(review.completeness).toEqual({ calendar: 'CLOSED', hasBookings: true, historyComplete: false });
    expect(review.provenance).toEqual({ basis: 'BOOKED_NON_TRANSFER', includesUnassigned: true, refunds: 'INCOME' });
    for (const [direction, expected] of [
      ['income', review.incomeCents],
      ['expense', review.expenseCents],
    ] as const) {
      const query = review.queries[direction];
      expect(query).toMatchObject({
        from: '2024-02-01',
        to: '2024-02-29',
        status: 'BOOKED',
        excludeTransfers: 'true',
        direction: direction === 'income' ? 'INCOME' : 'EXPENSE',
      });
      const page = await ledger.transactions(query);
      const total = page.items.reduce(
        /** Compare contributing signed integer cents to the public aggregate. */ (sum, row) =>
          sum + BigInt(row.amountCents),
        0n,
      );
      expect(String(total < 0n ? -total : total)).toBe(expected);
    }
    expect((await analytics.review({ month: '2024-12' })).expenseCents).toBe('1');
    expect((await analytics.review({ month: '2025-01' })).incomeCents).toBe('2');
    expect((await analytics.review({ month: '2025-02' })).scope.to).toBe('2025-02-28');
  });
  it('distinguishes absent/current/future months and preserves explicit account scope', /** A closed empty period and missing observed sources never become proof of complete history. */ async () => {
    const connection = await ledger.createConnection({ name: 'review', bankCode: '69050001', connectorType: 'CSV' });
    const account = await ledger.createAccount({
      bankConnectionId: connection.id,
      name: 'Scoped review',
      accountType: 'CHECKING',
    });
    await resource.db.transaction.create({
      data: { accountId: account.id, bookingDate: new Date('2024-02-29'), amountCents: -7n, description: 'scoped' },
    });
    const scoped = await analytics.review({ month: '2024-02', accountId: account.id }, '2026-11-18');
    expect(scoped.expenseCents).toBe('7');
    expect(scoped.provenance.includesUnassigned).toBe(false);
    expect(scoped.queries.expense.accountId).toBe(account.id);
    expect(scoped.scope.accountId).toBe(account.id);
    expect((await analytics.review({ month: '2026-10' }, '2026-11-18')).completeness).toEqual({
      calendar: 'CLOSED',
      hasBookings: false,
      historyComplete: false,
    });
    expect((await analytics.review({ month: '2026-11' }, '2026-11-18')).completeness.calendar).toBe('CURRENT');
    expect((await analytics.review({ month: '2026-12' }, '2026-11-18')).completeness.calendar).toBe('FUTURE');
  });
  it('validates real API input/output and advertises provenance and filters in OpenAPI', /** New read-only review requires the existing cookie session and leaves financial rows unchanged. */ async () => {
    await resource.db.user.create({
      data: { username: 'review-user', passwordHash: await passwordHash('synthetic-review-password') },
    });
    const service = await createApp(resource.db, false);
    try {
      await service.app.getHttpAdapter().getInstance().ready();
      expect(
        (await service.app.inject({ method: 'GET', url: '/api/v1/analytics/review?month=2024-02' })).statusCode,
      ).toBe(401);
      const login = await service.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'review-user', password: 'synthetic-review-password' },
      });
      const headers = { cookie: String(login.headers['set-cookie']).split(';')[0]! };
      for (const suffix of ['', '?month=2024-13', '?month=2024-00', '?month=2024-02&accountId=invalid'])
        expect(
          (await service.app.inject({ method: 'GET', url: `/api/v1/analytics/review${suffix}`, headers })).statusCode,
        ).toBe(400);
      const before = await resource.db.transaction.count();
      const response = await service.app.inject({
        method: 'GET',
        url: '/api/v1/analytics/review?month=2024-02',
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(c.monthlyReviewSchema.parse(response.json()).expenseCents).toBe('108');
      expect(await resource.db.transaction.count()).toBe(before);
      expect(service.openapi.paths['/api/v1/analytics/review']?.get?.parameters).toContainEqual(
        expect.objectContaining({ name: 'month', required: true }),
      );
      expect(service.openapi.paths['/api/v1/analytics/review']?.get?.security).toEqual([{ cookie: [] }]);
      expect((await ledger.monthly('2024-02')).expenseCents).toBe('108');
    } finally {
      await service.app.close();
    }
  });
});
