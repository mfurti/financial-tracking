import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import { readFile, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { createServer } from 'node:net';
import { createDb } from '../apps/api/src/db.js';

/** Find a free local port for the isolated PostgreSQL process. */
export async function freePort(): Promise<number> {
  const server = createServer();
  return new Promise(
    /** Wait for a temporary bound local socket. */ (resolvePort, reject) => {
      server.once('error', reject);
      server.listen(
        0,
        '127.0.0.1',
        /** Close the reservation before PostgreSQL starts. */ () => {
          const address = server.address();
          if (!address || typeof address === 'string') return reject(new Error('Port allocation failed'));
          server.close(/** Return the allocated local port. */ () => resolvePort(address.port));
        },
      );
    },
  );
}

/** Create a disposable real PostgreSQL database, never using DATABASE_URL. */
export async function testDatabase(options: { initialOnly?: boolean; isolated?: boolean; empty?: boolean } = {}) {
  const external = process.env.TEST_DATABASE_URL;
  if (external && !new URL(external).pathname.endsWith('_test'))
    throw new Error('TEST_DATABASE_URL must name a disposable *_test database');
  const port = await freePort();
  const ownedRoot = resolve('.local');
  const databaseDir = resolve(ownedRoot, `pg-${randomUUID()}`);
  const embedded = external
    ? null
    : new EmbeddedPostgres({
        databaseDir,
        user: 'postgres',
        password: 'test-only-password',
        port,
        // The harness removes its verified owned directory with Windows file-lock retries after process exit.
        persistent: true,
        initdbFlags: ['--encoding=UTF8', '--locale=C'],
        /** Suppress database output; tests report assertions instead of records. */
        onLog: () => {},
        /** Test failures are reported by the caller without server payloads. */
        onError: () => {},
      });
  if (embedded) {
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase('ledger_test');
  }
  let url = external ?? `postgresql://postgres:test-only-password@127.0.0.1:${port}/ledger_test`;
  let ownedDatabase: string | null = null;
  if (external && options.isolated) {
    ownedDatabase = `ledger_browser_${randomUUID().replaceAll('-', '')}_test`;
    const management = new Client({ connectionString: external });
    await management.connect();
    try {
      await management.query(`CREATE DATABASE "${ownedDatabase}"`);
    } finally {
      await management.end();
    }
    const isolatedUrl = new URL(external);
    isolatedUrl.pathname = `/${ownedDatabase}`;
    url = isolatedUrl.toString();
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
  const migrationRoot = 'apps/api/prisma/migrations';
  const migrations = (await readdir(migrationRoot))
    .filter(/** Exclude the migration-provider metadata file. */ (name) => /^\d+_/.test(name))
    .sort();
  let applied = 0;
  /** Apply every remaining migration in order, including upgrades over populated initial fixtures. */
  async function applyMigrations(initialOnly = false) {
    const connection = new Client({ connectionString: url });
    await connection.connect();
    try {
      const limit = initialOnly ? 1 : migrations.length;
      while (applied < limit) {
        await connection.query('BEGIN');
        try {
          await connection.query(await readFile(resolve(migrationRoot, migrations[applied]!, 'migration.sql'), 'utf8'));
          await connection.query('COMMIT');
          applied++;
        } catch (error) {
          await connection.query('ROLLBACK');
          throw error;
        }
      }
    } finally {
      await connection.end();
    }
  }
  if (!options.empty) await applyMigrations(options.initialOnly ?? false);
  const db = createDb(url);
  return {
    db,
    url,
    applyMigrations,
    /** Disconnect Prisma before terminating the isolated server. */
    async close() {
      await db.$disconnect();
      if (embedded) {
        await embedded.stop();
        if (!/^pg-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(relative(ownedRoot, databaseDir)))
          throw new Error('Refusing cleanup outside the owned local PostgreSQL directory');
        await rm(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
      if (external && ownedDatabase) {
        const management = new Client({ connectionString: external });
        await management.connect();
        try {
          await management.query(`DROP DATABASE "${ownedDatabase}" WITH (FORCE)`);
        } finally {
          await management.end();
        }
      }
    },
  };
}
