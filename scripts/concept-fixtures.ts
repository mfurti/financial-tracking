import type { Db } from '../apps/api/src/db.js';

/** Stable synthetic labels shared by isolated concept servers and browser assertions. */
export const conceptFixtureLabels = {
  checking: 'Gemeinsames Alltagskonto mit besonders langem Namen',
  savings: 'Tagesgeld Reserve',
  missing: 'Konto ohne beobachteten Saldo',
  liability: 'Verbindlichkeit mit negativem Saldo',
  merchant: 'Beispielmarkt mit langem Gegenparteinamen',
  contract: 'Monatsende Versicherung mit langem Vertragsnamen',
} as const;

/** Seed only an owned disposable concept database; never call this against a household database. */
export async function seedConceptFixtures(db: Db) {
  const connection = await db.bankConnection.create({
    data: { name: 'Synthetic concept fixture', bankCode: '00000000', connectorType: 'CSV' },
  });
  const checking = await db.account.create({
    data: { bankConnectionId: connection.id, name: conceptFixtureLabels.checking },
  });
  const savings = await db.account.create({
    data: { bankConnectionId: connection.id, name: conceptFixtureLabels.savings, accountType: 'SAVINGS' },
  });
  const missing = await db.account.create({
    data: { bankConnectionId: connection.id, name: conceptFixtureLabels.missing },
  });
  const liability = await db.account.create({
    data: { bankConnectionId: connection.id, name: conceptFixtureLabels.liability },
  });
  const run = await db.importRun.create({
    data: { source: 'CSV', status: 'COMPLETED', bankConnectionId: connection.id },
  });
  await db.balanceSnapshot.createMany({
    data: [
      { accountId: checking.id, amountCents: 900719925474099301n },
      { accountId: savings.id, amountCents: 1500000n },
      { accountId: liability.id, amountCents: -45000n },
    ].map(
      /** All known values retain actual fixture import provenance; missing remains absent. */ (value) => ({
        ...value,
        balanceType: 'BOOKED',
        observedAt: new Date('2026-11-10T12:00:00Z'),
        source: 'CSV',
        importRunId: run.id,
      }),
    ),
  });
  const category = await db.category.create({ data: { name: 'Lebensmittel Konzept', kind: 'EXPENSE' } });
  const transfer = await db.transferGroup.create({ data: {} });
  await db.transaction.createMany({
    data: [
      { accountId: checking.id, amountCents: 300000n, bookingDate: new Date('2026-07-01'), description: 'Gehalt Juli' },
      {
        accountId: checking.id,
        amountCents: -12000n,
        bookingDate: new Date('2026-07-10'),
        description: 'Einkauf Juli',
        categoryId: category.id,
        counterpartyName: conceptFixtureLabels.merchant,
      },
      {
        accountId: checking.id,
        amountCents: -101n,
        bookingDate: new Date('2026-08-31'),
        description: 'Ausgabe August ohne Gegenpartei',
      },
      {
        accountId: checking.id,
        amountCents: 300000n,
        bookingDate: new Date('2026-10-01'),
        description: 'Gehalt Oktober',
      },
      {
        accountId: checking.id,
        amountCents: -9999n,
        bookingDate: new Date('2026-10-10'),
        description: 'Einkauf Oktober',
        categoryId: category.id,
        counterpartyName: conceptFixtureLabels.merchant,
      },
      {
        accountId: checking.id,
        amountCents: 299n,
        bookingDate: new Date('2026-10-11'),
        description: 'Erstattung Oktober',
        categoryId: category.id,
        counterpartyName: conceptFixtureLabels.merchant,
      },
      {
        accountId: checking.id,
        amountCents: -500n,
        bookingDate: new Date('2026-11-02'),
        description: 'Teilmonat November',
        categoryId: category.id,
        counterpartyName: conceptFixtureLabels.merchant,
      },
      {
        accountId: null,
        amountCents: -123n,
        bookingDate: new Date('2026-10-15'),
        description: 'Kontolose CSV Ausgabe',
      },
      {
        accountId: checking.id,
        amountCents: -10000n,
        bookingDate: new Date('2026-10-20'),
        description: 'Eigene Umbuchung Abgang',
        isTransfer: true,
        transferGroupId: transfer.id,
      },
      {
        accountId: savings.id,
        amountCents: 10000n,
        bookingDate: new Date('2026-10-20'),
        description: 'Eigene Umbuchung Zugang',
        isTransfer: true,
        transferGroupId: transfer.id,
      },
    ],
  });
  await db.contract.create({
    data: {
      name: conceptFixtureLabels.contract,
      provider: 'Synthetic insurer',
      kind: 'INSURANCE',
      accountId: checking.id,
      startDate: new Date('2024-01-31'),
      revisions: { create: { effectiveDate: new Date('2024-01-31'), amountCents: 5900n, intervalMonths: 1 } },
    },
  });
  return { checkingId: checking.id, savingsId: savings.id, missingId: missing.id, liabilityId: liability.id };
}
