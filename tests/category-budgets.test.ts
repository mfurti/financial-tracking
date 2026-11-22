import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { sessionSchema } from '../packages/contracts/src/index.js';
import { testDatabase } from './database.js';

it('upgrades a populated ledger and reconciles private monthly budget totals with the booking filters', async () => {
  const resource = await testDatabase({ isolated: true, empty: true });
  const migrationRoot = 'apps/api/prisma/migrations';
  const migration = '202611220001_category_budgets';
  const client = new Client({ connectionString: resource.url });
  await client.connect();
  try {
    const previous = (await readdir(migrationRoot)).filter((name) => /^\d/.test(name) && name < migration).sort();
    for (const name of previous) await client.query(await readFile(`${migrationRoot}/${name}/migration.sql`, 'utf8'));
    const db = resource.db;
    const category = await db.category.create({ data: { name: 'Food', kind: 'EXPENSE' } });
    await db.transaction.createMany({
      data: [
        { description: 'Accountless expense', amountCents: -9007199254740993n, bookingDate: new Date('2036-02-01') },
        { description: 'Leap day expense', amountCents: -11n, bookingDate: new Date('2036-02-29') },
        { description: 'Income', amountCents: 900n, bookingDate: new Date('2036-02-12') },
        { description: 'Pending', amountCents: -90n, bookingDate: new Date('2036-02-14'), status: 'PENDING' },
        { description: 'Transfer', amountCents: -90n, bookingDate: new Date('2036-02-16'), isTransfer: true },
        { description: 'Next month', amountCents: -90n, bookingDate: new Date('2036-03-01') },
      ].map((row) => ({ ...row, categoryId: category.id })),
    });
    const before = await db.transaction.findMany({ orderBy: { id: 'asc' } });
    await client.query(await readFile(`${migrationRoot}/${migration}/migration.sql`, 'utf8'));
    expect(await db.transaction.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    expect(await db.categoryBudget.count()).toBe(0);
    const later = (await readdir(migrationRoot)).filter((name) => /^\d/.test(name) && name > migration).sort();
    for (const name of later) await client.query(await readFile(`${migrationRoot}/${name}/migration.sql`, 'utf8'));

    await db.user.create({
      data: { username: 'budget-owner', passwordHash: await passwordHash('budget-test-password') },
    });
    const { app, openapi } = await createApp(db, false);
    try {
      const origin = 'http://localhost:3000';
      const url = '/api/v1/budgets';
      const month = '2036-02';
      const limit = { month, categoryId: category.id, limitCents: '9007199254741999' };
      expect((await app.inject({ method: 'GET', url: `${url}?month=${month}` })).statusCode).toBe(401);
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin },
        payload: { username: 'budget-owner', password: 'budget-test-password' },
      });
      expect(login.statusCode).toBe(201);
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      const headers = { origin, cookie, 'x-csrf-token': sessionSchema.parse(login.json()).csrfToken };
      expect((await app.inject({ method: 'PUT', url, headers: { cookie }, payload: limit })).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: `${url}?month=2036-13`, headers })).statusCode).toBe(400);
      for (const invalid of [
        { ...limit, month: '0000-02' },
        { ...limit, limitCents: '0' },
        { ...limit, limitCents: '9223372036854775808' },
      ])
        expect((await app.inject({ method: 'PUT', url, headers, payload: invalid })).statusCode).toBe(400);
      expect(
        (await app.inject({ method: 'PUT', url, headers, payload: { ...limit, categoryId: randomUUID() } })).statusCode,
      ).toBe(404);
      const [created, repeated] = await Promise.all(
        [limit, limit].map((payload) => app.inject({ method: 'PUT', url, headers, payload })),
      );
      expect(created?.statusCode).toBe(200);
      expect(repeated?.json()).toEqual(created?.json());
      const budget = created?.json();
      expect(budget).toMatchObject(limit);
      const summary = await app.inject({ method: 'GET', url: `${url}?month=${month}`, headers });
      expect(summary.statusCode).toBe(200);
      expect(summary.json()).toEqual([{ ...budget, spentCents: '9007199254741004', categoryName: 'Food' }]);
      const rows = await app.inject({
        method: 'GET',
        url: `/api/v1/transactions?from=2036-02-01&to=2036-02-29&categoryId=${category.id}&status=BOOKED&direction=EXPENSE&excludeTransfers=true`,
        headers,
      });
      expect(rows.json().items.map((row: { description: string }) => row.description)).toEqual([
        'Leap day expense',
        'Accountless expense',
      ]);
      expect(await app.inject({ method: 'GET', url: `${url}?month=2036-03`, headers })).toMatchObject({
        statusCode: 200,
        body: '[]',
      });
      expect(openapi.paths[url]?.put?.requestBody).toBeDefined();
      expect(openapi.paths[url]?.get?.parameters).toBeDefined();
      const removal = `${url}/${budget.id}`;
      expect((await app.inject({ method: 'DELETE', url: removal, headers })).statusCode).toBe(400);
      expect(
        (await app.inject({ method: 'DELETE', url: removal, headers, payload: { confirm: true } })).statusCode,
      ).toBe(200);
      expect(await db.categoryBudget.count()).toBe(0);
      expect(await db.transaction.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    } finally {
      await app.close();
    }
  } finally {
    await client.end();
    await resource.close();
  }
}, 60000);
