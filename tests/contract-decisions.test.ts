import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { ContractsService } from '../apps/api/src/contracts.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import * as c from '../packages/contracts/src/index.js';

describe('durable contract suggestion decisions', /** Real persistence, acceptance atomicity and authenticated shared transport. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let contracts: ContractsService;
  beforeAll(
    /** Create only owned disposable records. */ async () => {
      resource = await testDatabase();
      contracts = new ContractsService(resource.db);
    },
  );
  afterAll(/** Close the owned fixture after all decision cases. */ async () => resource?.close());
  /** Seed a genuine repeated-payment pattern without creating a contract. */
  async function proposal(provider: string = randomUUID(), amount = 1234n) {
    await resource.db.transaction.createMany({
      data: ['2033-01-05', '2033-02-05'].map(
        /** Each distinct period is a real booked expense. */ (date) => ({
          amountCents: -amount,
          bookingDate: new Date(date),
          description: provider,
          counterpartyName: provider,
        }),
      ),
    });
    return (await contracts.suggestions()).find(
      /** Select the exact newly eligible amount/provider pair. */ (row) =>
        row.provider === provider && row.amountCents === String(amount),
    )!;
  }
  it('retains dismissals across service restarts/new payments, supports restore and distinguishes changed patterns', /** A new payment is not permission to ask the same rejected question again. */ async () => {
    const first = await proposal();
    await contracts.decide(first.key, true);
    await contracts.decide(first.key, true);
    await resource.db.transaction.create({
      data: {
        amountCents: -1234n,
        bookingDate: new Date('2033-03-05'),
        description: first.provider,
        counterpartyName: first.provider,
      },
    });
    expect(
      (await new ContractsService(resource.db).suggestions()).some(
        /** Check durable suppression, not component memory. */ (row) => row.key === first.key,
      ),
    ).toBe(false);
    expect(
      (await contracts.suggestions(true)).find(
        /** Rejection remains restorable while the pattern is eligible. */ (row) => row.key === first.key,
      )?.count,
    ).toBe(3);
    await contracts.decide(first.key, false);
    expect(
      (await contracts.suggestions()).some(
        /** Restoration does not create a contract. */ (row) => row.key === first.key,
      ),
    ).toBe(true);
    await contracts.decide(first.key, true);
    const changed = await proposal(first.provider, 1599n);
    expect(changed.key).not.toBe(first.key);
  });
  it('accepts edits and source decisions atomically, retries without duplicate contracts and clears acceptance on delete', /** Preserve original payments through confirmation and removal. */ async () => {
    const source = await proposal();
    const input = c.contractInputSchema.parse({
      name: 'Edited display name',
      provider: source.provider,
      kind: 'OTHER',
      startDate: source.startDate,
      amountCents: source.amountCents,
      intervalMonths: source.intervalMonths,
      suggestionKey: source.key,
    });
    const first = await contracts.create(input);
    const second = await contracts.create(input);
    expect(second.id).toBe(first.id);
    expect(await resource.db.contract.count({ where: { name: input.name } })).toBe(1);
    expect(await resource.db.contractSuggestionDecision.findUnique({ where: { key: source.key } })).toMatchObject({
      state: 'CONFIRMED',
      contractId: first.id,
    });
    await contracts.remove(first.id);
    expect(await resource.db.contractSuggestionDecision.findUnique({ where: { key: source.key } })).toBeNull();
    expect(await resource.db.transaction.count({ where: { id: { in: source.transactionIds } } })).toBe(2);
    expect(
      (await contracts.suggestions()).some(
        /** Explicitly unlinked old payments remain blocked. */ (row) => row.key === source.key,
      ),
    ).toBe(false);
    await resource.db.transaction.createMany({
      data: ['2033-03-05', '2033-04-05'].map(
        /** Fresh unblocked observations may form a later proposal. */ (date) => ({
          amountCents: -BigInt(source.amountCents),
          bookingDate: new Date(date),
          description: source.provider,
          counterpartyName: source.provider,
        }),
      ),
    });
    expect(
      (await contracts.suggestions()).some(
        /** Deleting the contract permits a future explicit review again. */ (row) => row.key === source.key,
      ),
    ).toBe(true);
  });
  it('rejects stale keys and invalid metadata without persisting either contract or decision', /** Atomic rejection includes the reference validation path. */ async () => {
    const source = await proposal();
    const input = c.contractInputSchema.parse({
      name: source.provider,
      provider: source.provider,
      kind: 'SUBSCRIPTION',
      categoryId: randomUUID(),
      startDate: source.startDate,
      amountCents: source.amountCents,
      intervalMonths: source.intervalMonths,
      suggestionKey: source.key,
    });
    await expect(contracts.create(input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await resource.db.contractSuggestionDecision.findUnique({ where: { key: source.key } })).toBeNull();
    await contracts.decide(source.key, true);
    await expect(contracts.create({ ...input, categoryId: null })).rejects.toMatchObject({
      code: 'SUGGESTION_CHANGED',
    });
    await expect(contracts.decide('a'.repeat(64), true)).rejects.toMatchObject({ code: 'SUGGESTION_CHANGED' });
  });
  it('checks PUT/DELETE CSRF, query validation and hash path parameters through real HTTP/OpenAPI', /** A hash key must never be documented or validated as a UUID. */ async () => {
    const source = await proposal();
    await resource.db.user.create({
      data: { username: 'decision-user', passwordHash: await passwordHash('synthetic-decision-password') },
    });
    const service = await createApp(resource.db, false);
    try {
      await service.app.getHttpAdapter().getInstance().ready();
      const url = `/api/v1/contracts/suggestions/${source.key}/decision`;
      expect((await service.app.inject({ method: 'PUT', url, payload: { decision: 'DISMISSED' } })).statusCode).toBe(
        401,
      );
      const login = await service.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'decision-user', password: 'synthetic-decision-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      const headers = { cookie, origin: 'http://localhost:3000', 'x-csrf-token': login.json().csrfToken };
      expect(
        (
          await service.app.inject({
            method: 'PUT',
            url,
            headers: { cookie, origin: 'http://localhost:3000' },
            payload: { decision: 'DISMISSED' },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await service.app.inject({ method: 'PUT', url, headers, payload: { decision: 'DISMISSED' } })).statusCode,
      ).toBe(200);
      expect(
        (
          await service.app.inject({ method: 'GET', url: '/api/v1/contracts/suggestions?dismissed=true', headers })
        ).json(),
      ).toEqual(expect.arrayContaining([expect.objectContaining({ key: source.key })]));
      expect(
        (await service.app.inject({ method: 'GET', url: '/api/v1/contracts/suggestions?dismissed=invalid', headers }))
          .statusCode,
      ).toBe(400);
      expect((await service.app.inject({ method: 'DELETE', url, headers })).statusCode).toBe(200);
      const parameters = service.openapi.paths['/api/v1/contracts/suggestions/{key}/decision']?.put?.parameters;
      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'key', schema: expect.objectContaining({ pattern: '^[a-f0-9]{64}$' }) }),
        ]),
      );
    } finally {
      await service.app.close();
    }
  });
});
