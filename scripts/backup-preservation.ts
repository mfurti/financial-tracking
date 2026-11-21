import type { Client } from 'pg';

/** Original PostgreSQL column identity and type, without any financial field value. */
export type PreservedColumn = { name: string; type: string; nullable: boolean };

/** In-memory original table inventory and exact server-rendered JSON rows, including duplicates. */
export type PreservedTable = { name: string; columns: PreservedColumn[]; rows: string[] };

/** Complete public application snapshot; Prisma's separately verified migration ledger is excluded. */
export type PreservationSnapshot = { tables: PreservedTable[] };

/** Sanitized coverage summary that can be recorded without exporting private rows. */
export type PreservationProof = {
  tableCount: number;
  columnCount: number;
  rowCount: number;
  tables: { name: string; columns: number; rows: number }[];
};

/** Reject incomplete or altered evidence with a fixed code that cannot disclose a record payload. */
function fail(code: string): never {
  throw new Error(`Preservation failed: ${code}`);
}

/** Quote a server-discovered identifier without restricting valid PostgreSQL names or interpreting SQL. */
function identifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Reject malformed/repeated inventory rather than letting missing coverage compare as an empty table. */
function validate(snapshot: PreservationSnapshot) {
  if (!snapshot || !Array.isArray(snapshot.tables)) fail('INVALID_SNAPSHOT');
  const names = new Set<string>();
  for (const table of snapshot.tables) {
    if (
      !table ||
      typeof table.name !== 'string' ||
      !table.name ||
      names.has(table.name) ||
      !Array.isArray(table.columns) ||
      !Array.isArray(table.rows)
    )
      fail('INVALID_SNAPSHOT');
    names.add(table.name);
    const columns = new Set<string>();
    for (const column of table.columns) {
      if (
        !column ||
        typeof column.name !== 'string' ||
        !column.name ||
        columns.has(column.name) ||
        typeof column.type !== 'string' ||
        !column.type ||
        typeof column.nullable !== 'boolean'
      )
        fail('INVALID_SNAPSHOT');
      columns.add(column.name);
    }
    if (
      table.rows.some(
        /** Raw JSON text is retained, never parsed through a floating-point number. */ (row) =>
          typeof row !== 'string' || !row,
      )
    )
      fail('INVALID_SNAPSHOT');
  }
}

/**
 * Capture all public application tables on an exclusively owned idle connection in one read-only snapshot.
 * Keep the returned private rows in memory only. Callers verify migration-ledger changes separately.
 */
export async function capturePreservationSnapshot(client: Pick<Client, 'query'>): Promise<PreservationSnapshot> {
  let transaction = false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    transaction = true;
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const inventory = await client.query<{ name: string }>(
      "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename COLLATE \"C\"",
    );
    const tables: PreservedTable[] = [];
    for (const { name } of inventory.rows) {
      const columns = (
        await client.query<PreservedColumn>(
          `SELECT a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type, NOT a.attnotnull AS nullable
           FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,
          [name],
        )
      ).rows.map(
        /** Keep metadata property order stable independently of PostgreSQL client internals. */ (column) => ({
          name: column.name,
          type: column.type,
          nullable: column.nullable,
        }),
      );
      const projection = columns
        .map(/** Quote every original field explicitly. */ (column) => identifier(column.name))
        .join(', ');
      const rows = (
        await client.query<{ row: string }>(
          `SELECT row_to_json(record)::text AS row FROM (SELECT ${projection} FROM "public".${identifier(name)}) record ORDER BY row_to_json(record)::text COLLATE "C"`,
        )
      ).rows.map(/** Preserve exact BIGINT, timestamp and null representation as server text. */ (row) => row.row);
      tables.push({ name, columns, rows });
    }
    const snapshot = { tables };
    validate(snapshot);
    await client.query('COMMIT');
    transaction = false;
    return snapshot;
  } catch {
    if (transaction) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The caller owns connection disposal; never expose a server error or private value.
      }
    }
    return fail('SNAPSHOT_UNAVAILABLE');
  }
}

/** Verify every original field and row multiplicity, permitting only explicitly reviewed additive tables. */
export function verifyPreservation(
  before: PreservationSnapshot,
  after: PreservationSnapshot,
  allowedNewTables: readonly string[] = [],
): PreservationProof {
  validate(before);
  validate(after);
  const originals = new Set(
    before.tables.map(/** Track the complete original table inventory. */ (table) => table.name),
  );
  const restored = new Map(
    after.tables.map(
      /** Index unique validated tables without depending on row/table order. */ (table) =>
        [table.name, table] as const,
    ),
  );
  const allowed = new Set(allowedNewTables);
  for (const table of after.tables) {
    if (!originals.has(table.name) && !allowed.has(table.name)) fail('TABLE_ADDED');
  }
  const proof: PreservationProof = { tableCount: 0, columnCount: 0, rowCount: 0, tables: [] };
  for (const original of before.tables) {
    const actual = restored.get(original.name);
    if (!actual) fail('TABLE_MISSING');
    if (JSON.stringify(original.columns) !== JSON.stringify(actual.columns)) fail('COLUMNS_CHANGED');
    const expectedRows = [...original.rows].sort();
    const actualRows = [...actual.rows].sort();
    if (expectedRows.length !== actualRows.length) fail('ROWS_CHANGED');
    for (let index = 0; index < expectedRows.length; index++) {
      if (expectedRows[index] !== actualRows[index]) fail('ROWS_CHANGED');
    }
    proof.tableCount++;
    proof.columnCount += original.columns.length;
    proof.rowCount += original.rows.length;
    proof.tables.push({ name: original.name, columns: original.columns.length, rows: original.rows.length });
  }
  return proof;
}
