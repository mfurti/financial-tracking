import { expect, it } from 'vitest';
import { Client } from 'pg';
import { passwordHash } from '../apps/api/src/auth.js';
import { testDatabase } from './database.js';

/** Tables covered by the logical fixture backup, in foreign-key dependency order. */
const tables = [
  'User',
  'OwnerProfile',
  'NotificationAcknowledgement',
  'BankConnection',
  'Account',
  'AccountPresentation',
  'AccountGroup',
  'AccountGroupMember',
  'ReserveGoal',
  'Category',
  'CategoryRule',
  'ImportRun',
  'BalanceSnapshot',
  'TransferGroup',
  'Transaction',
  'TransactionIdentity',
  'AssignmentReceipt',
  'Contract',
  'ContractRevision',
  'ContractPayment',
  'WealthRecord',
  'WealthRecordComponent',
] as const;

/** Populate the unchanged pre-rebuild schema with a cross-section of existing ledger records. */
async function seed(db: Awaited<ReturnType<typeof testDatabase>>['db']) {
  const bookingDate = new Date('2026-10-15');
  const owner = await db.user.create({
    data: { username: 'rebuild-restore-owner', passwordHash: await passwordHash('rebuild-fixture-password-only') },
  });
  await db.ownerProfile.create({ data: { userId: owner.id, displayName: 'Synthetic owner' } });
  await db.notificationAcknowledgement.create({ data: { userId: owner.id, sourceKey: 'synthetic-source' } });
  const connection = await db.bankConnection.create({
    data: { name: 'Synthetic source', bankCode: '69050001', connectorType: 'CSV' },
  });
  const account = await db.account.create({
    data: { name: 'Synthetic account', bankConnectionId: connection.id },
  });
  const otherAccount = await db.account.create({
    data: { name: 'Synthetic savings', bankConnectionId: connection.id },
  });
  await db.accountPresentation.create({ data: { accountId: account.id, reserveEligible: true } });
  await db.accountGroup.create({ data: { name: 'Synthetic group', members: { create: { accountId: account.id } } } });
  await db.reserveGoal.update({ where: { id: 1 }, data: { targetCents: 200000n } });
  const category = await db.category.create({ data: { name: 'Synthetic category', kind: 'EXPENSE' } });
  await db.categoryRule.create({
    data: { name: 'Synthetic rule', categoryId: category.id, matchType: 'DESCRIPTION', text: 'Synthetic' },
  });
  const run = await db.importRun.create({ data: { source: 'CSV', status: 'COMPLETED', importedCount: 2 } });
  const booking = await db.transaction.create({
    data: {
      accountId: account.id,
      categoryId: category.id,
      createdByImportRunId: run.id,
      bookingDate,
      description: 'Synthetic contract payment',
      amountCents: -9007199254740993n,
    },
  });
  const unassigned = await db.transaction.create({
    data: { bookingDate, createdByImportRunId: run.id, description: 'Synthetic accountless receipt', amountCents: 99n },
  });
  await db.transactionIdentity.create({
    data: {
      importRunId: run.id,
      scope: 'fixture',
      identityType: 'CSV',
      identityValue: 'rebuild-receipt',
      transactionId: unassigned.id,
    },
  });
  const transfer = await db.transferGroup.create({ data: {} });
  await db.transaction.createMany({
    data: [
      {
        accountId: account.id,
        bookingDate,
        description: 'Synthetic transfer outgoing',
        amountCents: -50n,
        isTransfer: true,
        transferGroupId: transfer.id,
      },
      {
        accountId: otherAccount.id,
        bookingDate,
        description: 'Synthetic transfer incoming',
        amountCents: 50n,
        isTransfer: true,
        transferGroupId: transfer.id,
      },
    ],
  });
  await db.assignmentReceipt.create({
    data: {
      id: '216e2d66-7a5a-4d94-98fa-08683dfcaa33',
      inputHash: 'synthetic-hash',
      result: { transactionId: unassigned.id },
    },
  });
  await db.balanceSnapshot.create({
    data: {
      accountId: account.id,
      importRunId: run.id,
      amountCents: 9007199254740995n,
      balanceType: 'BOOKED',
      source: 'CSV',
      observedAt: bookingDate,
    },
  });
  const contract = await db.contract.create({
    data: {
      name: 'Synthetic contract',
      provider: 'Synthetic provider',
      kind: 'OTHER',
      accountId: account.id,
      categoryId: category.id,
      startDate: bookingDate,
    },
  });
  const revision = await db.contractRevision.create({
    data: { contractId: contract.id, effectiveDate: bookingDate, amountCents: 9007199254740993n, intervalMonths: 1 },
  });
  await db.contractPayment.create({
    data: {
      contractId: contract.id,
      revisionId: revision.id,
      dueDate: bookingDate,
      transactionId: booking.id,
      source: 'MANUAL',
    },
  });
  await db.wealthRecord.create({
    data: {
      idempotencyKey: 'rebuild-fixture',
      totalCents: 9007199254740995n,
      coverage: 'COMPLETE',
      components: {
        create: {
          accountId: account.id,
          sourceLabel: 'Frozen synthetic account',
          amountCents: 9007199254740995n,
          observedAt: bookingDate,
          sourceType: 'CSV',
        },
      },
    },
  });
  return { accountId: account.id };
}

/** Export canonical JSONB text in PostgreSQL so JS never rounds numeric values in the backup. */
async function snapshot(client: Client) {
  const result = new Map<(typeof tables)[number], string>();
  for (const table of tables) {
    const { rows } = await client.query<{ payload: string }>(
      `SELECT coalesce(jsonb_agg(entry ORDER BY entry::text), '[]'::jsonb)::text AS payload
         FROM (SELECT to_jsonb(source_row) AS entry FROM "${table}" AS source_row) AS contents`,
    );
    result.set(table, rows[0]!.payload);
  }
  return result;
}

/** Compare exact monthly amounts and count independently of the archive representation. */
async function periodTotals(client: Client) {
  const { rows } = await client.query(
    `SELECT "accountId", currency, to_char("bookingDate", 'YYYY-MM') AS month,
            count(*)::text AS count, sum("amountCents")::text AS cents
     FROM "Transaction" WHERE NOT "isTransfer" GROUP BY 1, 2, 3 ORDER BY 1 NULLS LAST, 2, 3`,
  );
  return rows;
}

it('restores the populated baseline and reconciles every captured row and exact scoped total', /** Use two disposable databases and keep numeric JSON inside PostgreSQL. */ async () => {
  const source = await testDatabase({ isolated: true });
  const original = new Client({ connectionString: source.url });
  let target: Awaited<ReturnType<typeof testDatabase>> | undefined;
  let restored: Client | undefined;
  try {
    const ids = await seed(source.db);
    await original.connect();
    const archive = await snapshot(original);
    const totals = await periodTotals(original);
    expect(totals).toEqual([
      { accountId: ids.accountId, currency: 'EUR', month: '2026-10', count: '1', cents: '-9007199254740993' },
      { accountId: null, currency: 'EUR', month: '2026-10', count: '1', cents: '99' },
    ]);

    target = await testDatabase({ isolated: true });
    restored = new Client({ connectionString: target.url });
    await restored.connect();
    await restored.query('BEGIN');
    // Replace the singleton default inserted by the migrations with the archived setting.
    await restored.query('DELETE FROM "ReserveGoal" WHERE id = 1');
    for (const [table, payload] of archive)
      await restored.query(`INSERT INTO "${table}" SELECT * FROM jsonb_populate_recordset(NULL::"${table}", $1)`, [
        payload,
      ]);
    await restored.query('COMMIT');

    expect(await snapshot(restored)).toEqual(archive);
    expect(await periodTotals(restored)).toEqual(totals);
  } finally {
    await restored?.end();
    await target?.close();
    await original.end();
    await source.close();
  }
}, 60000);
