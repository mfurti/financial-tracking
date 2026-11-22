import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { accountSchema } from '../packages/contracts/src/index.js';
import { testDatabase } from './database.js';

const route = '/api/v1/accounts/table';

describe('Querry Kit account read', /** Exercise a disposable account and balance scope. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  let headers: { cookie: string };
  let accountId: string;
  let groupId: string;

  beforeAll(
    /** Create both visible and inactive accounts with secret-free synthetic metadata. */ async () => {
      resource = await testDatabase();
      const { db } = resource;
      const connection = await db.bankConnection.create({
        data: { name: 'Synthetic bank', bankCode: '69050001', connectorType: 'CSV', metadata: { fixture: true } },
      });
      const active = await db.account.create({ data: { name: 'Active account', bankConnectionId: connection.id } });
      accountId = active.id;
      await db.account.create({ data: { name: 'Inactive account', bankConnectionId: connection.id, isActive: false } });
      groupId = (await db.accountGroup.create({ data: { name: 'Scope', members: { create: { accountId } } } })).id;
      const run = await db.importRun.create({ data: { source: 'CSV', status: 'COMPLETED' } });
      await db.balanceSnapshot.create({
        data: {
          accountId,
          importRunId: run.id,
          source: 'CSV',
          balanceType: 'BOOKED',
          amountCents: 9007199254740993n,
          observedAt: new Date('2026-11-04T10:00:00Z'),
        },
      });
      await db.user.create({
        data: { username: 'account-table', passwordHash: await passwordHash('account-table-fixture-pass') },
      });
      ({ app } = await createApp(db, false));
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'account-table', password: 'account-table-fixture-pass' },
      });
      expect(login.statusCode).toBe(201);
      headers = { cookie: String(login.headers['set-cookie']).split(';')[0]! };
    },
    30000,
  );

  afterAll(
    /** Release the fixture database after the last Http request. */ async () => {
      await app?.close();
      await resource?.close();
    },
  );

  it('keeps legacy account list and detail contracts', /** Check the ordinary paths next to the table route. */ async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/accounts', headers });
    expect(accountSchema.array().parse(list.json())).toHaveLength(2);
    const detail = await app.inject({ method: 'GET', url: '/api/v1/accounts/' + accountId, headers });
    expect(accountSchema.parse(detail.json())).toMatchObject({
      id: accountId,
      balances: [{ amountCents: '9007199254740993' }],
    });
  });

  it('enforces selection, projection and page counts without exposing bank settings', /** Prefer the static route and keep counts below the scoped filter. */ async () => {
    const denied = await app.inject({ method: 'GET', url: route });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).not.toHaveProperty('meta');
    const where = encodeURIComponent(JSON.stringify({ groupId, isActive: true }));
    const response = await app.inject({ method: 'GET', url: route + '?fields=name,balances&where=' + where, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [
        {
          id: accountId,
          name: 'Active account',
          balances: [{ amountCents: '9007199254740993', balanceType: 'BOOKED' }],
        },
      ],
      meta: { page: 1, perPage: 25, itemCount: 1, pageCount: 1 },
    });
    expect(response.json().items[0]).not.toHaveProperty('bankConnectionId');
    for (const fields of ['metadata', 'iban', 'balances{source}', 'meta{itemCount}']) {
      const invalid = await app.inject({
        method: 'GET',
        url: route + '?fields=' + encodeURIComponent(fields),
        headers,
      });
      expect(invalid.statusCode).toBe(400);
    }
  });
});
