import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { seedHistoricalContract, testDatabase } from './database.js';
import { LedgerService } from '../apps/api/src/ledger.js';

const migration = '202611180001_reserve_wealth';
const migrationRoot = resolve('apps/api/prisma/migrations');

/** Preserve exact PostgreSQL JSON text, including BIGINT digits, instead of parsing amounts through Number. */
async function snapshot(client: Client, names?: string[]) {
  const tables =
    names ??
    (
      await client.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows.map(/** Use only server-owned identifiers from the disposable schema. */ (row) => row.tablename);
  const result: Record<string, string[]> = {};
  for (const name of tables) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error('Unexpected fixture table identifier');
    result[name] = (
      await client.query<{ row: string }>(
        `SELECT row_to_json(record)::text AS row FROM "${name}" record ORDER BY row_to_json(record)::text`,
      )
    ).rows.map(/** Retain exact textual field values and deterministic row ordering. */ (row) => row.row);
  }
  return result;
}

describe('additive reserve and recorded-wealth migration', /** Upgrade representative populated old tables and exercise the new constraints in owned PostgreSQL. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let client: Client;
  let accountId: string;
  beforeAll(
    /** Apply only pre-feature migrations to a fresh disposable database, then populate every existing table. */ async () => {
      resource = await testDatabase({ empty: true, isolated: true });
      client = new Client({ connectionString: resource.url });
      await client.connect();
      for (const name of (await readdir(migrationRoot))
        .filter(
          /** Exclude provider metadata and the migration under test. */ (name) => /^\d/.test(name) && name < migration,
        )
        .sort())
        await client.query(await readFile(resolve(migrationRoot, name, 'migration.sql'), 'utf8'));
      const db = resource.db;
      const user = await db.user.create({ data: { username: 'migration-owner', passwordHash: 'synthetic-hash' } });
      await db.session.create({
        data: {
          tokenHash: 'a'.repeat(64),
          userId: user.id,
          csrfToken: 'synthetic-csrf',
          expiresAt: new Date('2039-01-01'),
        },
      });
      const connection = await db.bankConnection.create({
        data: { name: 'Legacy bank', bankCode: '69050001', connectorType: 'CSV' },
      });
      const account = await db.account.create({
        data: { bankConnectionId: connection.id, name: 'Legacy EUR', iban: null },
      });
      accountId = account.id;
      const run = await db.importRun.create({
        data: {
          bankConnectionId: connection.id,
          source: 'CSV',
          status: 'COMPLETED',
          importedCount: 3,
          finishedAt: new Date('2035-01-31'),
        },
      });
      await db.balanceSnapshot.create({
        data: {
          accountId,
          importRunId: run.id,
          amountCents: 9007199254740993n,
          balanceType: 'BOOKED',
          observedAt: new Date('2035-01-31'),
          source: 'CSV',
        },
      });
      const category = await db.category.create({ data: { name: 'Legacy manual', kind: 'BOTH' } });
      const rule = await db.categoryRule.create({
        data: { name: 'Legacy rule', categoryId: category.id, matchType: 'DESCRIPTION', text: 'Legacy' },
      });
      const transaction = await db.transaction.create({
        data: {
          accountId,
          createdByImportRunId: run.id,
          amountCents: -9007199254740993n,
          bookingDate: new Date('2035-01-31'),
          description: 'Legacy exact payment',
          counterpartyName: null,
          categoryId: category.id,
          categoryOrigin: 'MANUAL',
          classification: 'VARIABLE',
          categoryRuleId: rule.id,
          categoryRuleName: rule.name,
        },
      });
      await db.transactionIdentity.create({
        data: {
          accountId,
          scope: `account:${accountId}`,
          importRunId: run.id,
          identityType: 'BANK_REFERENCE',
          identityValue: 'legacy-reference',
          transactionId: transaction.id,
        },
      });
      const group = await db.transferGroup.create({ data: {} });
      await db.transaction.createMany({
        data: [-1001n, 1001n].map(
          /** Keep both original opposing legs and their common transfer identity. */ (amountCents) => ({
            accountId,
            amountCents,
            bookingDate: new Date('2035-01-30'),
            description: 'Legacy own transfer',
            isTransfer: true,
            transferGroupId: group.id,
          }),
        ),
      });
      const staged = await db.stagedRow.create({
        data: {
          accountId,
          runId: run.id,
          rowNumber: 4,
          data: { amountCents: '-1234', description: 'Legacy staged row' },
        },
      });
      await db.importIssue.create({
        data: {
          runId: run.id,
          stagedRowId: staged.id,
          rowNumber: 4,
          code: 'REVIEW_REQUIRED',
          message: 'Legacy review',
          candidateIds: [transaction.id],
        },
      });
      await db.assignmentReceipt.create({
        data: { id: randomUUID(), inputHash: 'b'.repeat(64), result: { updated: 0, results: [] } },
      });
      const { contractId, revisionId } = await seedHistoricalContract(client, accountId);
      await db.contractPayment.create({
        data: {
          contractId,
          revisionId,
          dueDate: new Date('2035-01-31'),
          transactionId: transaction.id,
          source: 'MANUAL',
        },
      });
      await db.contractSuggestionDecision.create({
        data: { key: 'c'.repeat(64), state: 'CONFIRMED', contractId },
      });
    },
  );
  afterAll(
    /** Release only the test-owned connection and PostgreSQL resources. */ async () => {
      await client?.end();
      await resource?.close();
    },
  );

  it('preserves every old table row/field and old account reads/writes after the expansion', /** Default reserve metadata must never fabricate balance or historical wealth records. */ async () => {
    const before = await snapshot(client);
    expect(
      Object.values(before).every(
        /** Every pre-feature table contains representative source data. */ (rows) => rows.length > 0,
      ),
    ).toBe(true);
    const ledger = new LedgerService(resource.db);
    const accounts = await ledger.accounts();
    await client.query('BEGIN');
    try {
      await client.query(await readFile(resolve(migrationRoot, migration, 'migration.sql'), 'utf8'));
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    }
    expect(await snapshot(client, Object.keys(before))).toEqual(before);
    expect(await ledger.accounts()).toEqual(accounts);
    await resource.db.account.update({ where: { id: accountId }, data: { name: 'Old-field writer still works' } });
    expect((await ledger.accounts())[0]?.name).toBe('Old-field writer still works');
    expect(await resource.db.wealthRecord.count()).toBe(0);
    expect(await resource.db.wealthRecordComponent.count()).toBe(0);
    expect(await resource.db.accountPresentation.count()).toBe(0);
    expect(await resource.db.reserveGoal.findUnique({ where: { id: 1 } })).toMatchObject({ targetCents: 300000n });
  });

  it('enforces singleton/default/positive/unique/bounded metadata and foreign keys', /** Invalid new metadata cannot alter any existing financial source. */ async () => {
    await expect(resource.db.reserveGoal.create({ data: { id: 2, targetCents: 1n } })).rejects.toThrow();
    await expect(resource.db.reserveGoal.update({ where: { id: 1 }, data: { targetCents: 0n } })).rejects.toThrow();
    await expect(resource.db.accountPresentation.create({ data: { accountId: randomUUID() } })).rejects.toThrow();
    expect(await resource.db.accountPresentation.create({ data: { accountId } })).toMatchObject({
      reserveEligible: false,
    });
    const data = { idempotencyKey: 'migration-capture', coverage: 'PARTIAL', totalCents: -9007199254740993n };
    const record = await resource.db.wealthRecord.create({ data });
    await expect(resource.db.wealthRecord.create({ data })).rejects.toThrow();
    await expect(
      resource.db.wealthRecord.create({ data: { ...data, idempotencyKey: 'x'.repeat(129) } }),
    ).rejects.toThrow();
    await expect(
      resource.db.wealthRecord.create({ data: { ...data, idempotencyKey: 'other', coverage: 'UNKNOWN' } }),
    ).rejects.toThrow();
    await expect(
      resource.db.wealthRecordComponent.create({
        data: { recordId: record.id, accountId: randomUUID(), sourceLabel: 'Unknown', sourceType: 'LEGACY' },
      }),
    ).rejects.toThrow();
    for (const patch of [{ sourceLabel: 'x'.repeat(121) }, { sourceType: 'x'.repeat(65) }])
      await expect(
        resource.db.wealthRecordComponent.create({
          data: { recordId: record.id, sourceLabel: 'Bounded', sourceType: 'LEGACY', ...patch },
        }),
      ).rejects.toThrow();
  });

  it('freezes source values across balance changes and retains unknowns after account removal', /** SetNull removes only optional identity links, preserving source label, cents and observation date. */ async () => {
    const connection = await resource.db.bankConnection.findFirstOrThrow();
    const removable = await resource.db.account.create({
      data: { name: 'Removable source', bankConnectionId: connection.id },
    });
    await resource.db.accountPresentation.create({ data: { accountId: removable.id, reserveEligible: true } });
    const recordedAt = new Date('2035-01-31T12:00:00Z');
    const record = await resource.db.wealthRecord.create({
      data: {
        idempotencyKey: 'frozen-source',
        recordedAt,
        totalCents: -12n,
        coverage: 'PARTIAL',
        components: {
          create: [
            {
              accountId: removable.id,
              sourceLabel: removable.name,
              amountCents: -12n,
              observedAt: recordedAt,
              sourceType: 'BOOKED',
            },
            { sourceLabel: 'Unknown source', amountCents: null, observedAt: null, sourceType: 'MISSING' },
          ],
        },
      },
      include: { components: { orderBy: { sourceLabel: 'asc' } } },
    });
    await resource.db.balanceSnapshot.updateMany({ data: { amountCents: 42n } });
    expect(
      await resource.db.wealthRecord.findUnique({
        where: { id: record.id },
        include: { components: { orderBy: { sourceLabel: 'asc' } } },
      }),
    ).toEqual(record);
    await resource.db.account.delete({ where: { id: removable.id } });
    expect(await resource.db.accountPresentation.findUnique({ where: { accountId: removable.id } })).toBeNull();
    const retained = await resource.db.wealthRecord.findUniqueOrThrow({
      where: { id: record.id },
      include: { components: true },
    });
    expect(
      retained.components.find(
        /** Read the frozen original label after its optional source account is gone. */ (item) =>
          item.sourceLabel === removable.name,
      ),
    ).toMatchObject({ accountId: null, amountCents: -12n, observedAt: recordedAt });
    expect(
      retained.components.find(
        /** Missing amount/date must remain explicitly unknown. */ (item) => item.sourceType === 'MISSING',
      ),
    ).toMatchObject({ amountCents: null, observedAt: null });
    await expect(resource.db.wealthRecord.delete({ where: { id: record.id } })).rejects.toThrow();
  });

  it('applies the complete clean migration path with no invented observations', /** Fresh installs and populated upgrades must agree on the same goal and empty history. */ async () => {
    const fresh = await testDatabase();
    try {
      expect(await fresh.db.reserveGoal.findUnique({ where: { id: 1 } })).toMatchObject({ targetCents: 300000n });
      expect(await fresh.db.user.count()).toBe(0);
      expect(await fresh.db.balanceSnapshot.count()).toBe(0);
      expect(await fresh.db.wealthRecord.count()).toBe(0);
    } finally {
      await fresh.close();
    }
  });
});
