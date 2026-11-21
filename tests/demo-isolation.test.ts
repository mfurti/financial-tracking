import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import { testDatabase } from './database.js';
import { WealthService } from '../apps/api/src/wealth.js';
import {
  commitDemoStorage,
  readDemoStorage,
  resetDemoStorage,
  type DemoLock,
  type DemoStorage,
} from '../apps/web/app/utils/demo-storage.js';
import type { DemoAction } from '../apps/web/app/utils/demo-finance.js';

/** Snapshot exact PostgreSQL row text, preserving signed BIGINT digits and every table's fields. */
async function rows(client: Client) {
  const tables = (
    await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const snapshot: Record<string, string[]> = {};
  for (const { tablename } of tables) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(tablename)) throw new Error('Unexpected owned test table');
    snapshot[tablename] = (
      await client.query<{ row: string }>(
        `SELECT row_to_json(record)::text AS row FROM "${tablename}" record ORDER BY row_to_json(record)::text`,
      )
    ).rows.map(/** Retain exact JSON text rather than parsing financial values into Number. */ (row) => row.row);
  }
  return snapshot;
}

describe('demo isolation from real persistence and remote actions', /** Compare every real table around each synthetic command and dedicated reset. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>, client: Client;
  beforeAll(
    /** Own a disposable populated workspace; never use a production connection. */ async () => {
      resource = await testDatabase();
      client = new Client({ connectionString: resource.url });
      await client.connect();
      const db = resource.db;
      const owner = await db.user.create({
        data: { username: 'isolation-owner', passwordHash: 'synthetic-fixture-hash' },
      });
      await db.session.create({
        data: {
          userId: owner.id,
          tokenHash: 'b'.repeat(64),
          csrfToken: 'synthetic-csrf',
          expiresAt: new Date('2050-01-01'),
        },
      });
      const connection = await db.bankConnection.create({
        data: { name: 'Real-model fixture', bankCode: '69050001', connectorType: 'CSV' },
      });
      const account = await db.account.create({
        data: { name: 'Preserved real account', bankConnectionId: connection.id },
      });
      const run = await db.importRun.create({
        data: { source: 'CSV', status: 'COMPLETED', bankConnectionId: connection.id },
      });
      const category = await db.category.create({ data: { name: 'Preserved real category', kind: 'BOTH' } });
      await db.balanceSnapshot.create({
        data: {
          accountId: account.id,
          importRunId: run.id,
          source: 'CSV',
          balanceType: 'BOOKED',
          amountCents: -9007199254740993n,
          observedAt: new Date('2040-01-01'),
        },
      });
      await db.transaction.create({
        data: {
          accountId: account.id,
          categoryId: category.id,
          amountCents: -12345n,
          bookingDate: new Date('2040-01-01'),
          description: 'Preserved manual booking',
          categoryOrigin: 'MANUAL',
        },
      });
      await db.accountPresentation.create({ data: { accountId: account.id, reserveEligible: true } });
      await new WealthService(db).capture({ idempotencyKey: 'real-model-fixture' }, new Date('2040-01-02'));
    },
  );
  afterAll(
    /** Close only owned database resources even when an isolation assertion fails. */ async () => {
      await client?.end();
      await resource?.close();
    },
  );

  it('preserves all real rows and performs zero fetch calls around every demo mutation and reset', /** Synthetic local roles, transfers and investment actions cannot obtain real persistence access. */ async () => {
    const baseline = await rows(client);
    const data = new Map<string, string>();
    const storage: DemoStorage = {
      getItem: /** Read only owned synthetic state. */ (key) => data.get(key) ?? null,
      setItem: /** Persist only one dedicated demo payload. */ (key, value) => {
        data.set(key, value);
      },
    };
    const lock: DemoLock = /** One sequential test writer still uses the complete store transaction. */ async <T>(
      work: () => T | Promise<T>,
    ) => await work();
    let snapshot = readDemoStorage(storage);
    const actions: DemoAction[] = [
      { kind: 'account', name: 'Synthetic extra account' },
      { kind: 'category', name: 'Synthetic category' },
      { kind: 'buy', accountId: 'demo-cash', securityId: 'demo-world', quantity: 2 },
      { kind: 'sell', accountId: 'demo-cash', securityId: 'demo-world', quantity: 1 },
      { kind: 'transfer', fromId: 'demo-cash', toId: 'demo-savings', amountCents: '12345' },
      { kind: 'scenario', basisPoints: 250 },
      {
        kind: 'plan-save',
        plan: {
          id: 'demo-plan',
          name: 'Synthetic plan',
          accountId: 'demo-cash',
          securityId: 'demo-world',
          amountCents: '20000',
          day: 1,
        },
      },
      { kind: 'plan-execute', planId: 'demo-plan', period: '2026-01' },
      {
        kind: 'plan-save',
        plan: {
          id: 'demo-plan',
          name: 'Edited synthetic plan',
          accountId: 'demo-cash',
          securityId: 'demo-tech',
          amountCents: '30000',
          day: 2,
        },
      },
      { kind: 'plan-delete', planId: 'demo-plan' },
      { kind: 'role', id: 'demo-owner', name: 'Synthetic viewer', role: 'viewer' },
    ];
    const remote = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected remote demo action'));
    try {
      for (const [index, action] of actions.entries()) {
        snapshot = await commitDemoStorage(
          snapshot,
          action,
          `demo-command-${index}`,
          '2026-11-01T12:00:00.000Z',
          storage,
          lock,
        );
        expect(await rows(client)).toEqual(baseline);
        expect(remote).not.toHaveBeenCalled();
      }
      const beforeFailure = JSON.stringify(snapshot);
      await expect(
        commitDemoStorage(
          snapshot,
          { kind: 'buy', accountId: 'demo-cash', securityId: 'demo-world', quantity: 1000 },
          'demo-invalid',
          '2026-11-01T12:00:00.000Z',
          storage,
          lock,
        ),
      ).rejects.toThrow();
      expect(JSON.stringify(snapshot)).toBe(beforeFailure);
      expect(await rows(client)).toEqual(baseline);
      snapshot = await resetDemoStorage(snapshot, false, storage, lock);
      expect(JSON.stringify(snapshot)).toBe(beforeFailure);
      snapshot = await resetDemoStorage(snapshot, true, storage, lock);
      expect(snapshot.state.roles[0]!.role).toBe('owner');
      expect(snapshot.state.orders).toEqual([]);
      expect(await rows(client)).toEqual(baseline);
      expect(remote).not.toHaveBeenCalled();
    } finally {
      remote.mockRestore();
    }
  });
});
