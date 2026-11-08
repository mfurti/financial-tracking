import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { summarizeContracts, type CostContract } from '../apps/api/src/contract-summary.js';
import { testDatabase } from './database.js';
import { ContractsService } from '../apps/api/src/contracts.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import * as c from '../packages/contracts/src/index.js';

/** Build an explicit synthetic recurrence without optional future-data assumptions. */
function contract(amount = 100n, interval = 1, patch: Partial<CostContract> = {}): CostContract {
  const id = randomUUID();
  return {
    id,
    name: 'Synthetic',
    provider: 'Synthetic',
    kind: 'SUBSCRIPTION',
    accountId: null,
    categoryId: null,
    category: null,
    startDate: new Date('2020-01-01'),
    endDate: null,
    cancellationDate: null,
    revisions: [
      {
        id: randomUUID(),
        contractId: id,
        amountCents: amount,
        intervalMonths: interval,
        effectiveDate: new Date('2020-01-01'),
      },
    ],
    ...patch,
  };
}
describe('contract-only monthly costs', /** Exact per-row rounding and explicit planning boundaries. */ () => {
  it('sums the displayed rounded cents for all rhythms and both groupings', /** No independently rounded group may disagree with its rows. */ () => {
    const categoryId = randomUUID();
    const records = [
      contract(100n),
      contract(1001n, 3),
      contract(999n, 6, { kind: 'INSURANCE', categoryId, category: { name: 'Versicherung' } }),
      contract(101n, 12, { kind: 'INSURANCE', categoryId, category: { name: 'Versicherung' } }),
    ];
    const result = summarizeContracts(records, '2030-01-15');
    expect(result.contracts.map(/** Compare exact monthly magnitudes. */ (row) => row.monthlyCents)).toEqual([
      '100',
      '334',
      '167',
      '8',
    ]);
    expect(result.monthlyCents).toBe('609');
    for (const groups of [result.categories, result.kinds]) {
      expect(
        groups.reduce(/** Sum the public exact values. */ (total, row) => total + BigInt(row.monthlyCents), 0n),
      ).toBe(609n);
      for (const group of groups) expect(group.contractIds).toHaveLength(group.count);
    }
    expect(
      result.categories.find(/** Keep unassigned contract categories explicit. */ (row) => row.key === 'uncategorized')
        ?.name,
    ).toBe('Ohne Kategorie');
  });
  it('uses inclusive terms and today-effective prices, excluding future contracts and rules', /** Next-payment forecasts must not select a future price early. */ () => {
    const current = contract(100n);
    current.revisions.push({
      ...current.revisions[0]!,
      id: randomUUID(),
      amountCents: 900n,
      effectiveDate: new Date('2030-01-16'),
    });
    const result = summarizeContracts(
      [
        current,
        contract(100n, 1, { startDate: new Date('2030-01-16') }),
        contract(100n, 1, { endDate: new Date('2030-01-14') }),
        contract(100n, 1, { endDate: new Date('2030-01-15') }),
      ],
      '2030-01-15',
    );
    expect(result.count).toBe(2);
    expect(result.monthlyCents).toBe('200');
    expect(summarizeContracts([], '2030-01-15')).toMatchObject({
      count: 0,
      monthlyCents: '0',
      categories: [],
      kinds: [],
    });
  });
  it('preserves aggregates above the individual BIGINT ceiling and zero-rounded annual costs', /** Geometry may approximate but money stays in cent strings. */ () => {
    expect(
      summarizeContracts([contract(9223372036854775807n), contract(9223372036854775807n)], '2030-01-15').monthlyCents,
    ).toBe('18446744073709551614');
    expect(summarizeContracts([contract(1n, 12)], '2030-01-15')).toMatchObject({ count: 1, monthlyCents: '0' });
  });
  it('serves the same validated summary through real authenticated HTTP and OpenAPI', /** Verify route precedence, persistence, access and transport cent strings. */ async () => {
    const resource = await testDatabase();
    const service = await createApp(resource.db, false);
    try {
      await resource.db.user.create({
        data: { username: 'cost-user', passwordHash: await passwordHash('synthetic-cost-password') },
      });
      const contracts = new ContractsService(resource.db);
      await contracts.create(
        c.contractInputSchema.parse({
          name: 'Annual synthetic',
          provider: 'Synthetic insurer',
          kind: 'INSURANCE',
          startDate: '2020-01-01',
          amountCents: '12000',
          intervalMonths: 12,
        }),
      );
      await service.app.getHttpAdapter().getInstance().ready();
      expect((await service.app.inject({ method: 'GET', url: '/api/v1/contracts/summary' })).statusCode).toBe(401);
      const login = await service.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'cost-user', password: 'synthetic-cost-password' },
      });
      const response = await service.app.inject({
        method: 'GET',
        url: '/api/v1/contracts/summary',
        headers: { cookie: String(login.headers['set-cookie']).split(';')[0]! },
      });
      expect(response.statusCode).toBe(200);
      expect(c.contractSummarySchema.parse(response.json())).toMatchObject({ count: 1, monthlyCents: '1000' });
      expect(service.openapi.paths['/api/v1/contracts/summary']?.get).toBeDefined();
    } finally {
      await service.app.close();
      await resource.close();
    }
  });
});
