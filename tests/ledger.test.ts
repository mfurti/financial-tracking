import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { ImportService } from '../apps/api/src/imports.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { SyncService, type BankFactory } from '../apps/api/src/sync.js';
import type { BankBundle } from '../apps/api/src/bank.js';
import { transactionQuerySchema } from '../packages/contracts/src/index.js';
import { AppError } from '../apps/api/src/errors.js';
import type { BankChallenge } from '../apps/api/src/bank.js';

describe('durable household ledger', /** Integration proof against PostgreSQL constraints and transactions. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let imports: ImportService;
  let ledger: LedgerService;
  beforeAll(
    /** Initialize an isolated real database. */ async () => {
      resource = await testDatabase();
      imports = new ImportService(resource.db);
      ledger = new LedgerService(resource.db);
    },
  );
  afterAll(
    /** Release every database process after assertions. */ async () => {
      await resource?.close();
    },
  );
  /** Create an independent account for each scenario. */
  async function account() {
    const connection = await ledger.createConnection({
      name: `Bank ${randomUUID()}`,
      bankCode: '69050001',
      connectorType: 'CSV',
    });
    return ledger.createAccount({ name: 'Giro', bankConnectionId: connection.id, accountType: 'CHECKING' });
  }
  /** Build a preview with deterministic explicit source columns. */
  async function preview(accountId: string, rows: string) {
    return imports.preview({
      accountId,
      content: `Datum;Betrag;Text;Referenz\n${rows}`,
      delimiter: ';',
      encoding: 'utf-8',
      mapping: { bookingDate: 'Datum', amount: 'Betrag', description: 'Text', reference: 'Referenz' },
    });
  }

  it('reimports exact references without losing manual categorization', /** User edits survive source repetition. */ async () => {
    const target = await account();
    const source = '01.11.2026;-49,90;Einkauf;bank-1\n';
    const first = await preview(target.id, source);
    expect((await imports.commit(first.run.id, false)).importedCount).toBe(1);
    const row = (await ledger.transactions(transactionQuerySchema.parse({ accountId: target.id }))).items[0]!;
    const category = await ledger.createCategory({ name: `Lebensmittel ${randomUUID()}`, kind: 'EXPENSE' });
    await ledger.patchTransaction(row.id, { categoryId: category.id });
    const repeated = await preview(target.id, source);
    expect((await imports.commit(repeated.run.id, false)).knownCount).toBe(1);
    expect((await ledger.transaction(row.id)).categoryId).toBe(category.id);
    expect(await resource.db.transaction.count({ where: { accountId: target.id } })).toBe(1);
  });
  it('preserves both transfer sides when a patch references a missing category', /** Rejected annotations must leave financial classifications unchanged. */ async () => {
    const a = await account(),
      b = await account();
    const outgoing = await resource.db.transaction.create({
      data: {
        accountId: a.id,
        amountCents: -1000n,
        bookingDate: new Date('2026-11-01'),
        description: 'Transfer patch regression',
      },
    });
    const incoming = await resource.db.transaction.create({
      data: {
        accountId: b.id,
        amountCents: 1000n,
        bookingDate: new Date('2026-11-01'),
        description: 'Transfer patch regression',
      },
    });
    const group = await ledger.createTransfer({ transactionIds: [outgoing.id, incoming.id] });
    const before = await ledger.monthly('2026-11', a.id);
    await expect(ledger.patchTransaction(outgoing.id, { isTransfer: false, categoryId: randomUUID() })).rejects.toThrow(
      'Kategorie nicht gefunden',
    );
    expect(await resource.db.transferGroup.findUnique({ where: { id: group.id } })).not.toBeNull();
    for (const id of [outgoing.id, incoming.id])
      expect(await ledger.transaction(id)).toMatchObject({
        isTransfer: true,
        transferGroupId: group.id,
        categoryId: null,
      });
    expect(await ledger.monthly('2026-11', a.id)).toEqual(before);
    const category = await ledger.createCategory({ name: `Transfer patch ${randomUUID()}`, kind: 'EXPENSE' });
    expect(await ledger.patchTransaction(outgoing.id, { isTransfer: false, categoryId: category.id })).toMatchObject({
      isTransfer: false,
      transferGroupId: null,
      categoryId: category.id,
    });
    expect(await ledger.transaction(incoming.id)).toMatchObject({ isTransfer: false, transferGroupId: null });
    expect(await resource.db.transferGroup.findUnique({ where: { id: group.id } })).toBeNull();
  });
  it('rolls back transfer removal if the final annotation update fails', /** A database write failure must roll back the entire compound patch. */ async () => {
    const a = await account(),
      b = await account();
    const outgoing = await resource.db.transaction.create({
      data: {
        accountId: a.id,
        amountCents: -1000n,
        bookingDate: new Date('2026-11-01'),
        description: 'Force patch rollback',
      },
    });
    const incoming = await resource.db.transaction.create({
      data: {
        accountId: b.id,
        amountCents: 1000n,
        bookingDate: new Date('2026-11-01'),
        description: 'Counterpart rollback',
      },
    });
    const group = await ledger.createTransfer({ transactionIds: [outgoing.id, incoming.id] });
    const category = await ledger.createCategory({ name: `Rollback ${randomUUID()}`, kind: 'EXPENSE' });
    await resource.db
      .$executeRaw`CREATE FUNCTION reject_review_patch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description = 'Force patch rollback' AND NEW."categoryId" IS NOT NULL THEN RAISE EXCEPTION 'Synthetic annotation failure'; END IF; RETURN NEW; END $$`;
    await resource.db
      .$executeRaw`CREATE TRIGGER reject_review_patch BEFORE UPDATE ON "Transaction" FOR EACH ROW EXECUTE FUNCTION reject_review_patch()`;
    try {
      await expect(
        ledger.patchTransaction(outgoing.id, { isTransfer: false, categoryId: category.id }),
      ).rejects.toThrow();
      expect(await resource.db.transferGroup.findUnique({ where: { id: group.id } })).not.toBeNull();
      for (const id of [outgoing.id, incoming.id])
        expect(await ledger.transaction(id)).toMatchObject({
          isTransfer: true,
          transferGroupId: group.id,
          categoryId: null,
        });
    } finally {
      await resource.db.$executeRaw`DROP TRIGGER reject_review_patch ON "Transaction"`;
      await resource.db.$executeRaw`DROP FUNCTION reject_review_patch()`;
    }
  });
  it('keeps actionable reviews reachable behind more than 1000 CSV diagnostics', /** Non-actionable row errors cannot permanently fill the review window. */ async () => {
    const target = await account();
    const invalidRows = Array.from(
      { length: 1001 },
      /** Produce safe invalid CSV fixtures. */ () => 'bad-date;bad-amount;Invalid;',
    ).join('\n');
    const staged = await preview(
      target.id,
      `${invalidRows}\n01.11.2026;-1,00;Brot;NONREF\n01.11.2026;-1,00;Brot;NONREF\n`,
    );
    expect(staged.invalidRows).toBe(1001);
    const committed = await imports.commit(staged.run.id, true);
    expect(committed.reviewRequiredCount).toBe(1);
    const visible = await imports.issues(committed.id);
    expect(visible).toHaveLength(1000);
    expect(visible[0]!.code).toBe('REVIEW_REQUIRED');
    expect(visible[0]!.incoming?.description).toBe('Brot');
    expect(
      visible.some(
        /** Preserve ordinary CSV diagnostics alongside reviews. */ (issue) => issue.code === 'CSV_INVALID_ROW',
      ),
    ).toBe(true);
    await imports.resolve(committed.id, [{ issueId: visible[0]!.id, action: 'NEW' }]);
    expect((await imports.run(committed.id)).reviewRequiredCount).toBe(0);
    expect(await resource.db.transaction.count({ where: { accountId: target.id } })).toBe(2);
    expect(
      (await imports.issues(committed.id)).every(
        /** After resolution, diagnostics remain available. */ (issue) => issue.code === 'CSV_INVALID_ROW',
      ),
    ).toBe(true);
  });
  it('reviews a changed source purpose even when cents and dates are unchanged', /** Exact references do not authorize silent financial-field replacement. */ async () => {
    const target = await account();
    const first = await preview(target.id, '01.11.2026;-2,00;Original purpose;changed-reference\n');
    await imports.commit(first.run.id, false);
    const changed = await preview(target.id, '01.11.2026;-2,00;Corrected purpose;changed-reference\n');
    expect((await imports.commit(changed.run.id, false)).reviewRequiredCount).toBe(1);
    const issue = (await imports.issues(changed.run.id))[0]!;
    expect(issue.code).toBe('SOURCE_CHANGED');
    expect(issue.candidates![0]!.description).toBe('Original purpose');
    await imports.resolve(changed.run.id, [
      {
        issueId: issue.id,
        action: 'INCOMING',
        transactionId: issue.candidateIds[0],
        candidateVersion: issue.candidateVersions![issue.candidateIds[0]!],
      },
    ]);
    expect((await ledger.transaction(issue.candidateIds[0]!)).description).toBe('Corrected purpose');
    expect(await resource.db.transaction.count({ where: { accountId: target.id } })).toBe(1);
  });

  it('keeps ambiguous duplicate-looking purchases for explicit review', /** Similarity alone cannot merge financial records. */ async () => {
    const target = await account();
    const staged = await preview(target.id, '01.11.2026;-1,20;Brot;NONREF\n01.11.2026;-1,20;Brot;NONREF\n');
    expect((await imports.commit(staged.run.id, false)).reviewRequiredCount).toBe(1);
    const issue = (await imports.issues(staged.run.id))[0]!;
    expect(issue.incoming?.description).toBe('Brot');
    expect(issue.candidates).toHaveLength(1);
    await imports.resolve(staged.run.id, [{ issueId: issue.id, action: 'NEW' }]);
    expect(await resource.db.transaction.count({ where: { accountId: target.id } })).toBe(2);
    const repeated = await preview(target.id, '01.11.2026;-1,20;Brot;NONREF\n01.11.2026;-1,20;Brot;NONREF\n');
    expect((await imports.commit(repeated.run.id, false)).knownCount).toBe(2);
  });
  it('requires consent for invalid rows and rolls back a corrupted account import', /** No partial financial writes are hidden behind an error. */ async () => {
    const target = await account();
    const partial = await preview(target.id, '01.11.2026;10,00;Okay;ok\n31.02.2026;bad;Invalid;bad\n');
    await expect(imports.commit(partial.run.id, false)).rejects.toThrow('Teilimport');
    expect((await imports.run(partial.run.id)).status).toBe('CREATED');
    expect((await imports.commit(partial.run.id, true)).status).toBe('PARTIAL_SUCCESS');
    const broken = await preview(target.id, '02.11.2026;20,00;Valid;valid-2\n');
    await resource.db.stagedRow.create({
      data: { runId: broken.run.id, accountId: target.id, rowNumber: 99, data: { invalid: true } },
    });
    await expect(imports.commit(broken.run.id, false)).rejects.toThrow();
    expect(await resource.db.transaction.count({ where: { accountId: target.id } })).toBe(1);
    expect((await imports.run(broken.run.id)).status).toBe('CREATED');
  });
  it('serializes overlapping commits and refuses replaying a completed preview', /** Database locks preserve source identity under concurrency. */ async () => {
    const target = await account();
    const a = await preview(target.id, '01.11.2026;3,00;Same;stable\n');
    const b = await preview(target.id, '01.11.2026;3,00;Same;stable\n');
    await Promise.all([imports.commit(a.run.id, false), imports.commit(b.run.id, false)]);
    expect(await resource.db.transaction.count({ where: { accountId: target.id } })).toBe(1);
    await expect(imports.commit(a.run.id, false)).rejects.toThrow('bereits');
  });
  it('excludes own transfers and pending transactions and handles month boundaries exactly', /** Reports use booking dates and signed BIGINT amounts. */ async () => {
    const a = await account(),
      b = await account();
    const source = await preview(
      a.id,
      '31.10.2026;10,00;Vorher;prev\n01.11.2026;100,01;Eingang;inc\n02.11.2026;-49,90;Ausgabe;exp\n03.11.2026;2,00;Erstattung;refund\n04.11.2026;-20,00;Umbuchung;out\n',
    );
    await imports.commit(source.run.id, false);
    const second = await preview(b.id, '04.11.2026;20,00;Umbuchung;in\n');
    await imports.commit(second.run.id, false);
    const out = await resource.db.transaction.findFirstOrThrow({ where: { accountId: a.id, amountCents: -2000n } });
    const incoming = await resource.db.transaction.findFirstOrThrow({ where: { accountId: b.id } });
    await ledger.createTransfer({ transactionIds: [out.id, incoming.id] });
    await resource.db.transaction.create({
      data: {
        accountId: a.id,
        amountCents: -99999n,
        bookingDate: new Date('2026-11-05'),
        description: 'Vorgemerkt',
        status: 'PENDING',
      },
    });
    const report = await ledger.monthly('2026-11', a.id);
    expect(report.incomeCents).toBe('10201');
    expect(report.expenseCents).toBe('4990');
    expect(report.netCents).toBe('5211');
    expect(report.previousNetCents).toBe('1000');
    expect(report.deltaCents).toBe('4211');
    const page = await ledger.transactions(transactionQuerySchema.parse({ accountId: a.id, limit: 2 }));
    const next = await ledger.transactions(
      transactionQuerySchema.parse({ accountId: a.id, cursor: page.nextCursor, limit: 2 }),
    );
    expect(
      next.items.some(
        /** Cursor pages must not repeat items. */ (row) =>
          page.items.some(/** Compare stable public IDs. */ (first) => first.id === row.id),
      ),
    ).toBe(false);
    expect((await ledger.account(a.id)).balances).toEqual([]);
  });
  it('allows one leased bank run and preserves partial account success', /** A synthetic adapter tests lifecycle without real credentials. */ async () => {
    const connection = await ledger.createConnection({
      name: 'FinTS',
      bankCode: '69050001',
      connectorType: 'FINTS',
      username: 'test',
    });
    let finish: (bundle: BankBundle) => void = () => {};
    const factory: BankFactory = /** Keep the first run open until assertions acquire the second lease. */ () => ({
      result: new Promise(
        /** Capture completion for a deterministic concurrency test. */ (resolve) => {
          finish = resolve;
        },
      ),
      continue() {},
      async cancel() {},
    });
    const sync = new SyncService(resource.db, imports, factory);
    const run = await sync.start(connection.id, { pin: 'test-only' });
    await expect(sync.start(connection.id, { pin: 'test-only' })).rejects.toThrow('bereits');
    finish({
      accounts: [
        {
          reference: 'bank-account-1',
          name: 'Bankkonto',
          iban: null,
          balanceCents: '12345',
          observedAt: '2026-11-06T12:00:00Z',
          rows: [],
        },
      ],
      failedAccounts: 1,
      metadata: {},
    });
    for (let i = 0; i < 100 && (await sync.status(run.id)).status !== 'PARTIAL_SUCCESS'; i++)
      await new Promise(/** Wait briefly for asynchronous persistence. */ (resolve) => setTimeout(resolve, 10));
    expect((await sync.status(run.id)).status).toBe('PARTIAL_SUCCESS');
    const bankAccount = await resource.db.account.findFirstOrThrow({ where: { bankConnectionId: connection.id } });
    expect((await ledger.account(bankAccount.id)).balances[0]!.amountCents).toBe('12345');
    await sync.onModuleDestroy();
  });
  it('handles rejected authorization without committing data or persisting secrets', /** Bank failure codes remain safe at the persistence boundary. */ async () => {
    const connection = await ledger.createConnection({
      name: 'Rejected TAN',
      bankCode: '69050001',
      connectorType: 'FINTS',
      username: 'test',
    });
    let rejectRun: (error: Error) => void = () => {};
    let notify: (challenge: BankChallenge | null) => void = () => {};
    const factory: BankFactory = /** Emit authorization separately from constructing the connector. */ (
      _input,
      challenge,
    ) => {
      notify = challenge;
      return {
        result: new Promise(
          /** Capture a controlled rejection. */ (_resolve, reject) => {
            rejectRun = reject;
          },
        ),
        continue() {
          rejectRun(new AppError('BANK_AUTH_REJECTED', 'Freigabe abgelehnt.', 502));
        },
        async cancel() {
          rejectRun(new AppError('SYNC_CANCELLED', 'Abbruch.', 409));
        },
      };
    };
    const sync = new SyncService(resource.db, imports, factory);
    const run = await sync.start(connection.id, { pin: 'synthetic-pin' });
    notify({ type: 'APP_APPROVAL', message: 'Synthetische Freigabe' });
    for (let i = 0; i < 100 && (await sync.status(run.id)).status !== 'WAITING_FOR_AUTH'; i++)
      await new Promise(/** Wait for challenge persistence. */ (resolve) => setTimeout(resolve, 10));
    expect((await sync.status(run.id)).challenge?.type).toBe('APP_APPROVAL');
    await sync.challenge(run.id, {});
    for (let i = 0; i < 100 && (await sync.status(run.id)).status !== 'FAILED'; i++)
      await new Promise(/** Wait for safe error persistence. */ (resolve) => setTimeout(resolve, 10));
    const stored = await resource.db.importRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(stored.errorCode).toBe('BANK_AUTH_REJECTED');
    expect(JSON.stringify(stored)).not.toContain('synthetic-pin');
    expect(await resource.db.account.count({ where: { bankConnectionId: connection.id } })).toBe(0);
    await sync.onModuleDestroy();
  });
  it('cancels workers and recovers abandoned run records after restart', /** No authorization state survives a process boundary. */ async () => {
    const connection = await ledger.createConnection({
      name: 'Cancel',
      bankCode: '69050001',
      connectorType: 'FINTS',
      username: 'test',
    });
    let rejectRun: (error: Error) => void = () => {};
    const factory: BankFactory = /** Keep the synthetic operation pending until cancellation. */ () => ({
      result: new Promise(
        /** Capture the cancellation rejection. */ (_resolve, reject) => {
          rejectRun = reject;
        },
      ),
      continue() {},
      async cancel() {
        rejectRun(new AppError('SYNC_CANCELLED', 'Abbruch.', 409));
      },
    });
    const sync = new SyncService(resource.db, imports, factory);
    const run = await sync.start(connection.id, { pin: 'synthetic-pin' });
    expect((await sync.cancel(run.id)).status).toBe('CANCELLED');
    const orphan = await resource.db.importRun.create({
      data: { bankConnectionId: connection.id, source: 'FINTS', status: 'WAITING_FOR_AUTH' },
    });
    await sync.recover();
    expect((await imports.run(orphan.id)).errorCode).toBe('SYNC_INTERRUPTED');
    expect(
      (await resource.db.bankConnection.findUniqueOrThrow({ where: { id: connection.id } })).leaseUntil,
    ).toBeNull();
    await sync.onModuleDestroy();
  });
});
