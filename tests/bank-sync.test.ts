import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { ImportService } from '../apps/api/src/imports.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { SyncService, type BankFactory } from '../apps/api/src/sync.js';
import { AppError } from '../apps/api/src/errors.js';
import type { BankBundle, BankChallenge } from '../apps/api/src/bank.js';

describe('manual bank lifecycle', /** Exercise the actual manager/importer and PostgreSQL leases with synthetic adapter events. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  beforeAll(
    /** Provision only the isolated test database. */ async () => {
      resource = await testDatabase();
    },
  );
  afterAll(/** Release only the owned database. */ async () => resource?.close());
  /** Create an independent supported-bank configuration without connecting to it. */
  async function connection() {
    return new LedgerService(resource.db).createConnection({
      name: randomUUID(),
      bankCode: '69050001',
      connectorType: 'FINTS',
      username: 'synthetic',
    });
  }
  /** Wait for the real asynchronous manager state, with a bounded failure deadline. */
  async function until(check: () => Promise<boolean>) {
    for (let i = 0; i < 200; i++) {
      if (await check()) return;
      await new Promise(/** Let the background database writes progress. */ (resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Synthetic bank lifecycle timed out');
  }

  it('selects offered TAN methods/media, continues app approval and commits exactly once', /** Authorization choices and source observations traverse the real persistence path. */ async () => {
    const target = await connection(),
      imports = new ImportService(resource.db);
    let notify: (challenge: BankChallenge | null) => void = () => {};
    let finish: (bundle: BankBundle) => void = () => {};
    let phase = 0;
    const factory: BankFactory = /** Keep only fake transport callbacks while exercising real lease ownership. */ (
      _input,
      challenge,
    ) => {
      notify = challenge;
      return {
        result: new Promise(
          /** Resolve only after all authorization phases. */ (resolve) => {
            finish = resolve;
          },
        ),
        continue() {
          phase++;
          if (phase === 1) notify({ type: 'SELECT_MEDIA', message: 'Medium', media: ['Test phone'] });
          else if (phase === 2) notify({ type: 'APP_APPROVAL', message: 'App approval' });
          else {
            notify(null);
            finish({
              accounts: [
                {
                  reference: 'account',
                  name: 'Discovered',
                  iban: null,
                  balanceCents: '123456',
                  observedAt: new Date().toISOString(),
                  rows: [
                    {
                      amountCents: '-101',
                      currency: 'EUR',
                      bookingDate: '2026-11-01',
                      valueDate: null,
                      description: 'Synthetic bank row',
                      counterpartyName: null,
                      counterpartyIban: null,
                      status: 'BOOKED',
                      identityType: 'BANK_REFERENCE',
                      identityValue: 'bank-source',
                      reference: 'bank-source',
                    },
                  ],
                },
              ],
              failedAccounts: 0,
              metadata: {},
            });
          }
        },
        async cancel() {},
      };
    };
    const sync = new SyncService(resource.db, imports, factory);
    try {
      const run = await sync.start(target.id, {
        pin: 'CANARY_PIN_SYNC_91c4',
        fromDate: '2026-11-01',
        toDate: '2026-11-02',
      });
      notify({
        type: 'SELECT_METHOD',
        message: 'Method',
        methods: [{ id: 920, name: 'App', media: ['Test phone'], mediaRequired: true }],
      });
      await until(
        /** Wait until the challenge is observable. */ async () =>
          (await sync.status(run.id)).status === 'WAITING_FOR_AUTH',
      );
      await expect(sync.challenge(run.id, { tanMethodId: 999 })).rejects.toThrow('Angebotenes');
      await sync.challenge(run.id, { tanMethodId: 920 });
      await expect(sync.challenge(run.id, { tanMediaName: 'Hidden phone' })).rejects.toThrow('Angebotenes');
      await sync.challenge(run.id, { tanMediaName: 'Test phone' });
      await sync.challenge(run.id, {});
      await until(
        /** Successful financial persistence is separate from accepting a button click. */ async () =>
          (await sync.status(run.id)).status === 'COMPLETED',
      );
      await until(
        /** Lease cleanup must complete before another manual refresh. */ async () =>
          (await resource.db.bankConnection.findUniqueOrThrow({ where: { id: target.id } })).leaseUntil === null,
      );
      const account = await resource.db.account.findFirstOrThrow({ where: { bankConnectionId: target.id } });
      expect((await new LedgerService(resource.db).account(account.id)).balances[0]!.amountCents).toBe('123456');
      expect((await new LedgerService(resource.db).monthly('2026-11', account.id)).netCents).toBe('-101');
      expect(await resource.db.transaction.count({ where: { accountId: account.id } })).toBe(1);
      const stored = JSON.stringify([
        await resource.db.bankConnection.findUnique({ where: { id: target.id } }),
        await resource.db.importRun.findUnique({ where: { id: run.id } }),
      ]);
      expect(stored).not.toContain('CANARY_PIN_SYNC_91c4');
      await expect(sync.challenge(run.id, {})).rejects.toThrow('Keine offene');
    } finally {
      await sync.onModuleDestroy();
    }
  });

  it.each(['BANK_INVALID_CREDENTIALS', 'BANK_UNAVAILABLE', 'BANK_AUTH_TIMEOUT'])(
    'persists safe %s failure without automatic retry',
    /** Failed runs retain no credential and release their lease. */ async (code) => {
      const target = await connection();
      let calls = 0;
      const factory: BankFactory = /** Fail only the synthetic bank transport. */ () => {
        calls++;
        return {
          result: Promise.reject(new AppError(code, 'Safe synthetic failure', 502)),
          continue() {},
          async cancel() {},
        };
      };
      const sync = new SyncService(resource.db, new ImportService(resource.db), factory);
      try {
        const run = await sync.start(target.id, { pin: 'CANARY_PIN_FAILURE_31ca' });
        await until(
          /** Observe committed failure and finished resource cleanup. */ async () =>
            (await sync.status(run.id)).status === 'FAILED' &&
            (await resource.db.bankConnection.findUniqueOrThrow({ where: { id: target.id } })).leaseUntil === null,
        );
        expect((await sync.status(run.id)).errorCode).toBe(code);
        expect(calls).toBe(1);
        expect(await resource.db.account.count({ where: { bankConnectionId: target.id } })).toBe(0);
        expect(JSON.stringify(await resource.db.importRun.findUnique({ where: { id: run.id } }))).not.toContain(
          'CANARY_PIN_FAILURE_31ca',
        );
      } finally {
        await sync.onModuleDestroy();
      }
    },
  );
});
