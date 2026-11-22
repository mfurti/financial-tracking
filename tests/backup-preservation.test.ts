import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { testDatabase } from './database.js';
import { capturePreservationSnapshot, verifyPreservation } from '../scripts/backup-preservation.js';

describe('complete original-field preservation', /** Exercise real PostgreSQL text rather than rounded JavaScript values. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let client: Client;
  beforeAll(
    /** Own an empty disposable database independently of production configuration. */ async () => {
      resource = await testDatabase({ empty: true, isolated: true });
      client = new Client({ connectionString: resource.url });
      await client.connect();
    },
  );
  afterAll(
    /** Release only the owned fixture database and connection. */ async () => {
      await client?.end();
      await resource?.close();
    },
  );
  beforeEach(
    /** Populate more than nine tables, including schemas without an id column. */ async () => {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
      for (let index = 0; index < 10; index++) {
        await client.query(`CREATE TABLE "Legacy${index}" (amount bigint, observed timestamptz, detail text)`);
        await client.query(`INSERT INTO "Legacy${index}" VALUES ($1, $2, $3), ($4, NULL, NULL)`, [
          '9007199254740993',
          '2026-11-21T01:02:03.123456Z',
          'synthetic-private-reference',
          '-9223372036854775807',
        ]);
      }
      await client.query(
        'CREATE TABLE "Composite" (left_key integer, right_key text, PRIMARY KEY(left_key,right_key))',
      );
      await client.query("INSERT INTO \"Composite\" VALUES (1,'a'),(1,'b')");
      await client.query('CREATE TABLE "DuplicateRows" (value text)');
      await client.query("INSERT INTO \"DuplicateRows\" VALUES ('same'),('same')");
      await client.query('CREATE TABLE "quoted""table" ("quoted""column" text)');
      await client.query('INSERT INTO "quoted""table" VALUES (\'quoted fixture\')');
      await client.query('CREATE TABLE "_prisma_migrations" (id text)');
    },
  );

  it('captures all application tables and exact signed bigint/null/microsecond values', /** Retain raw server JSON text and treat the migration ledger separately. */ async () => {
    const before = await capturePreservationSnapshot(client);
    expect(before.tables).toHaveLength(13);
    expect(
      before.tables.find(/** Check the table beyond the old hard-coded list. */ (table) => table.name === 'Legacy9'),
    ).toBeDefined();
    const rows = before.tables
      .find(/** Inspect a synthetic exact-value fixture. */ (table) => table.name === 'Legacy0')!
      .rows.join('\n');
    expect(rows).toContain('9007199254740993');
    expect(rows).toContain('-9223372036854775807');
    expect(rows).toContain('123456');
    expect(rows).toContain('null');
    expect(
      before.tables.some(
        /** The dedicated migration gate owns ledger changes. */ (table) => table.name === '_prisma_migrations',
      ),
    ).toBe(false);
    expect(verifyPreservation(before, await capturePreservationSnapshot(client))).toMatchObject({
      tableCount: 13,
      rowCount: 25,
    });
  });

  it('is independent of row order and supports composite and quoted identifiers', /** Compare multisets without depending on a single id or insertion order. */ async () => {
    const before = await capturePreservationSnapshot(client);
    const after = structuredClone(before);
    after.tables.reverse();
    for (const table of after.tables) table.rows.reverse();
    expect(verifyPreservation(before, after).tableCount).toBe(13);
  });

  it('detects omitted tables even when they are empty', /** Coverage must not depend on rows being present. */ async () => {
    await client.query('CREATE TABLE "EmptyOriginal" (value text)');
    const before = await capturePreservationSnapshot(client);
    await client.query('DROP TABLE "EmptyOriginal"');
    const after = await capturePreservationSnapshot(client);
    expect(/** Reject incomplete original-table coverage. */ () => verifyPreservation(before, after)).toThrow(
      'TABLE_MISSING',
    );
  });

  it('detects removed original fields', /** A surviving table is insufficient if its original columns are omitted. */ async () => {
    const before = await capturePreservationSnapshot(client);
    await client.query('ALTER TABLE "Legacy9" DROP COLUMN detail');
    const after = await capturePreservationSnapshot(client);
    expect(/** Reject omission of an original field. */ () => verifyPreservation(before, after)).toThrow(
      'COLUMNS_CHANGED',
    );
  });

  it('detects changed exact cents without disclosing original row values', /** Diagnostics expose gate codes rather than financial payloads. */ async () => {
    const before = await capturePreservationSnapshot(client);
    await client.query('UPDATE "Legacy9" SET amount=9007199254740994 WHERE amount=9007199254740993');
    const after = await capturePreservationSnapshot(client);
    try {
      verifyPreservation(before, after);
      throw new Error('Expected preservation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Preservation failed: ROWS_CHANGED');
      expect(String(error)).not.toContain('synthetic-private-reference');
      expect(String(error)).not.toContain('9007199254740993');
    }
  });

  it('detects duplicate-row removal without a primary key', /** Multiset equality must preserve duplicate multiplicity. */ async () => {
    const before = await capturePreservationSnapshot(client);
    await client.query('DELETE FROM "DuplicateRows" WHERE ctid IN (SELECT ctid FROM "DuplicateRows" LIMIT 1)');
    const after = await capturePreservationSnapshot(client);
    expect(/** Reject lost duplicate multiplicity. */ () => verifyPreservation(before, after)).toThrow('ROWS_CHANGED');
  });

  it('detects changed nullable timestamps and column types', /** Preserve original nulls, temporal precision and schema field types. */ async () => {
    const before = await capturePreservationSnapshot(client);
    await client.query('UPDATE "Legacy0" SET observed=\'2026-11-21T01:02:03.123457Z\' WHERE observed IS NOT NULL');
    const changed = await capturePreservationSnapshot(client);
    expect(/** Reject a one-microsecond field change. */ () => verifyPreservation(before, changed)).toThrow(
      'ROWS_CHANGED',
    );
    await client.query('ALTER TABLE "Composite" ALTER COLUMN left_key TYPE bigint');
    const changedType = await capturePreservationSnapshot(client);
    const justComposite = {
      tables: before.tables.filter(/** Isolate the independent type change. */ (table) => table.name === 'Composite'),
    };
    expect(
      /** Reject an original column type change. */ () =>
        verifyPreservation(justComposite, {
          tables: changedType.tables.filter(
            /** Compare only the same original table. */ (table) => table.name === 'Composite',
          ),
        }),
    ).toThrow('COLUMNS_CHANGED');
  });

  it('rejects unreviewed new tables and permits only explicit additive tables', /** New tables require an explicit reviewed allowlist. */ async () => {
    const before = await capturePreservationSnapshot(client);
    await client.query('CREATE TABLE "ApprovedMetadata" (value text)');
    const after = await capturePreservationSnapshot(client);
    expect(/** Reject an unreviewed additive table. */ () => verifyPreservation(before, after)).toThrow('TABLE_ADDED');
    expect(verifyPreservation(before, after, ['ApprovedMetadata']).tableCount).toBe(13);
  });

  it('rejects malformed or duplicated inventory instead of accepting missing evidence', /** A repeated table cannot conceal an omitted original table. */ async () => {
    const before = await capturePreservationSnapshot(client);
    expect(
      /** Reject duplicated table inventory. */ () =>
        verifyPreservation(before, { tables: [before.tables[0]!, before.tables[0]!] }),
    ).toThrow('INVALID_SNAPSHOT');
  });

  it('normalizes timezone-dependent rendering without modifying data', /** Stable UTC representation is scoped to the snapshot transaction. */ async () => {
    await client.query("SET TIME ZONE 'Europe/Berlin'");
    const before = await capturePreservationSnapshot(client);
    await client.query("SET TIME ZONE 'America/New_York'");
    expect(verifyPreservation(before, await capturePreservationSnapshot(client)).tableCount).toBe(13);
  });
});
