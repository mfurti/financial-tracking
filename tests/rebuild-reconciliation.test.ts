import { expect, it } from 'vitest';
import { Client } from 'pg';
import { createApp } from '../apps/api/src/app.js';
import { transactionPageSchema, transactionTablePageSchema } from '../packages/contracts/src/index.js';
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
    data: {
      name: 'Synthetic source',
      bankCode: '69050001',
      connectorType: 'CSV',
      metadata: { fixture: 'stored-bank-settings' },
    },
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

/** Check the same synthetic restore through authenticated HTTP contracts. */
async function verifyRestoredApp(db: Awaited<ReturnType<typeof testDatabase>>['db'], accountId: string) {
  const { app } = await createApp(db, false);
  try {
    expect((await app.inject({ method: 'GET', url: '/api/v1/transactions/table' })).statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'http://localhost:3000' },
      payload: { username: 'rebuild-restore-owner', password: 'rebuild-fixture-password-only' },
    });
    expect(login.statusCode).toBe(201);
    const headers = { cookie: String(login.headers['set-cookie']).split(';')[0]! };
    const blocked = await app.inject({
      method: 'PATCH',
      url: `/api/v1/accounts/${accountId}`,
      headers: { ...headers, origin: 'http://localhost:3000', 'x-csrf-token': 'invalid' },
      payload: { name: 'Rejected account rename' },
    });
    expect(blocked.statusCode).toBe(403);
    const table = await app.inject({ method: 'GET', url: '/api/v1/transactions/table', headers });
    expect(table.statusCode).toBe(200);
    expect(table.json()).toMatchObject({ meta: { itemCount: 4 } });
    const old = await app.inject({ method: 'GET', url: '/api/v1/transactions', headers });
    const oldRows = transactionPageSchema.parse(old.json()).items;
    const newRows = transactionTablePageSchema.parse(table.json()).items;
    expect(
      newRows.map(
        /** Compare the durable list fields with the prior cursor contract. */ (row) => [
          row.id,
          row.accountId,
          row.amountCents,
        ],
      ),
    ).toEqual(
      oldRows.map(
        /** Keep routing-only projections out of the comparison. */ (row) => [row.id, row.accountId, row.amountCents],
      ),
    );
    const connections = await app.inject({ method: 'GET', url: '/api/v1/bank-connections', headers });
    expect(connections.statusCode).toBe(200);
    expect(connections.json()[0]).not.toHaveProperty('metadata');
    const totals = await app.inject({ method: 'GET', url: '/api/v1/analytics/monthly?month=2026-10', headers });
    expect(totals.statusCode).toBe(200);
    expect(totals.json()).toMatchObject({
      incomeCents: '99',
      expenseCents: '9007199254740993',
      netCents: '-9007199254740894',
    });
  } finally {
    await app.close();
  }
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

    await verifyRestoredApp(target.db, ids.accountId);
    expect(await snapshot(restored)).toEqual(archive);
    expect(await periodTotals(restored)).toEqual(totals);
  } finally {
    await restored?.end();
    await target?.close();
    await original.end();
    await source.close();
  }
}, 60000);
