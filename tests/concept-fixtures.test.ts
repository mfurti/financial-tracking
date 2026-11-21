import { expect, it } from 'vitest';
import { seedConceptFixtures } from '../scripts/concept-fixtures.js';
import { testDatabase } from './database.js';
import { AnalyticsService } from '../apps/api/src/analytics.js';

it('keeps exact large and missing balances, month gaps and transfer-free actuals in disposable concept fixtures', /** Validate useful fixture behavior through the existing real report service. */ async () => {
  const resource = await testDatabase({ isolated: true });
  try {
    const ids = await seedConceptFixtures(resource.db);
    const balances = await resource.db.balanceSnapshot.findMany();
    expect(
      balances.find(/** Verify exact value beyond safe Number precision. */ (row) => row.accountId === ids.checkingId)
        ?.amountCents,
    ).toBe(900719925474099301n);
    expect(
      balances.some(
        /** Absence must remain unknown rather than become zero. */ (row) => row.accountId === ids.missingId,
      ),
    ).toBe(false);
    const report = await new AnalyticsService(resource.db).overview({
      from: '2026-07-01',
      to: '2026-10-31',
      accountId: ids.checkingId,
    });
    expect(report).toMatchObject({ incomeCents: '600299', expenseCents: '22100' });
    expect(report.average.excludedMonths).toContainEqual({ month: '2026-09', reason: 'NO_DATA' });
    expect(await resource.db.transaction.count({ where: { accountId: null } })).toBe(1);
    const contract = await resource.db.contract.findFirstOrThrow();
    expect(contract.startDate.toISOString().slice(0, 10)).toBe('2024-01-31');
  } finally {
    await resource.close();
  }
});
