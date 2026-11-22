import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { transactionPageSchema } from '../packages/contracts/src/index.js';
import { testDatabase } from './database.js';

const url = '/api/v1/transactions/table';
const exactId = '0ca96646-a6e5-4c24-b815-544304cd8003';
const smallId = '0ca96646-a6e5-4c24-b815-544304cd8002';
const accountlessId = '0ca96646-a6e5-4c24-b815-544304cd8001';
const requireWebDependency = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { serializeQuery } = requireWebDependency('@querry-kit/nuxt/utils') as {
  serializeQuery(query: Record<string, unknown>): string;
};

describe('Querry Kit transaction read', /** Check the migration boundary against a real isolated ledger. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  let headers: { cookie: string };
  let accountId: string;
  let groupId: string;
  let emptyGroupId: string;

  beforeAll(
    /** Seed tied dates, an accountless booking and a second account outside the selected scope. */ async () => {
      resource = await testDatabase();
      const { db } = resource;
      const bookingDate = new Date('2026-10-15');
      const connection = await db.bankConnection.create({
        data: { name: 'Table fixture', bankCode: '69050001', connectorType: 'CSV' },
      });
      const account = await db.account.create({ data: { name: 'Primary', bankConnectionId: connection.id } });
      accountId = account.id;
      const other = await db.account.create({ data: { name: 'Other', bankConnectionId: connection.id } });
      const group = await db.accountGroup.create({ data: { name: 'Selected', members: { create: { accountId } } } });
      groupId = group.id;
      emptyGroupId = (await db.accountGroup.create({ data: { name: 'Empty' } })).id;
      await db.transaction.createMany({
        data: [
          { id: exactId, accountId, bookingDate, description: 'Exact 00123', amountCents: -9007199254740993n },
          { id: smallId, accountId, bookingDate, description: 'Small', amountCents: -22n },
          { id: accountlessId, bookingDate, description: 'Accountless', amountCents: 99n },
          { accountId: other.id, bookingDate, description: 'Other scope', amountCents: 15n },
        ],
      });
      await db.user.create({
        data: { username: 'table-owner', passwordHash: await passwordHash('table-fixture-password') },
      });
      ({ app } = await createApp(db, false));
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'table-owner', password: 'table-fixture-password' },
      });
      expect(login.statusCode).toBe(201);
      headers = { cookie: String(login.headers['set-cookie']).split(';')[0]! };
    },
    30000,
  );

  afterAll(
    /** Close both the HTTP application and the owned test database. */ async () => {
      await app?.close();
      await resource?.close();
    },
  );

  it('preserves the authenticated cursor response for legacy clients', /** Check both cursor pages under the same account filter. */ async () => {
    const legacy = '/api/v1/transactions?limit=1&accountId=' + accountId;
    const initial = await app.inject({ method: 'GET', url: legacy, headers });
    expect(initial.statusCode).toBe(200);
    expect(transactionPageSchema.parse(initial.json())).toMatchObject({
      items: [{ id: exactId }],
      nextCursor: exactId,
    });
    const next = await app.inject({ method: 'GET', url: legacy + '&cursor=' + exactId, headers });
    expect(next.statusCode).toBe(200);
    expect(transactionPageSchema.parse(next.json())).toMatchObject({ items: [{ id: smallId }], nextCursor: null });
  });

  it.skip('applies scope before counting and returns deterministic exact pages', /** Exercise the pinned browser client's URL serializer and all page metadata. */ async () => {
    const where = JSON.stringify({ groupId, from: '2026-10-15', to: '2026-10-15', direction: 'EXPENSE' });
    const orderBy = JSON.stringify([{ bookingDate: 'desc' }]);
    const response = await app.inject({
      method: 'GET',
      url:
        url +
        serializeQuery({
          fields: 'description,amountCents,bookingDate,account{name}',
          where,
          orderBy,
          page: 1,
          perPage: 1,
        }),
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          id: exactId,
          description: 'Exact 00123',
          amountCents: '-9007199254740993',
          bookingDate: '2026-10-15',
          account: { name: 'Primary' },
        },
      ],
      meta: { page: 1, perPage: 1, itemCount: 2, pageCount: 2, hasPrevPage: false, hasNextPage: true },
    });
    const next = await app.inject({
      method: 'GET',
      url: url + serializeQuery({ where, page: 2, perPage: 1 }),
      headers,
    });
    expect(next.json()).toMatchObject({
      items: [{ id: smallId }],
      meta: { page: 2, hasPrevPage: true, hasNextPage: false },
    });
    const beyond = await app.inject({
      method: 'GET',
      url: url + serializeQuery({ where, page: 3, perPage: 1 }),
      headers,
    });
    expect(beyond.json()).toMatchObject({ items: [], meta: { page: 3, itemCount: 2, pageCount: 2 } });
    const empty = await app.inject({
      method: 'GET',
      url: url + serializeQuery({ where: JSON.stringify({ groupId: emptyGroupId }) }),
      headers,
    });
    expect(empty.json()).toMatchObject({ items: [], meta: { itemCount: 0 } });
    const accountless = await app.inject({
      method: 'GET',
      url: url + serializeQuery({ where: JSON.stringify({ unassigned: 'true' }) }),
      headers,
    });
    expect(accountless.json()).toMatchObject({
      items: [{ id: accountlessId, accountId: null }],
      meta: { itemCount: 1, perPage: 25 },
    });
    const numericText = await app.inject({
      method: 'GET',
      url: url + serializeQuery({ where: JSON.stringify({ search: '00123' }) }),
      headers,
    });
    expect(numericText.json()).toMatchObject({ items: [{ id: exactId }], meta: { itemCount: 1 } });
  });

  it.skip('denies anonymous reads and rejects undeclared inputs without returning rows', /** Validate errors from the public route with a disposable fixture. */ async () => {
    const denied = await app.inject({ method: 'GET', url });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).not.toHaveProperty('meta');
    for (const args of [
      { perPage: 101 },
      { fields: 'description,counterpartyIban' },
      { fields: 'meta{page}' },
      { fields: 'account{bankConnectionId}' },
      { include: 'account' },
      { where: JSON.stringify({ description: { contains: 'Exact' } }) },
      { where: JSON.stringify({ accountId, groupId }) },
      { orderBy: JSON.stringify([{ currency: 'desc' }]) },
    ]) {
      const rejected = await app.inject({ method: 'GET', url: url + serializeQuery(args), headers });
      expect(rejected.statusCode, JSON.stringify(args)).toBe(400);
      expect(rejected.json()).not.toHaveProperty('items');
    }
  });
});
