import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { createDb } from '../apps/api/src/db.js';

/** Find a free local port for the isolated PostgreSQL process. */
async function freePort(): Promise<number> {
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
export async function testDatabase() {
  const external = process.env.TEST_DATABASE_URL;
  if (external && !new URL(external).pathname.endsWith('_test'))
    throw new Error('TEST_DATABASE_URL must name a disposable *_test database');
  const port = await freePort();
  const embedded = external
    ? null
    : new EmbeddedPostgres({
        databaseDir: resolve('.local', `pg-${randomUUID()}`),
        user: 'postgres',
        password: 'test-only-password',
        port,
        persistent: false,
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
  const url = external ?? `postgresql://postgres:test-only-password@127.0.0.1:${port}/ledger_test`;
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.query(await readFile('apps/api/prisma/migrations/202611060001_initial/migration.sql', 'utf8'));
  await client.end();
  const db = createDb(url);
  return {
    db,
    url,
    /** Disconnect Prisma before terminating the isolated server. */
    async close() {
      await db.$disconnect();
      if (embedded) await embedded.stop();
    },
  };
}
