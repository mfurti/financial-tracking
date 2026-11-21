import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { Client } from 'pg';
import { capturePreservationSnapshot, verifyPreservation } from './backup-preservation.js';

/** Candidate c06e7cc migration bytes reviewed independently of the mutable working directory. */
const checksums = {
  '202611060001_initial': '7de32f61785fd8197bc370a8c7c3924dcf2623187bb2020086ca44a803d6e121',
  '202611070001_accountless_csv': 'c1e990d85cee860fea2bdba01ff45ced3de5fae2403b00acb79383b6285e002d',
  '202611080001_category_rules': '3ed56e21591eea889d1e9bf937546542a4cc3f06f4b5d6fc1928429081790294',
  '202611080002_contracts': '89ece2a20bf3e646a1ec5df379eb2a8d8da87e45d30f1b8533a730ed818e7f96',
  '202611080003_import_rollback': '0af4f63cdc246209b2912b2146b966e5079f0e4e6ff6a33edb148d62c893f87a',
  '202611080004_suggestion_decisions': 'ce229a494c81f4e21f08a472eccf1c94ccf83ba050a23817de807297eb99b1e1',
  '202611180001_reserve_wealth': 'd0f98cd462640d808a3fec7ea7b805100445bcd58a23797c802dd6c05ac52c82',
  '202611180002_workspace_settings': '9326e8dca5d36adb2f97072a64a242eb8087b12915df3fc64f23fb766ca561ed',
};

/** Explicit additive-table ownership; this is not a parser accepting arbitrary new migration SQL. */
const additions: Record<string, readonly string[]> = {
  '202611180001_reserve_wealth': ['AccountPresentation', 'ReserveGoal', 'WealthRecord', 'WealthRecordComponent'],
  '202611180002_workspace_settings': [
    'OwnerProfile',
    'AccountGroup',
    'AccountGroupMember',
    'NotificationAcknowledgement',
  ],
};

/** Exact reviewed candidate migration with its immutable bytes and permitted additive tables. */
export type ReviewedTargetMigration = { name: string; checksum: string; sql: string; newTables: readonly string[] };

/** Private full-ledger text stays in memory while safe fields establish the reviewed migration prefix. */
type LedgerRow = {
  name: string;
  checksum: string;
  completed: boolean;
  rolledBack: boolean;
  steps: number;
  snapshot: string;
};

/** Emit a bounded gate code rather than raw SQL, credential or financial data. */
function fail(code: string): never {
  throw new Error(`Target backup verification failed: ${code}`);
}

/** Load only the eight reviewed c06e7cc migrations and reject altered or extra files before execution. */
export async function loadTargetMigrationReview(
  root = resolve('apps/api/prisma/migrations'),
): Promise<ReviewedTargetMigration[]> {
  try {
    const names = (await readdir(root))
      .filter(/** Exclude only provider metadata, never an additional migration. */ (name) => /^\d/.test(name))
      .sort();
    if (JSON.stringify(names) !== JSON.stringify(Object.keys(checksums))) fail('UNREVIEWED_MIGRATION_FILES');
    const review: ReviewedTargetMigration[] = [];
    for (const name of Object.keys(checksums) as (keyof typeof checksums)[]) {
      const bytes = await readFile(resolve(root, name, 'migration.sql'));
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if (checksum !== checksums[name]) fail('UNREVIEWED_MIGRATION_FILES');
      review.push({ name, checksum, sql: bytes.toString('utf8'), newTables: additions[name] ?? [] });
    }
    return review;
  } catch {
    return fail('UNREVIEWED_MIGRATION_FILES');
  }
}

/** Read safe ledger identity/status together with exact original fields for private in-memory equality. */
async function ledger(client: Pick<Client, 'query'>): Promise<LedgerRow[]> {
  return (
    await client.query<LedgerRow>(
      `SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS completed,
      rolled_back_at IS NOT NULL AS "rolledBack", applied_steps_count AS steps,
      row_to_json(record)::text AS snapshot FROM "public"."_prisma_migrations" record ORDER BY migration_name`,
    )
  ).rows;
}

/** Require one successful unchanged-checksum prefix; failed, rolled-back, skipped and unknown entries need review. */
function validateLedger(rows: LedgerRow[], review: readonly ReviewedTargetMigration[], complete: boolean) {
  if (rows.length < 6 || rows.length > review.length || (complete && rows.length !== review.length))
    fail('MIGRATION_HISTORY_INVALID');
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!;
    const expected = review[index];
    if (
      !expected ||
      row.name !== expected.name ||
      row.checksum !== expected.checksum ||
      !row.completed ||
      row.rolledBack ||
      row.steps !== 1
    )
      fail('MIGRATION_HISTORY_INVALID');
  }
}

/**
 * Verify a populated isolated archive, run only reviewed pending upgrade work, and prove complete preservation.
 * The caller owns the empty isolated target and migration callback; this function opens no production connection.
 */
export async function verifyTargetBackupUpgrade(
  client: Pick<Client, 'query'>,
  migrate: () => Promise<void>,
  review: readonly ReviewedTargetMigration[],
) {
  try {
    const expectedNames = Object.keys(checksums);
    if (
      review.length !== expectedNames.length ||
      review.some(
        /** Reject caller-supplied review metadata or bytes that differ from the selected candidate. */ (
          migration,
          index,
        ) =>
          migration.name !== expectedNames[index] ||
          migration.checksum !== checksums[migration.name as keyof typeof checksums] ||
          createHash('sha256').update(migration.sql).digest('hex') !== migration.checksum ||
          JSON.stringify(migration.newTables) !== JSON.stringify(additions[migration.name] ?? []),
      )
    )
      fail('UNREVIEWED_MIGRATION_FILES');
    const before = await capturePreservationSnapshot(client);
    const users = before.tables.find(
      /** Verify the restored singleton owner exists before any disposable rotation. */ (table) =>
        table.name === 'User',
    );
    const transactions = before.tables.find(
      /** Require actual populated financial backup evidence. */ (table) => table.name === 'Transaction',
    );
    if (users?.rows.length !== 1 || !transactions?.rows.length) fail('POPULATED_ARCHIVE_REQUIRED');
    const originalLedger = await ledger(client);
    validateLedger(originalLedger, review, false);
    const pending = review.slice(originalLedger.length);
    const newTables = pending.flatMap(
      /** Collect only explicitly owned tables for actually pending migrations. */ (migration) => [
        ...migration.newTables,
      ],
    );
    if (
      before.tables.some(
        /** A new table without its completed ledger entry signals partial schema drift. */ (table) =>
          newTables.includes(table.name),
      )
    )
      fail('ADDITIVE_SCHEMA_INVALID');
    if (pending.length) {
      try {
        await migrate();
      } catch {
        fail('MIGRATION_FAILED');
      }
    }
    const after = await capturePreservationSnapshot(client);
    const proof = verifyPreservation(before, after, newTables);
    const resultingLedger = await ledger(client);
    validateLedger(resultingLedger, review, true);
    for (const original of originalLedger) {
      if (
        resultingLedger.find(
          /** Match the exact original ledger record independently of new migration rows. */ (row) =>
            row.name === original.name,
        )?.snapshot !== original.snapshot
      )
        fail('MIGRATION_HISTORY_CHANGED');
    }
    for (const name of newTables) {
      const table = after.tables.find(
        /** Each expected new object must exist after successful migration. */ (candidate) => candidate.name === name,
      );
      if (!table) fail('ADDITIVE_SCHEMA_INVALID');
      if (name === 'ReserveGoal') {
        const seed = (
          await client.query<{ id: number; cents: string }>(
            'SELECT id, "targetCents"::text AS cents FROM "public"."ReserveGoal"',
          )
        ).rows;
        if (seed.length !== 1 || seed[0]!.id !== 1 || seed[0]!.cents !== '300000') fail('ADDITIVE_DEFAULTS_INVALID');
      } else if (table.rows.length) fail('ADDITIVE_DEFAULTS_INVALID');
    }
    return {
      before,
      after,
      proof,
      pendingMigrations: pending.map(
        /** Publish names only, never ledger logs or record values. */ (migration) => migration.name,
      ),
      ledgerVerified: true,
      newTablesVerified: true,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      /^(?:Preservation failed|Target backup verification failed): [A-Z_]+$/.test(error.message)
    )
      throw error;
    return fail('EVIDENCE_UNAVAILABLE');
  }
}
