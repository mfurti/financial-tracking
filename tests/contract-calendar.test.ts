import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { ContractsService } from '../apps/api/src/contracts.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import * as c from '../packages/contracts/src/index.js';

describe('bounded contract calendar', /** Reconcile recurrence-derived planned dates with separately attributed actual observations. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let service: ContractsService;
  beforeAll(
    /** Own a migrated disposable database without bank calls. */ async () => {
      resource = await testDatabase();
      service = new ContractsService(resource.db);
    },
  );
  afterAll(/** Remove only the owned synthetic database. */ async () => resource?.close());

  it('uses inclusive month ends, future rules and exact due-month totals without generating ledger rows', /** Linked actual amounts and dates remain distinct from their immutable planned occurrence. */ async () => {
    const connection = await resource.db.bankConnection.create({
      data: { name: 'Calendar source', bankCode: '69050001', connectorType: 'CSV' },
    });
    const account = await resource.db.account.create({
      data: { name: 'Calendar account', bankConnectionId: connection.id },
    });
    const contract = await resource.db.contract.create({
      data: {
        name: 'Month-end calendar',
        provider: 'Calendar provider',
        kind: 'SUBSCRIPTION',
        accountId: account.id,
        startDate: new Date('2036-01-31'),
        endDate: new Date('2036-04-30'),
        revisions: {
          create: [
            { effectiveDate: new Date('2036-01-31'), amountCents: 9007199254740993n, intervalMonths: 1 },
            { effectiveDate: new Date('2036-03-31'), amountCents: 1234n, intervalMonths: 1 },
          ],
        },
      },
      include: { revisions: { orderBy: { effectiveDate: 'asc' } } },
    });
    const actual = await resource.db.transaction.create({
      data: {
        accountId: account.id,
        description: 'Observed payment',
        bookingDate: new Date('2036-03-01'),
        amountCents: -999n,
      },
    });
    await resource.db.contractPayment.create({
      data: {
        contractId: contract.id,
        revisionId: contract.revisions[0]!.id,
        dueDate: new Date('2036-02-29'),
        transactionId: actual.id,
        source: 'MANUAL',
      },
    });
    const before = await resource.db.transaction.findMany({ include: { identities: true } });
    const result = await service.calendar(
      c.contractCalendarQuerySchema.parse({ from: '2036-01-31', to: '2036-04-30', accountId: account.id }),
    );
    expect(
      result.events.map(/** Keep the original day anchor after February clipping. */ (event) => event.dueDate),
    ).toEqual(['2036-01-31', '2036-02-29', '2036-03-31', '2036-04-30']);
    expect(
      result.months.map(/** Reconcile exact sums without Number conversion. */ (month) => month.plannedCents),
    ).toEqual(['9007199254740993', '9007199254740993', '1234', '1234']);
    expect(result.totalPlannedCents).toBe('18014398509484454');
    expect(result.events[1]?.payment).toMatchObject({
      transactionId: actual.id,
      bookingDate: '2036-03-01',
      amountCents: '-999',
      source: 'MANUAL',
    });
    expect(result.months[1]?.paymentCount).toBe(1);
    expect(
      (
        await service.calendar(
          c.contractCalendarQuerySchema.parse({ from: '2036-02-29', to: '2036-02-29', accountId: account.id }),
        )
      ).events,
    ).toHaveLength(1);
    expect(
      (
        await service.calendar(
          c.contractCalendarQuerySchema.parse({ from: '2036-05-01', to: '2036-05-31', accountId: account.id }),
        )
      ).months,
    ).toEqual([{ month: '2036-05', plannedCents: '0', eventCount: 0, paymentCount: 0 }]);
    expect(
      (
        await service.calendar(
          c.contractCalendarQuerySchema.parse({ from: '2036-01-01', to: '2036-04-30', accountId: randomUUID() }),
        )
      ).events,
    ).toEqual([]);
    expect(await resource.db.transaction.findMany({ include: { identities: true } })).toEqual(before);
  });

  it('retains annual leap anchors, inclusive termination and unbound-account scope', /** Calendar output uses the same original February anchor across ordinary and leap years. */ async () => {
    const contract = await resource.db.contract.create({
      data: {
        name: 'Annual leap',
        provider: 'Leap provider',
        kind: 'INSURANCE',
        startDate: new Date('2032-02-29'),
        endDate: new Date('2036-02-29'),
        revisions: { create: { effectiveDate: new Date('2032-02-29'), intervalMonths: 12, amountCents: 17n } },
      },
    });
    const result = await service.calendar(
      c.contractCalendarQuerySchema.parse({ from: '2035-01-01', to: '2037-01-01' }),
    );
    expect(
      result.events
        .filter(
          /** Select only this independently created unbound contract. */ (event) => event.contractId === contract.id,
        )
        .map(/** Compare concrete recurrence days rather than approximate durations. */ (event) => event.dueDate),
    ).toEqual(['2035-02-28', '2036-02-29']);
    expect(result.scope.accountId).toBeNull();
    expect(c.contractCalendarQuerySchema.safeParse({ from: '2035-01-01', to: '2037-12-31' }).success).toBe(true);
  });

  it('validates bounds and exposes the same read-only authenticated runtime/OpenAPI contract', /** Calendar reads cannot bypass singleton sessions or accept unbounded dates. */ async () => {
    await resource.db.user.create({
      data: { username: 'calendar', passwordHash: await passwordHash('calendar-test-password') },
    });
    const app = await createApp(resource.db, false);
    try {
      await app.app.getHttpAdapter().getInstance().ready();
      const url = '/api/v1/contracts/calendar?from=2036-01-01&to=2036-04-30';
      expect((await app.app.inject({ method: 'GET', url })).statusCode).toBe(401);
      const login = await app.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'calendar', password: 'calendar-test-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      const response = await app.app.inject({ method: 'GET', url, headers: { cookie } });
      expect(response.statusCode).toBe(200);
      expect(c.contractCalendarSchema.safeParse(response.json()).success).toBe(true);
      for (const range of [
        'from=2036-02-30&to=2036-03-01',
        'from=2036-04-01&to=2036-03-31',
        'from=2036-01-01&to=2039-01-01',
        'from=2036-01-01',
      ])
        expect(
          (await app.app.inject({ method: 'GET', url: `/api/v1/contracts/calendar?${range}`, headers: { cookie } }))
            .statusCode,
        ).toBe(400);
      expect(app.openapi.paths['/api/v1/contracts/calendar']?.get).toBeDefined();
      expect(
        (await app.app.inject({ method: 'POST', url: '/api/v1/contracts', headers: { cookie }, payload: {} }))
          .statusCode,
      ).toBe(403);
    } finally {
      await app.app.close();
    }
  });
});
