import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { sessionSchema } from '../packages/contracts/src/index.js';
import { testDatabase } from './database.js';

it('keeps source amounts across an upgrade and reconciles splits in every category view', async () => {
  const migrationRoot = 'apps/api/prisma/migrations';
  const migration = '202611220002_transaction_splits';
  const resource = await testDatabase({ isolated: true, empty: true });
  const client = new Client({ connectionString: resource.url });
  await client.connect();
  try {
    const previous = (await readdir(migrationRoot)).filter((name) => /^\d/.test(name) && name < migration).sort();
    for (const name of previous) await client.query(await readFile(`${migrationRoot}/${name}/migration.sql`, 'utf8'));
    const db = resource.db;
    const original = await db.category.create({ data: { name: 'Original', kind: 'BOTH' } });
    const food = await db.category.create({ data: { name: 'Food', kind: 'BOTH' } });
    const home = await db.category.create({ data: { name: 'Home', kind: 'BOTH' } });
    const booking = await db.transaction.create({
      data: {
        categoryId: original.id,
        bookingDate: new Date('2036-02-29'),
        description: 'Original expense',
        counterpartyName: 'Sample shop',
        amountCents: -9007199254740993n,
      },
    });
    const income = await db.transaction.create({
      data: {
        categoryId: original.id,
        bookingDate: new Date('2036-02-01'),
        description: 'Original income',
        amountCents: 3n,
      },
    });
    await client.query(await readFile(`${migrationRoot}/${migration}/migration.sql`, 'utf8'));
    expect(await db.transaction.findUnique({ where: { id: booking.id } })).toEqual(booking);
    expect(await db.transactionSplit.count()).toBe(0);
    await db.categoryBudget.create({ data: { month: '2036-02', categoryId: home.id, limitCents: 20n } });
    await db.user.create({
      data: { username: 'splits-test', passwordHash: await passwordHash('split-test-password') },
    });

    const { app, openapi } = await createApp(db, false);
    try {
      const origin = 'http://localhost:3000';
      const bookingUrl = `/api/v1/transactions/${booking.id}`;
      const splitUrl = `${bookingUrl}/splits`;
      const splits = [
        { categoryId: food.id, amountCents: '9007199254740982' },
        { categoryId: home.id, amountCents: '11' },
      ];
      expect((await app.inject({ method: 'PUT', url: splitUrl, payload: { splits } })).statusCode).toBe(401);
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin },
        payload: { username: 'splits-test', password: 'split-test-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      const headers = { cookie, origin, 'x-csrf-token': sessionSchema.parse(login.json()).csrfToken };
      expect(
        (await app.inject({ method: 'PUT', url: splitUrl, headers: { cookie }, payload: { splits } })).statusCode,
      ).toBe(403);
      const read = async (url: string) => {
        const response = await app.inject({ method: 'GET', url, headers });
        expect(response.statusCode).toBe(200);
        return response.json();
      };
      const set = (parts: unknown, url = splitUrl) =>
        app.inject({ method: 'PUT', url, headers, payload: { splits: parts } });
      expect((await set([splits[0], { categoryId: food.id, amountCents: '11' }])).statusCode).toBe(400);
      expect((await set([splits[0], { categoryId: home.id, amountCents: '10' }])).statusCode).toBe(422);
      expect((await set(splits)).json()).toMatchObject({
        amountCents: '-9007199254740993',
        categoryId: original.id,
        splits,
      });
      expect(
        (
          await set(
            [
              { categoryId: food.id, amountCents: '1' },
              { categoryId: home.id, amountCents: '2' },
            ],
            `/api/v1/transactions/${income.id}/splits`,
          )
        ).statusCode,
      ).toBe(200);
      expect(
        (await app.inject({ method: 'PATCH', url: bookingUrl, headers, payload: { isTransfer: true } })).statusCode,
      ).toBe(409);

      const range = 'from=2036-02-01&to=2036-02-29';
      const scope = `${range}&categoryId=${home.id}`;
      expect(await read('/api/v1/analytics/monthly?month=2036-02')).toMatchObject({
        incomeCents: '3',
        expenseCents: '9007199254740993',
        bookedCount: 2,
        categories: expect.arrayContaining([
          expect.objectContaining({ categoryId: food.id, incomeCents: '1', expenseCents: '9007199254740982' }),
          expect.objectContaining({ categoryId: home.id, incomeCents: '2', expenseCents: '11' }),
        ]),
      });
      expect(await read(`/api/v1/analytics/overview?${scope}`)).toMatchObject({ expenseCents: '11', incomeCents: '2' });
      expect(await read(`/api/v1/analytics/merchants?${scope}`)).toMatchObject({ expenseCents: '11' });
      expect(await read(`/api/v1/budgets?month=2036-02`)).toMatchObject([{ categoryId: home.id, spentCents: '11' }]);
      expect(await read(`/api/v1/transactions?${scope}&direction=EXPENSE`)).toMatchObject({
        items: [{ id: booking.id, amountCents: '-9007199254740993', categoryAmountCents: '-11', splits }],
      });
      expect(await read(`/api/v1/transactions?${range}&categoryId=${original.id}`)).toMatchObject({ items: [] });
      expect(openapi.paths['/api/v1/transactions/{id}/splits']?.put?.requestBody).toBeDefined();
      await db.category.delete({ where: { id: food.id } });
      expect(await read(`/api/v1/analytics/overview?${range}&uncategorized=true`)).toMatchObject({
        expenseCents: '9007199254740982',
      });
      expect((await set([])).statusCode).toBe(200);
      expect(await read(bookingUrl)).toMatchObject({ amountCents: '-9007199254740993', categoryId: original.id });
      expect(await db.transactionSplit.count({ where: { transactionId: booking.id } })).toBe(0);
    } finally {
      await app.close();
    }
  } finally {
    await client.end();
    await resource.close();
  }
}, 60000);
