import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { z } from 'zod';
import { challengeInputSchema, syncInputSchema } from '@financial-tracking/contracts';
import { startBank, type BankChallenge, type BankConnector, type BankInput } from './bank.js';
import { ImportService } from './imports.js';
import { AppError } from './errors.js';
import type { Db } from './db.js';

/** Injectable worker factory used for deterministic bank integration tests. */
export type BankFactory = (input: BankInput, onChallenge: (challenge: BankChallenge | null) => void) => BankConnector;
/** In-memory state only; no PIN or TAN is stored by the manager. */
interface ActiveRun {
  connector: BankConnector;
  challenge: BankChallenge | null;
  continuing: boolean;
  committing: boolean;
  heartbeat: ReturnType<typeof setInterval>;
}

/** Coordinate one bank run per connection using PostgreSQL leases. */
@Injectable()
export class SyncService implements OnModuleDestroy {
  private readonly active = new Map<string, ActiveRun>();
  /** Use a worker factory seam without replacing production banking behavior. */
  constructor(
    @Inject('DB') readonly db: Db,
    @Inject(ImportService) private readonly imports: ImportService,
    @Inject('BANK_FACTORY') private readonly factory: BankFactory = startBank,
  ) {}

  /** Mark interrupted runs as failed on the single API instance's startup. */
  async recover() {
    await this.db.$transaction(
      /** Clear abandoned leases without resuming credentials. */ async (tx) => {
        await tx.importRun.updateMany({
          where: { source: 'FINTS', status: { in: ['CREATED', 'RUNNING', 'WAITING_FOR_AUTH', 'COMMITTING'] } },
          data: { status: 'FAILED', errorCode: 'SYNC_INTERRUPTED', finishedAt: new Date() },
        });
        await tx.bankConnection.updateMany({ where: { leaseUntil: { not: null } }, data: { leaseUntil: null } });
      },
    );
  }
  /** Add only the current in-memory challenge to persisted public status. */
  async status(id: string) {
    return { ...(await this.imports.run(id)), challenge: this.active.get(id)?.challenge ?? null };
  }
  /** List the latest one hundred runs; no secret context is serialized. */
  async history() {
    const rows = await this.db.importRun.findMany({ orderBy: { startedAt: 'desc' }, take: 100 });
    return Promise.all(rows.map(/** Serialize each credential-free status. */ (row) => this.status(row.id)));
  }

  /** Acquire the lease before creating any network operation. */
  async start(connectionId: string, input: z.infer<typeof syncInputSchema>) {
    const connection = await this.db.bankConnection.findUnique({
      where: { id: connectionId },
      include: { accounts: true },
    });
    if (!connection || connection.status !== 'ACTIVE' || connection.connectorType !== 'FINTS' || !connection.username)
      throw new AppError('BANK_UNSUPPORTED', 'Aktive FinTS-Verbindung mit Anmeldenamen erforderlich.', 409);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
    const dates = connection.accounts
      .map(
        /** Use the oldest successful cursor for an overlap-safe connection refresh. */ (account) => account.cursorDate,
      )
      .filter(/** Exclude never-synced cursors. */ (date): date is Date => date !== null);
    const start =
      dates.length === connection.accounts.length && dates.length
        ? new Date(
            Math.min(...dates.map(/** Compare timestamp values only. */ (date) => date.getTime())) - 14 * 86400_000,
          )
        : new Date(Date.now() - 90 * 86400_000);
    const fromDate = input.fromDate ?? start.toISOString().slice(0, 10),
      toDate = input.toDate ?? today;
    if (fromDate > toDate) throw new AppError('INVALID_RANGE', 'Ungültiger Abrufzeitraum.');
    let leaseUntil = new Date(Date.now() + 90_000);
    const run = await this.db.$transaction(
      /** A conditional update gives exactly one caller ownership. */ async (tx) => {
        const claimed = await tx.bankConnection.updateMany({
          where: { id: connectionId, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
          data: { leaseUntil },
        });
        if (!claimed.count)
          throw new AppError('SYNC_ALREADY_RUNNING', 'Für diese Bankverbindung läuft bereits ein Abruf.', 409);
        return tx.importRun.create({ data: { bankConnectionId: connectionId, source: 'FINTS', status: 'RUNNING' } });
      },
    );
    let connector: BankConnector;
    try {
      connector = this.factory(
        {
          username: connection.username,
          pin: input.pin,
          bankCode: connection.bankCode,
          fromDate,
          toDate,
          tanMethodId: input.tanMethodId,
          tanMediaName: input.tanMediaName,
        },
        /** Publish challenge instructions without persisting the challenge or credential. */ (challenge) => {
          const active = this.active.get(run.id);
          if (active) {
            active.challenge = challenge;
            active.continuing = false;
          }
          void this.db.importRun
            .updateMany({
              where: { id: run.id, status: { in: ['RUNNING', 'WAITING_FOR_AUTH'] } },
              data: { status: challenge ? 'WAITING_FOR_AUTH' : 'RUNNING' },
            })
            .catch(/** No database error may leak bank data. */ () => {});
        },
      );
    } catch (error) {
      await this.db.importRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorCode: error instanceof AppError ? error.code : 'BANK_UNAVAILABLE',
          finishedAt: new Date(),
        },
      });
      await this.db.bankConnection.updateMany({ where: { id: connectionId, leaseUntil }, data: { leaseUntil: null } });
      throw error;
    }
    let renewing = false;
    const heartbeat = setInterval(
      /** Renew the owned lease; stop the worker if ownership is lost. */ async () => {
        if (renewing) return;
        renewing = true;
        try {
          const next = new Date(Date.now() + 90_000);
          const renewed = await this.db.bankConnection.updateMany({
            where: { id: connectionId, leaseUntil },
            data: { leaseUntil: next },
          });
          if (!renewed.count) await connector.cancel();
          else leaseUntil = next;
        } catch {
          await connector.cancel();
        } finally {
          renewing = false;
        }
      },
      30_000,
    );
    this.active.set(run.id, { connector, challenge: null, continuing: false, committing: false, heartbeat });
    void connector.result
      .then(
        /** Persist fully fetched accounts independently; failed ones retain prior data. */ async (bundle) => {
          if (!this.active.has(run.id)) return;
          this.active.get(run.id)!.committing = true;
          await this.db.importRun.update({ where: { id: run.id }, data: { status: 'COMMITTING' } });
          let failed = bundle.failedAccounts,
            completed = 0;
          for (const account of bundle.accounts) {
            try {
              await this.imports.bankAccount(run.id, connectionId, account, toDate, leaseUntil);
              completed++;
            } catch {
              failed++;
            }
          }
          await this.db.bankConnection.updateMany({
            where: { id: connectionId, leaseUntil },
            data: { metadata: JSON.parse(JSON.stringify(bundle.metadata)) },
          });
          await this.db.importRun.update({
            where: { id: run.id },
            data: {
              status: completed ? (failed ? 'PARTIAL_SUCCESS' : 'COMPLETED') : 'FAILED',
              errorCode: failed ? 'BANK_ACCOUNT_FAILED' : null,
              finishedAt: new Date(),
            },
          });
        },
      )
      .catch(
        /** Persist only stable error codes, never worker exceptions. */ async (error: unknown) => {
          await this.db.importRun.updateMany({
            where: { id: run.id, status: { notIn: ['COMPLETED', 'PARTIAL_SUCCESS', 'CANCELLED'] } },
            data: {
              status: error instanceof AppError && error.code === 'SYNC_CANCELLED' ? 'CANCELLED' : 'FAILED',
              errorCode: error instanceof AppError ? error.code : 'BANK_UNAVAILABLE',
              finishedAt: new Date(),
            },
          });
        },
      )
      .finally(
        /** Release the lease and memory after all outcomes. */ async () => {
          clearInterval(heartbeat);
          this.active.delete(run.id);
          await this.db.bankConnection.updateMany({
            where: { id: connectionId, leaseUntil },
            data: { leaseUntil: null },
          });
        },
      )
      .catch(/** A shutdown database failure must not become an unhandled rejection. */ () => {});
    return this.status(run.id);
  }
  /** Continue exactly one pending in-memory authorization. */
  async challenge(id: string, input: z.infer<typeof challengeInputSchema>) {
    const active = this.active.get(id);
    if (!active?.challenge || active.continuing) throw new AppError('CHALLENGE_STATE', 'Keine offene Freigabe.', 409);
    if (active.challenge.type === 'TAN' && !input.tan) throw new AppError('TAN_REQUIRED', 'TAN eingeben.');
    if (active.challenge.type === 'SELECT_MEDIA' && !active.challenge.media?.includes(input.tanMediaName ?? ''))
      throw new AppError('MEDIA_REQUIRED', 'Angebotenes TAN-Medium wählen.');
    if (
      active.challenge.type === 'SELECT_METHOD' &&
      !active.challenge.methods?.some(/** Accept only offered methods. */ (method) => method.id === input.tanMethodId)
    )
      throw new AppError('METHOD_REQUIRED', 'Angebotenes TAN-Verfahren wählen.');
    active.continuing = true;
    active.connector.continue(input);
    return this.status(id);
  }
  /** Stop the secret-owning worker; commits already in progress are not cancellable. */
  async cancel(id: string) {
    const status = await this.imports.run(id);
    if (status.source === 'CSV') return this.imports.cancel(id);
    const active = this.active.get(id);
    if (!active || active.committing || status.status === 'COMMITTING')
      throw new AppError('IMPORT_STATE', 'Abruf kann nicht abgebrochen werden.', 409);
    this.active.delete(id);
    await active.connector.cancel();
    clearInterval(active.heartbeat);
    await this.db.importRun.update({ where: { id }, data: { status: 'CANCELLED', finishedAt: new Date() } });
    return this.status(id);
  }
  /** Terminate every worker before the server stops. */
  async onModuleDestroy() {
    for (const [id] of this.active)
      await this.cancel(id).catch(/** Committing work is allowed to finish during shutdown. */ () => {});
  }
}
