import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { LedgerService } from '../apps/api/src/ledger.js';

/** Apply the actual reviewed migration after the full immediately preceding schema. */
const migration = '202611180002_workspace_settings';
/** Source migration location is owned by this repository, never a configured live database. */
const migrationRoot = 'apps/api/prisma/migrations';
/** Preserve exact PostgreSQL row text, including BIGINT digits and original timestamps. */
async function snapshot(client: Client, names?: string[]) {
  const tables =
    names ??
    (
      await client.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows.map(/** Accept only server-owned table names from the disposable schema. */ (row) => row.tablename);
  const result: Record<string, string[]> = {};
  for (const name of tables) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error('Unexpected owned table');
    result[name] = (
      await client.query<{ row: string }>(
        `SELECT row_to_json(record)::text AS row FROM "${name}" record ORDER BY row_to_json(record)::text`,
      )
    ).rows.map(/** Retain original scalar text instead of parsing money into Number. */ (row) => row.row);
  }
  return result;
}

describe('additive workspace settings migration', /** Expand a populated previous schema without changing its rows or access model. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>, client: Client;
  let accountId: string, ownerId: string;
  beforeAll(
    /** Seed every pre-workspace table before applying the new metadata expansion. */ async () => {
      resource = await testDatabase({ empty: true });
      client = new Client({ connectionString: resource.url });
      await client.connect();
      for (const name of (await readdir(migrationRoot))
        .filter(/** Exclude metadata and the migration under test. */ (name) => /^\d/.test(name) && name < migration)
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
      const contract = await db.contract.create({
        data: {
          name: 'Legacy contract',
          provider: 'Legacy provider',
          kind: 'OTHER',
          accountId,
          startDate: new Date('2035-01-31'),
          revisions: { create: { effectiveDate: new Date('2035-01-31'), amountCents: 1234n, intervalMonths: 1 } },
        },
        include: { revisions: true },
      });
      await db.contractPayment.create({
        data: {
          contractId: contract.id,
          revisionId: contract.revisions[0]!.id,
          dueDate: new Date('2035-01-31'),
          transactionId: transaction.id,
          source: 'MANUAL',
        },
      });
      await db.contractSuggestionDecision.create({
        data: { key: 'c'.repeat(64), state: 'CONFIRMED', contractId: contract.id },
      });

      ownerId = (await resource.db.user.findFirstOrThrow()).id;
      await resource.db.accountPresentation.create({ data: { accountId, reserveEligible: true } });
      await resource.db.wealthRecord.create({
        data: {
          idempotencyKey: 'workspace-before',
          totalCents: -9007199254740993n,
          coverage: 'COMPLETE',
          components: {
            create: {
              accountId,
              sourceLabel: 'Frozen pre-workspace source',
              sourceType: 'CSV',
              amountCents: -9007199254740993n,
              observedAt: new Date('2035-01-31'),
            },
          },
        },
      });
    },
  );
  afterAll(
    /** Close and remove only the owned test resources. */ async () => {
      await client?.end();
      await resource?.close();
    },
  );

  it('preserves every field in all 22 populated previous tables and existing account readers/writers', /** No profile, group or acknowledgement is fabricated during expansion. */ async () => {
    const before = await snapshot(client);
    expect(Object.keys(before)).toHaveLength(22);
    expect(
      Object.values(before).every(
        /** All previous tables must contain actual fixture rows. */ (rows) => rows.length > 0,
      ),
    ).toBe(true);
    const ledger = new LedgerService(resource.db),
      accounts = await ledger.accounts();
    await client.query('BEGIN');
    try {
      await client.query(await readFile(resolve(migrationRoot, migration, 'migration.sql'), 'utf8'));
      await client.query('COMMIT');
    } catch (caught) {
      await client.query('ROLLBACK');
      throw caught;
    }
    expect(await snapshot(client, Object.keys(before))).toEqual(before);
    expect(await ledger.accounts()).toEqual(accounts);
    expect(await resource.db.ownerProfile.count()).toBe(0);
    expect(await resource.db.accountGroup.count()).toBe(0);
    expect(await resource.db.notificationAcknowledgement.count()).toBe(0);
    await resource.db.account.update({ where: { id: accountId }, data: { name: 'Previous-field writer' } });
    expect((await ledger.accounts())[0]!.name).toBe('Previous-field writer');
    expect((await resource.db.user.findUniqueOrThrow({ where: { id: ownerId } })).singleton).toBe(1);
  });

  it('enforces profile owner/key/name/email constraints without credential changes', /** Contact data is independent of the existing login and singleton restriction. */ async () => {
    const owner = await resource.db.user.findUniqueOrThrow({ where: { id: ownerId } });
    const valid = { userId: ownerId, displayName: 'Workspace owner', contactEmail: 'contact@example.test' };
    await resource.db.ownerProfile.create({ data: valid });
    await expect(resource.db.ownerProfile.create({ data: valid })).rejects.toThrow();
    for (const displayName of ['', ' ', ' trailing ', 'x'.repeat(81)])
      await expect(
        resource.db.ownerProfile.update({ where: { userId: ownerId }, data: { displayName } }),
      ).rejects.toThrow();
    for (const contactEmail of ['invalid', 'x@', ' x@example.test', `${'x'.repeat(250)}@example.test`])
      await expect(
        resource.db.ownerProfile.update({ where: { userId: ownerId }, data: { contactEmail } }),
      ).rejects.toThrow();
    await expect(resource.db.ownerProfile.create({ data: { ...valid, userId: randomUUID() } })).rejects.toThrow();
    await resource.db.ownerProfile.update({ where: { userId: ownerId }, data: { contactEmail: null } });
    expect(await resource.db.user.findUniqueOrThrow({ where: { id: ownerId } })).toEqual(owner);
    await expect(resource.db.user.create({ data: { username: 'second', passwordHash: 'fixture' } })).rejects.toThrow();
  });

  it('enforces bounded unique groups and atomic membership-only cascades', /** Deleting groups never deletes accounts; deleting an unobserved account removes only its membership. */ async () => {
    const db = resource.db;
    for (const name of ['', ' ', ' trailing ', 'x'.repeat(61)])
      await expect(db.accountGroup.create({ data: { name } })).rejects.toThrow();
    await expect(db.accountGroup.create({ data: { name: 'Negative', sortOrder: -1 } })).rejects.toThrow();
    const group = await db.accountGroup.create({ data: { name: 'Household', members: { create: { accountId } } } });
    await expect(db.accountGroup.create({ data: { name: 'hOuSeHoLd' } })).rejects.toThrow();
    await expect(db.accountGroupMember.create({ data: { groupId: group.id, accountId } })).rejects.toThrow();
    await expect(
      db.accountGroupMember.create({ data: { groupId: group.id, accountId: randomUUID() } }),
    ).rejects.toThrow();
    const financial = await db.account.findUniqueOrThrow({ where: { id: accountId } });
    await db.accountGroup.delete({ where: { id: group.id } });
    expect(await db.accountGroupMember.count()).toBe(0);
    expect(await db.account.findUniqueOrThrow({ where: { id: accountId } })).toEqual(financial);
    const temporary = await db.account.create({
      data: { name: 'Removable membership only', bankConnectionId: financial.bankConnectionId },
    });
    const remaining = await db.accountGroup.create({
      data: { name: 'Remaining', members: { create: { accountId: temporary.id } } },
    });
    await db.account.delete({ where: { id: temporary.id } });
    expect(await db.accountGroup.findUnique({ where: { id: remaining.id } })).not.toBeNull();
    expect(await db.accountGroupMember.count()).toBe(0);
  });

  it('bounds acknowledgement composite identities without mutating any source', /** Repeat acknowledgement identities cannot duplicate metadata or change import/contract records. */ async () => {
    const before = await snapshot(client, [
      'ImportRun',
      'ImportIssue',
      'Contract',
      'ContractRevision',
      'ContractPayment',
      'Transaction',
      'BalanceSnapshot',
    ]);
    const data = { userId: ownerId, sourceKey: 'import:fixture:revision-1' };
    await resource.db.notificationAcknowledgement.create({ data });
    await expect(resource.db.notificationAcknowledgement.create({ data })).rejects.toThrow();
    for (const sourceKey of ['', ' ', ' leading', 'x'.repeat(257)])
      await expect(resource.db.notificationAcknowledgement.create({ data: { ...data, sourceKey } })).rejects.toThrow();
    await expect(
      resource.db.notificationAcknowledgement.create({ data: { ...data, userId: randomUUID() } }),
    ).rejects.toThrow();
    expect(await snapshot(client, Object.keys(before))).toEqual(before);
  });

  it('installs the full schema cleanly without profile/group/acknowledgement backfills', /** Clean and populated migration paths exercise the same reviewed SQL. */ async () => {
    const fresh = await testDatabase();
    try {
      expect(await fresh.db.ownerProfile.count()).toBe(0);
      expect(await fresh.db.accountGroup.count()).toBe(0);
      expect(await fresh.db.notificationAcknowledgement.count()).toBe(0);
      expect(await fresh.db.reserveGoal.findUnique({ where: { id: 1 } })).toMatchObject({ targetCents: 300000n });
    } finally {
      await fresh.close();
    }
  });
});
