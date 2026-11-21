import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { AccountGroupsService } from '../apps/api/src/account-groups.js';
import { AnalyticsService } from '../apps/api/src/analytics.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { ContractsService } from '../apps/api/src/contracts.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import * as c from '../packages/contracts/src/index.js';

describe('atomic account groups and reconciled set scopes', /** One group means a set of real identities, never a financial join multiplier or global empty fallback. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>,
    groups: AccountGroupsService,
    analytics: AnalyticsService,
    ledger: LedgerService,
    contracts: ContractsService;
  let first: string, inactive: string, outside: string, primary: string, empty: string;
  const from = '2035-11-01',
    to = '2035-11-30',
    today = '2036-01-01';
  beforeAll(
    /** Own active/inactive/overlapping/accountless financial fixtures and confirmed plans. */ async () => {
      resource = await testDatabase();
      groups = new AccountGroupsService(resource.db);
      analytics = new AnalyticsService(resource.db);
      ledger = new LedgerService(resource.db);
      contracts = new ContractsService(resource.db);
      await resource.db.user.create({
        data: { username: 'groups', passwordHash: await passwordHash('groups-test-password') },
      });
      const connection = await resource.db.bankConnection.create({
        data: { name: 'Group fixture', bankCode: '69050001', connectorType: 'CSV' },
      });
      const accounts = await Promise.all([
        resource.db.account.create({ data: { name: 'First', bankConnectionId: connection.id } }),
        resource.db.account.create({
          data: { name: 'Inactive historical', bankConnectionId: connection.id, isActive: false },
        }),
        resource.db.account.create({ data: { name: 'Outside', bankConnectionId: connection.id } }),
      ]);
      [first, inactive, outside] = accounts.map(
        /** Keep scope membership independent of account activity. */ (account) => account.id,
      ) as [string, string, string];
      await resource.db.transaction.createMany({
        data: [
          { accountId: first, amountCents: 10000n, description: 'Income' },
          { accountId: first, amountCents: -2000n, description: 'First expense' },
          { accountId: first, amountCents: 50n, description: 'Refund' },
          { accountId: inactive, amountCents: -3000n, description: 'Inactive expense' },
          { accountId: outside, amountCents: -4000n, description: 'Outside expense' },
          { accountId: null, amountCents: -777n, description: 'Accountless expense' },
          { accountId: first, amountCents: -99n, description: 'Own transfer', isTransfer: true },
          { accountId: inactive, amountCents: 99n, description: 'Own transfer', isTransfer: true },
          { accountId: first, amountCents: -123n, description: 'Pending', status: 'PENDING' },
        ].map(
          /** Shared merchant/date allow direct report/detail reconciliation. */ (row) => ({
            ...row,
            bookingDate: new Date('2035-11-15'),
            counterpartyName: 'Exact shared merchant',
          }),
        ),
      });
      for (const [accountId, amountCents] of [
        [first, 1000n],
        [inactive, 2000n],
        [outside, 4000n],
        [null, 8000n],
      ] as const)
        await resource.db.contract.create({
          data: {
            name: `Plan ${amountCents}`,
            provider: 'Group fixture',
            kind: 'OTHER',
            accountId,
            startDate: new Date(from),
            revisions: { create: { effectiveDate: new Date(from), amountCents, intervalMonths: 1 } },
          },
        });
      primary = (
        await groups.create(c.accountGroupInputSchema.parse({ name: 'Primary', accountIds: [first, inactive] }))
      ).id;
      await groups.create(
        c.accountGroupInputSchema.parse({ name: 'Overlapping', accountIds: [first, outside], sortOrder: 1 }),
      );
      empty = (await groups.create(c.accountGroupInputSchema.parse({ name: 'Empty', accountIds: [], sortOrder: 2 })))
        .id;
    },
  );
  afterAll(/** Close only the disposable fixture resources. */ async () => resource?.close());

  it('reconciles exact analytics/review/monthly/merchant/detail/calendar/contract totals without duplicate membership', /** Overlapping groups do not multiply a selected group's rows; inactive historical members remain included. */ async () => {
    const input = { from, to, groupId: primary };
    const report = await analytics.overview(input, today);
    expect(report).toMatchObject({ incomeCents: '10050', expenseCents: '5000', netCents: '5050' });
    expect(report.average.expenseCents).toBe('5000');
    const review = await analytics.review({ month: '2035-11', groupId: primary }, today);
    expect(review.scope).toMatchObject({ accountId: null, groupId: primary });
    expect(review.provenance.includesUnassigned).toBe(false);
    const detail = await ledger.transactions(review.queries.expense);
    expect(detail.items).toHaveLength(2);
    expect(
      detail.items.reduce(
        /** Compare exact contributing signed expense cents. */ (sum, row) => sum - BigInt(row.amountCents),
        0n,
      ),
    ).toBe(5000n);
    expect((await ledger.monthly('2035-11', undefined, primary)).expenseCents).toBe('5000');
    const merchants = await analytics.merchants(input, today);
    expect(merchants.scope.groupId).toBe(primary);
    expect(merchants.expenseCents).toBe('5000');
    expect(merchants.merchants[0]!.count).toBe(2);
    const calendar = await contracts.calendar(input);
    expect(calendar.scope.groupId).toBe(primary);
    expect(calendar.totalPlannedCents).toBe('3000');
    expect(calendar.events).toHaveLength(2);
    expect((await contracts.summary(from, { groupId: primary })).monthlyCents).toBe('3000');
    expect((await analytics.overview({ from, to }, today)).expenseCents).toBe('9777');
    expect((await analytics.overview({ from, to, unassigned: 'true' }, today)).expenseCents).toBe('777');
  });

  it('treats an empty group as no matches in every report and rejects missing/conflicting scopes', /** A missing or empty group can never silently broaden to the whole ledger. */ async () => {
    const input = { from, to, groupId: empty };
    expect((await analytics.overview(input, today)).expenseCents).toBe('0');
    expect((await analytics.merchants(input, today)).merchants).toEqual([]);
    expect((await ledger.transactions(c.transactionQuerySchema.parse(input))).items).toEqual([]);
    expect((await ledger.monthly('2035-11', undefined, empty)).netCents).toBe('0');
    expect((await contracts.calendar(input)).events).toEqual([]);
    expect((await contracts.summary(from, { groupId: empty })).monthlyCents).toBe('0');
    await expect(analytics.overview({ from, to, groupId: randomUUID() }, today)).rejects.toMatchObject({
      code: 'GROUP_NOT_FOUND',
    });
    for (const input of [
      { accountId: first, groupId: primary },
      { groupId: primary, unassigned: 'true' as const },
    ]) {
      expect(c.analyticsOverviewQuerySchema.safeParse(input).success).toBe(false);
      expect(c.transactionQuerySchema.safeParse(input).success).toBe(false);
    }
    expect(c.monthlyQuerySchema.safeParse({ month: '2035-11', accountId: first, groupId: primary }).success).toBe(
      false,
    );
    expect(c.contractCalendarQuerySchema.safeParse({ from, to, accountId: first, groupId: primary }).success).toBe(
      false,
    );
  });

  it('rejects unknown/duplicate members atomically and preserves absent edit fields', /** No failed group mutation may erase memberships, reset ordering or change financial rows. */ async () => {
    const before = (await groups.list()).find(
      /** Resolve the previously saved primary group. */ (group) => group.id === primary,
    )!;
    const financial = await resource.db.transaction.findMany({ orderBy: { id: 'asc' } });
    await expect(
      groups.patch(primary, { name: 'Rejected name', accountIds: [first, randomUUID()] }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    await expect(groups.patch(primary, { accountIds: [first, first.toUpperCase()] })).rejects.toThrow();
    expect(
      (await groups.list()).find(
        /** A failed transaction preserves the complete old group. */ (group) => group.id === primary,
      ),
    ).toEqual(before);
    const renamed = await groups.patch(primary, { name: 'Renamed primary' });
    expect(renamed.accountIds).toEqual(before.accountIds);
    expect(renamed.sortOrder).toBe(before.sortOrder);
    expect(await resource.db.transaction.findMany({ orderBy: { id: 'asc' } })).toEqual(financial);
  });

  it('serializes concurrent Unicode case-insensitive names rather than relying on database collation', /** Only one differently cased duplicate can commit through the service. */ async () => {
    const results = await Promise.allSettled([
      groups.create(c.accountGroupInputSchema.parse({ name: 'Übersicht', accountIds: [first] })),
      groups.create(c.accountGroupInputSchema.parse({ name: 'übersicht', accountIds: [inactive] })),
    ]);
    expect(
      results.filter(/** Count successful atomic creations only. */ (result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const failed = results.find(
      /** The serialized second name check must reject. */ (result) => result.status === 'rejected',
    );
    expect(failed && failed.status === 'rejected' ? failed.reason.code : null).toBe('GROUP_NAME_EXISTS');
  });

  it('deletes only grouping metadata and removes deleted membership references without global fallback', /** Group deletion preserves accounts, observations and booked history. */ async () => {
    const accounts = await resource.db.account.findMany({ orderBy: { id: 'asc' } }),
      financial = await resource.db.transaction.findMany({ orderBy: { id: 'asc' } });
    const group = await groups.create(
      c.accountGroupInputSchema.parse({ name: 'Removable group', accountIds: [first] }),
    );
    await groups.remove(group.id);
    expect(await resource.db.account.findMany({ orderBy: { id: 'asc' } })).toEqual(accounts);
    expect(await resource.db.transaction.findMany({ orderBy: { id: 'asc' } })).toEqual(financial);
    const temporary = await resource.db.account.create({
      data: { name: 'Unobserved removable', bankConnectionId: accounts[0]!.bankConnectionId },
    });
    const retained = await groups.create(
      c.accountGroupInputSchema.parse({ name: 'Retained empty', accountIds: [temporary.id] }),
    );
    await resource.db.account.delete({ where: { id: temporary.id } });
    expect(
      (await groups.list()).find(
        /** A surviving group now has an explicitly empty set. */ (row) => row.id === retained.id,
      )?.accountIds,
    ).toEqual([]);
    expect((await analytics.overview({ from, to, groupId: retained.id }, today)).expenseCents).toBe('0');
  });

  it('enforces real auth/CSRF/confirmation and publishes shared group query contracts', /** CRUD and scoped reads use the existing private singleton boundary. */ async () => {
    const app = await createApp(resource.db, false);
    try {
      await app.app.getHttpAdapter().getInstance().ready();
      expect((await app.app.inject({ method: 'GET', url: '/api/v1/account-groups' })).statusCode).toBe(401);
      const login = await app.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'groups', password: 'groups-test-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!,
        headers = { cookie, origin: 'http://localhost:3000', 'x-csrf-token': login.json().csrfToken };
      expect(
        (
          await app.app.inject({
            method: 'POST',
            url: '/api/v1/account-groups',
            headers: { cookie },
            payload: { name: 'Denied', accountIds: [] },
          })
        ).statusCode,
      ).toBe(403);
      const saved = await app.app.inject({
        method: 'POST',
        url: '/api/v1/account-groups',
        headers,
        payload: { name: 'HTTP group', accountIds: [first] },
      });
      expect(saved.statusCode).toBe(201);
      expect(c.accountGroupSchema.safeParse(saved.json()).success).toBe(true);
      expect(
        (
          await app.app.inject({
            method: 'DELETE',
            url: `/api/v1/account-groups/${saved.json().id}`,
            headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.app.inject({
            method: 'GET',
            url: `/api/v1/analytics/overview?from=${from}&to=${to}&accountId=${first}&groupId=${primary}`,
            headers,
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.app.inject({
            method: 'GET',
            url: `/api/v1/contracts/calendar?from=${from}&to=${to}&groupId=${empty}`,
            headers,
          })
        ).json().events,
      ).toEqual([]);
      expect(
        (
          await app.app.inject({
            method: 'DELETE',
            url: `/api/v1/account-groups/${saved.json().id}`,
            headers,
            payload: { confirm: true },
          })
        ).statusCode,
      ).toBe(200);
      expect(app.openapi.paths['/api/v1/account-groups']?.post).toBeDefined();
      expect(app.openapi.paths['/api/v1/account-groups/{id}']?.patch).toBeDefined();
      expect(app.openapi.paths['/api/v1/contracts/summary']?.get?.parameters).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'groupId' })]),
      );
    } finally {
      await app.app.close();
    }
  });
});
