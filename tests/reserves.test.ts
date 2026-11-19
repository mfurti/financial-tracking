import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDatabase } from './database.js';
import { ReservesService } from '../apps/api/src/reserves.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import * as c from '../packages/contracts/src/index.js';

describe('explicit EUR reserve observations', /** Reserve configuration never creates financial history or assumes savings eligibility. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let service: ReservesService;
  let known: string, missing: string, foreign: string, inactive: string;
  const now = new Date('2026-11-19T12:00:00Z');
  beforeAll(
    /** Own synthetic accounts and actual balance observations in disposable PostgreSQL. */ async () => {
      resource = await testDatabase();
      service = new ReservesService(resource.db);
      const connection = await resource.db.bankConnection.create({
        data: { name: 'Reserve source', bankCode: '69050001', connectorType: 'CSV' },
      });
      const run = await resource.db.importRun.create({ data: { source: 'CSV', status: 'COMPLETED' } });
      const accounts = await Promise.all([
        resource.db.account.create({
          data: { name: 'Explicit savings', accountType: 'SAVINGS', bankConnectionId: connection.id },
        }),
        resource.db.account.create({ data: { name: 'Missing booked source', bankConnectionId: connection.id } }),
        resource.db.account.create({
          data: { name: 'Foreign source', currency: 'USD', bankConnectionId: connection.id },
        }),
        resource.db.account.create({
          data: { name: 'Inactive source', isActive: false, bankConnectionId: connection.id },
        }),
      ]);
      [known, missing, foreign, inactive] = accounts.map(
        /** Keep explicit fixture identities out of implementation assumptions. */ (account) => account.id,
      ) as [string, string, string, string];
      await resource.db.balanceSnapshot.createMany({
        data: [
          { accountId: known, amountCents: 100000n, observedAt: new Date('2026-10-01'), balanceType: 'BOOKED' },
          { accountId: known, amountCents: -45000n, observedAt: new Date('2026-11-16'), balanceType: 'BOOKED' },
          { accountId: known, amountCents: 999999n, observedAt: now, balanceType: 'AVAILABLE' },
          { accountId: missing, amountCents: 200000n, observedAt: now, balanceType: 'AVAILABLE' },
        ].map(
          /** Every observation retains its actual source import. */ (balance) => ({
            ...balance,
            importRunId: run.id,
            source: 'CSV',
          }),
        ),
      });
    },
  );
  beforeEach(
    /** Reset only new configuration so each proof uses the same unchanged sources. */ async () => {
      await resource.db.accountPresentation.deleteMany();
    },
  );
  afterAll(/** Remove only the owned PostgreSQL fixture. */ async () => resource?.close());

  it('keeps default savings unselected and empty observations unknown', /** Account type alone cannot fabricate a designated Tagesgeld balance. */ async () => {
    expect(await service.goal(now)).toMatchObject({
      targetCents: '300000',
      currentCents: null,
      eligibleCount: 0,
      observedCount: 0,
      coverage: 'PARTIAL',
      components: [],
    });
  });
  it('preserves negative, missing, stale and available-versus-booked provenance', /** Only explicitly selected active EUR booked observations contribute to exact current progress. */ async () => {
    const before = await resource.db.balanceSnapshot.findMany({ orderBy: { id: 'asc' } });
    await service.setPresentation(known, { reserveEligible: true });
    await service.setPresentation(missing, { reserveEligible: true });
    await service.setPresentation(inactive, { reserveEligible: true });
    const result = await service.goal(now);
    expect(result).toMatchObject({ currentCents: '-45000', eligibleCount: 2, observedCount: 1, coverage: 'PARTIAL' });
    expect(
      result.components.find(
        /** Locate the actual booked source rather than the newer available value. */ (item) =>
          item.accountId === known,
      ),
    ).toMatchObject({ amountCents: '-45000', observedAt: '2026-11-16T00:00:00.000Z', source: 'CSV', stale: true });
    expect(
      result.components.find(
        /** An available balance alone must not become a booked zero. */ (item) => item.accountId === missing,
      ),
    ).toMatchObject({ amountCents: null, observedAt: null, stale: false });
    expect(result.excludedAccounts).toContainEqual({
      accountId: inactive,
      name: 'Inactive source',
      reason: 'INACTIVE',
    });
    await expect(service.setPresentation(foreign, { reserveEligible: true })).rejects.toMatchObject({ status: 422 });
    expect(await resource.db.balanceSnapshot.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });
  it('distinguishes an observed zero and persists only a validated exact target', /** No derived reserve balance is stored when the target changes. */ async () => {
    const run = await resource.db.importRun.findFirstOrThrow();
    await resource.db.balanceSnapshot.create({
      data: {
        accountId: missing,
        importRunId: run.id,
        source: 'CSV',
        balanceType: 'BOOKED',
        amountCents: 0n,
        observedAt: now,
      },
    });
    await service.setPresentation(missing, { reserveEligible: true });
    expect(await service.goal(now)).toMatchObject({ currentCents: '0', coverage: 'COMPLETE', observedCount: 1 });
    expect(await service.setGoal({ targetCents: '9007199254740993' }, now)).toMatchObject({
      targetCents: '9007199254740993',
      currentCents: '0',
    });
    expect((await service.goal(now)).targetCents).toBe('9007199254740993');
    await expect(service.setGoal({ targetCents: '0' }, now)).rejects.toThrow();
    expect((await service.goal(now)).targetCents).toBe('9007199254740993');
  });
  it('enforces the same authenticated runtime/OpenAPI/CSRF and rejects unrelated financial input', /** Singleton metadata access introduces no permission or real amount-write bypass. */ async () => {
    await resource.db.user.create({
      data: { username: 'reserve', passwordHash: await passwordHash('reserve-test-password') },
    });
    const app = await createApp(resource.db, false);
    try {
      await app.app.getHttpAdapter().getInstance().ready();
      expect((await app.app.inject({ method: 'GET', url: '/api/v1/reserve-goal' })).statusCode).toBe(401);
      const login = await app.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'reserve', password: 'reserve-test-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      expect(
        (
          await app.app.inject({
            method: 'PUT',
            url: '/api/v1/reserve-goal',
            headers: { cookie },
            payload: { targetCents: '300000' },
          })
        ).statusCode,
      ).toBe(403);
      const headers = { cookie, origin: 'http://localhost:3000', 'x-csrf-token': login.json().csrfToken };
      for (const targetCents of ['0', '1.2', '-1'])
        expect(
          (await app.app.inject({ method: 'PUT', url: '/api/v1/reserve-goal', headers, payload: { targetCents } }))
            .statusCode,
        ).toBe(400);
      expect(
        (
          await app.app.inject({
            method: 'PATCH',
            url: `/api/v1/accounts/${known}/presentation`,
            headers,
            payload: { reserveEligible: true, amountCents: '1' },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.app.inject({
            method: 'PATCH',
            url: `/api/v1/accounts/${known}/presentation`,
            headers,
            payload: { reserveEligible: true },
          })
        ).statusCode,
      ).toBe(200);
      const saved = await app.app.inject({
        method: 'PUT',
        url: '/api/v1/reserve-goal',
        headers,
        payload: { targetCents: '300000' },
      });
      expect(saved.statusCode).toBe(200);
      expect(c.reserveGoalSchema.safeParse(saved.json()).success).toBe(true);
      expect(app.openapi.paths['/api/v1/reserve-goal']?.put).toBeDefined();
      expect(app.openapi.paths['/api/v1/accounts/{id}/presentation']?.patch).toBeDefined();
    } finally {
      await app.app.close();
    }
  });
});
