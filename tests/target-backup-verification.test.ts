import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { testDatabase } from './database.js';
import { loadTargetMigrationReview, verifyTargetBackupUpgrade } from '../scripts/target-backup-verification.js';

describe('target archive migration and preservation gates', /** Rehearse the reviewed schema chain only in an owned disposable database. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let client: Client;
  let review: Awaited<ReturnType<typeof loadTargetMigrationReview>>;
  let applied: Set<string>;
  beforeAll(
    /** Create an explicitly isolated fixture and load actual reviewed migration bytes. */ async () => {
      resource = await testDatabase({ empty: true, isolated: true });
      client = new Client({ connectionString: resource.url });
      await client.connect();
      review = await loadTargetMigrationReview();
    },
  );
  afterAll(
    /** Close only the owned fixture and its connection. */ async () => {
      await client?.end();
      await resource?.close();
    },
  );
  /** Simulate the migrator with actual migration SQL and the same successful ledger fields. */
  async function applyPending(limit = review.length) {
    for (const migration of review.slice(0, limit)) {
      if (applied.has(migration.name)) continue;
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO "_prisma_migrations" (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ($1,$2,$3,now(),1)',
        [randomUUID(), migration.checksum, migration.name],
      );
      applied.add(migration.name);
    }
  }
  beforeEach(
    /** Populate the actual pre-feature schema and a complete successful baseline ledger. */ async () => {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
      await client.query(`CREATE TABLE "_prisma_migrations" (
      id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL, finished_at timestamptz,
      migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz,
      started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0
    )`);
      applied = new Set();
      await applyPending(6);
      await resource.db.user.create({
        data: { username: 'synthetic-recovery-owner', passwordHash: 'synthetic-private-hash' },
      });
      await resource.db.transaction.create({
        data: {
          amountCents: 9007199254740993n,
          bookingDate: new Date('2026-11-21'),
          description: 'synthetic accountless history',
        },
      });
    },
  );

  it('preserves all 18 old application tables and verifies both migrations and only the approved seed', /** Successful upgrade proof covers metadata as well as financial rows. */ async () => {
    const result = await verifyTargetBackupUpgrade(client, applyPending, review);
    expect(result.proof.tableCount).toBe(18);
    expect(result.after.tables).toHaveLength(26);
    expect(result.pendingMigrations).toEqual(['202611180001_reserve_wealth', '202611180002_workspace_settings']);
    expect(result.ledgerVerified).toBe(true);
    expect(result.newTablesVerified).toBe(true);
  });

  it('preserves existing reserve metadata when only the workspace migration is pending', /** Previously deployed user values are not reset to the initial seed. */ async () => {
    await applyPending(7);
    await client.query('UPDATE "ReserveGoal" SET "targetCents"=987654321');
    const result = await verifyTargetBackupUpgrade(client, applyPending, review);
    expect(result.proof.tableCount).toBe(22);
    expect(result.pendingMigrations).toEqual(['202611180002_workspace_settings']);
    expect((await client.query('SELECT "targetCents"::text AS cents FROM "ReserveGoal"')).rows[0].cents).toBe(
      '987654321',
    );
  });

  it('does not invoke migration when the complete reviewed schema already exists', /** Idempotent recovery still compares all original metadata and rows. */ async () => {
    await applyPending();
    let invoked = false;
    const result = await verifyTargetBackupUpgrade(
      client,
      /** A fully applied archive needs no migration mutation. */ async () => {
        invoked = true;
      },
      review,
    );
    expect(result.pendingMigrations).toEqual([]);
    expect(result.proof.tableCount).toBe(26);
    expect(invoked).toBe(false);
  });

  it('refuses an unpopulated archive before invoking migration', /** An initialized but financially empty fixture is insufficient for production recovery proof. */ async () => {
    await client.query('DELETE FROM "Transaction"');
    await expect(verifyTargetBackupUpgrade(client, applyPending, review)).rejects.toThrow('POPULATED_ARCHIVE_REQUIRED');
    expect(applied.size).toBe(6);
  });

  it('detects original credential corruption without disclosing its value', /** Migration callbacks cannot silently rewrite preserved fields. */ async () => {
    await expect(
      verifyTargetBackupUpgrade(
        client,
        /** Deliberately corrupt only a synthetic disposable row after the upgrade. */ async () => {
          await applyPending();
          await client.query('UPDATE "User" SET "passwordHash"=\'changed-synthetic-hash\'');
        },
        review,
      ),
    ).rejects.toThrow('Preservation failed: ROWS_CHANGED');
  });

  it('rejects a modified original checksum before migration', /** Unreviewed historical SQL cannot be accepted as this candidate baseline. */ async () => {
    await client.query('UPDATE "_prisma_migrations" SET checksum=$1 WHERE migration_name=$2', [
      '0'.repeat(64),
      review[0]!.name,
    ]);
    await expect(verifyTargetBackupUpgrade(client, applyPending, review)).rejects.toThrow('MIGRATION_HISTORY_INVALID');
    expect(applied.size).toBe(6);
  });

  it('detects changed original ledger fields after migration', /** Expected new ledger entries do not permit changing prior evidence. */ async () => {
    await expect(
      verifyTargetBackupUpgrade(
        client,
        /** Change an original completed ledger timestamp in the isolated copy. */ async () => {
          await applyPending();
          await client.query(
            'UPDATE "_prisma_migrations" SET finished_at=finished_at+interval \'1 second\' WHERE migration_name=$1',
            [review[0]!.name],
          );
        },
        review,
      ),
    ).rejects.toThrow('MIGRATION_HISTORY_CHANGED');
  });

  it('requires every expected additive table even when a ledger claims success', /** A completed ledger cannot conceal missing new schema objects. */ async () => {
    await expect(
      verifyTargetBackupUpgrade(
        client,
        /** Remove one empty new table after otherwise applying the candidate. */ async () => {
          await applyPending();
          await client.query('DROP TABLE "OwnerProfile"');
        },
        review,
      ),
    ).rejects.toThrow('ADDITIVE_SCHEMA_INVALID');
  });

  it('rejects a wrong default reserve target', /** The only permitted new record is the exact approved initial seed. */ async () => {
    await expect(
      verifyTargetBackupUpgrade(
        client,
        /** Corrupt the synthetic seed to prove its value is checked. */ async () => {
          await applyPending();
          await client.query('UPDATE "ReserveGoal" SET "targetCents"=300001');
        },
        review,
      ),
    ).rejects.toThrow('ADDITIVE_DEFAULTS_INVALID');
  });

  it('rejects fabricated new profiles', /** Migration must not invent owner metadata or account eligibility. */ async () => {
    await expect(
      verifyTargetBackupUpgrade(
        client,
        /** Create only a synthetic unexpected profile in the isolated schema. */ async () => {
          await applyPending();
          await client.query(
            'INSERT INTO "OwnerProfile" ("userId","displayName","updatedAt") SELECT id,\'unexpected synthetic profile\',now() FROM "User"',
          );
        },
        review,
      ),
    ).rejects.toThrow('ADDITIVE_DEFAULTS_INVALID');
  });

  it('rejects an extra unreviewed migration entry', /** Candidate history is an explicit finite reviewed chain. */ async () => {
    await expect(
      verifyTargetBackupUpgrade(
        client,
        /** Add an invented ledger record to the disposable copy. */ async () => {
          await applyPending();
          await client.query(
            'INSERT INTO "_prisma_migrations" (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ($1,$2,$3,now(),1)',
            [randomUUID(), '0'.repeat(64), '209901010001_unreviewed'],
          );
        },
        review,
      ),
    ).rejects.toThrow('MIGRATION_HISTORY_INVALID');
  });

  it('rejects altered reviewed SQL bytes before any migration', /** A valid copied checksum does not authorize different SQL content. */ async () => {
    const altered = review.map(
      /** Change only a synthetic review copy, never source migration files. */ (migration, index) => ({
        ...migration,
        sql: index === 0 ? migration.sql + '\n-- unreviewed change' : migration.sql,
      }),
    );
    await expect(verifyTargetBackupUpgrade(client, applyPending, altered)).rejects.toThrow(
      'UNREVIEWED_MIGRATION_FILES',
    );
    expect(applied.size).toBe(6);
  });

  it('sanitizes migration execution failure', /** Raw driver/subprocess details may contain values and must not be emitted. */ async () => {
    await expect(
      verifyTargetBackupUpgrade(
        client,
        /** Simulate a sensitive low-level failure without exposing it. */ async () => {
          throw new Error('synthetic-private-password-and-row');
        },
        review,
      ),
    ).rejects.toThrow('Target backup verification failed: MIGRATION_FAILED');
  });
});
