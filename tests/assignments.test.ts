import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { ImportService } from '../apps/api/src/imports.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { AssignmentService } from '../apps/api/src/assignments.js';
import { transactionQuerySchema } from '../packages/contracts/src/index.js';

describe('accountless CSV and explicit assignment', /** Exercise real constraints, balances and source identity linking. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let imports: ImportService, ledger: LedgerService, assignments: AssignmentService;
  beforeAll(
    /** Create a disposable full-schema database without any bank configuration. */ async () => {
      resource = await testDatabase();
      imports = new ImportService(resource.db);
      ledger = new LedgerService(resource.db);
      assignments = new AssignmentService(resource.db);
    },
  );
  afterAll(/** Close only the owned test database. */ async () => resource?.close());

  /** Import a unique source without creating a placeholder account or connection. */
  async function csv(tag: string) {
    const preview = await imports.preview({
      accountId: null,
      content: `Datum;Betrag;Text;Referenz\n01.11.2026;-10,00;${tag};${tag}\n`,
      delimiter: ';',
      encoding: 'utf-8',
      mapping: { bookingDate: 'Datum', amount: 'Betrag', description: 'Text', reference: 'Referenz' },
    });
    await imports.commit(preview.run.id, false);
    return resource.db.transaction.findFirstOrThrow({
      where: { identities: { some: { importRunId: preview.run.id } } },
    });
  }
  /** Create a synthetic discovered account, without starting a bank worker. */
  async function account() {
    const connection = await ledger.createConnection({
      name: randomUUID(),
      bankCode: '69050001',
      connectorType: 'FINTS',
      username: 'synthetic',
    });
    return ledger.createAccount({ bankConnectionId: connection.id, name: 'Synthetic bank', accountType: 'CHECKING' });
  }
  /** Represent a pre-existing bank observation for isolated reconciliation tests. */
  async function bank(accountId: string, bankConnectionId: string, reference: string, amountCents = -990n) {
    const run = await resource.db.importRun.create({
      data: { bankConnectionId, source: 'FINTS', status: 'COMPLETED' },
    });
    return resource.db.transaction.create({
      data: {
        accountId,
        amountCents,
        bookingDate: new Date('2026-11-01'),
        description: `Bank ${reference}`,
        identities: {
          create: {
            accountId,
            scope: `account:${accountId}`,
            identityType: 'BANK_REFERENCE',
            identityValue: reference,
            importRunId: run.id,
          },
        },
      },
    });
  }

  it('imports, categorizes and reports with zero accounts/connections', /** Unassigned data is real ledger data, not hidden staging. */ async () => {
    expect(await resource.db.account.count()).toBe(0);
    expect(await resource.db.bankConnection.count()).toBe(0);
    const source = await csv(randomUUID());
    expect(source.accountId).toBeNull();
    const category = await ledger.createCategory({ name: 'Standalone CSV', kind: 'EXPENSE' });
    await ledger.patchTransaction(source.id, { categoryId: category.id });
    expect((await ledger.monthly('2026-11')).netCents).toBe('-1000');
    expect((await ledger.transactions(transactionQuerySchema.parse({ unassigned: 'true' }))).items).toHaveLength(1);
    expect(await resource.db.account.count()).toBe(0);
  });

  it('merges reviewed bank values atomically and replays the same receipt', /** Categories conflict explicitly; financial totals contain only the surviving logical transaction. */ async () => {
    const tag = randomUUID(),
      source = await csv(tag),
      target = await account();
    const existing = await bank(target.id, target.bankConnectionId, tag);
    const sourceCategory = await ledger.createCategory({ name: randomUUID(), kind: 'EXPENSE' });
    const bankCategory = await ledger.createCategory({ name: randomUUID(), kind: 'EXPENSE' });
    await ledger.patchTransaction(source.id, { categoryId: sourceCategory.id, isTransfer: true });
    await ledger.patchTransaction(existing.id, { categoryId: bankCategory.id });
    const preview = await assignments.preview({ accountId: target.id, transactionIds: [source.id] });
    expect(
      preview.items[0]!.candidates[0]!.references.some(
        /** The comparison must identify synthetic bank provenance rather than infer it from a reference. */ (ref) =>
          ref.source === 'FINTS',
      ),
    ).toBe(true);
    const payload = {
      requestId: randomUUID(),
      accountId: target.id,
      decisions: [
        { transactionId: source.id, token: preview.items[0]!.token, action: 'BANK' as const, candidateId: existing.id },
      ],
    };
    await expect(assignments.apply(payload)).rejects.toThrow('Kategorien');
    expect(await resource.db.transaction.findUnique({ where: { id: source.id } })).not.toBeNull();
    const confirmed = {
      ...payload,
      decisions: payload.decisions.map(
        /** Resolve the manual category conflict independently of the selected financial source. */ (decision) => ({
          ...decision,
          categoryChoice: 'CSV' as const,
        }),
      ),
    };
    const result = await assignments.apply(confirmed);
    expect(result.merged).toBe(1);
    expect(await assignments.apply(confirmed)).toEqual(result);
    expect(await resource.db.transaction.findUnique({ where: { id: source.id } })).toBeNull();
    const retained = await resource.db.transaction.findUniqueOrThrow({
      where: { id: existing.id },
      include: { identities: true },
    });
    expect(retained.amountCents).toBe(-990n);
    expect(retained.categoryId).toBe(sourceCategory.id);
    expect(retained.isTransfer).toBe(true);
    expect(retained.identities.length).toBeGreaterThan(1);
    await expect(
      assignments.apply({ ...confirmed, decisions: [{ ...confirmed.decisions[0]!, action: 'CSV' }] }),
    ).rejects.toThrow('anderen Daten');
    expect((await ledger.monthly('2026-11', target.id)).netCents).toBe('0');
  });

  it('supports CSV replacement, separate retention and skipping without accidental reassignment', /** All four decisions preserve deliberate user intent and source scopes. */ async () => {
    const target = await account();
    for (const action of ['CSV', 'SEPARATE', 'SKIP'] as const) {
      const tag = randomUUID(),
        source = await csv(tag);
      const existing = await bank(target.id, target.bankConnectionId, tag);
      const preview = await assignments.preview({ accountId: target.id, transactionIds: [source.id] });
      const result = await assignments.apply({
        requestId: randomUUID(),
        accountId: target.id,
        decisions: [{ transactionId: source.id, token: preview.items[0]!.token, action, candidateId: existing.id }],
      });
      if (action === 'CSV') {
        expect(result.merged).toBe(1);
        expect((await ledger.transaction(existing.id)).amountCents).toBe('-1000');
        expect((await ledger.transaction(existing.id)).description).toBe(tag);
      } else {
        expect((await ledger.transaction(source.id)).accountId).toBe(action === 'SKIP' ? null : target.id);
        expect((await ledger.transaction(existing.id)).amountCents).toBe('-990');
      }
    }
  });

  it('reviews a bank observation against an unassigned CSV without counting it twice', /** The real common importer retains CSV annotations and all source identities. */ async () => {
    const tag = randomUUID(),
      source = await csv(tag),
      target = await account();
    const category = await ledger.createCategory({ name: randomUUID(), kind: 'EXPENSE' });
    await ledger.patchTransaction(source.id, { categoryId: category.id });
    await resource.db.account.update({
      where: { id: target.id },
      data: { bankAccountReference: 'synthetic-discovery' },
    });
    const leaseUntil = new Date(Date.now() + 90_000);
    await resource.db.bankConnection.update({ where: { id: target.bankConnectionId }, data: { leaseUntil } });
    const run = await resource.db.importRun.create({
      data: { bankConnectionId: target.bankConnectionId, source: 'FINTS', status: 'COMMITTING' },
    });
    await imports.bankAccount(
      run.id,
      target.bankConnectionId,
      {
        reference: 'synthetic-discovery',
        name: 'Synthetic bank',
        iban: null,
        balanceCents: '12345',
        observedAt: new Date().toISOString(),
        rows: [
          {
            amountCents: '-1200',
            currency: 'EUR',
            bookingDate: '2026-11-01',
            valueDate: null,
            description: `Bank ${tag}`,
            counterpartyName: null,
            counterpartyIban: null,
            status: 'BOOKED',
            identityType: 'BANK_REFERENCE',
            identityValue: tag,
            reference: tag,
          },
        ],
      },
      '2026-11-02',
      leaseUntil,
    );
    const issue = (await imports.issues(run.id))[0]!;
    expect(issue.candidateIds).toContain(source.id);
    expect(issue.incomingSource).toBe('FINTS');
    expect(issue.incomingReference).toBe(tag);
    expect(issue.candidateSources![source.id]).toContain('CSV');
    expect(issue.candidateReferences![source.id]).toContain(tag);
    expect((await imports.run(run.id)).reviewRequiredCount).toBe(1);
    expect(await resource.db.transaction.count({ where: { id: source.id } })).toBe(1);
    expect((await ledger.monthly('2026-11', target.id)).netCents).toBe('0');
    const decision = {
      issueId: issue.id,
      action: 'INCOMING' as const,
      transactionId: source.id,
      candidateVersion: issue.candidateVersions![source.id],
    };
    const result = await imports.resolve(run.id, [decision]);
    expect(result.reviewRequiredCount).toBe(0);
    expect(await imports.resolve(run.id, [decision])).toEqual(result);
    const retained = await resource.db.transaction.findUniqueOrThrow({
      where: { id: source.id },
      include: { identities: { include: { importRun: true } } },
    });
    expect(retained.accountId).toBe(target.id);
    expect(retained.amountCents).toBe(-1200n);
    expect(retained.categoryId).toBe(category.id);
    expect(
      retained.identities.some(
        /** Original CSV provenance survives the bank match. */ (identity) => identity.importRun?.source === 'CSV',
      ),
    ).toBe(true);
    expect(
      retained.identities.some(
        /** The confirmed bank observation is independently retained. */ (identity) =>
          identity.importRun?.source === 'FINTS',
      ),
    ).toBe(true);
    expect((await ledger.monthly('2026-11', target.id)).netCents).toBe('-1200');
  });

  it('keeps year boundaries exact when a pending observation becomes booked', /** Only the confirmed booked state contributes to its booking month. */ async () => {
    const target = await account(),
      reference = randomUUID();
    const source = await resource.db.transaction.create({
      data: {
        accountId: null,
        amountCents: -101n,
        bookingDate: new Date('2060-12-31'),
        description: 'Pending year boundary',
        status: 'PENDING',
      },
    });
    const staged = await imports.preview({
      accountId: target.id,
      content: `Datum;Betrag;Text;Referenz\n01.01.2061;-1,01;Booked year boundary;${reference}\n`,
      delimiter: ';',
      encoding: 'utf-8',
      mapping: { bookingDate: 'Datum', amount: 'Betrag', description: 'Text', reference: 'Referenz' },
    });
    await resource.db.transactionIdentity.create({
      data: {
        transactionId: source.id,
        accountId: null,
        scope: `import:${randomUUID()}`,
        identityType: 'BANK_REFERENCE',
        identityValue: reference,
      },
    });
    expect((await ledger.monthly('2060-12')).netCents).toBe('0');
    await imports.commit(staged.run.id, false);
    const issue = (await imports.issues(staged.run.id))[0]!;
    expect(issue.candidateIds).toContain(source.id);
    await imports.resolve(staged.run.id, [
      {
        issueId: issue.id,
        action: 'INCOMING',
        transactionId: source.id,
        candidateVersion: issue.candidateVersions![source.id],
      },
    ]);
    await resource.db.transaction.createMany({
      data: [
        { accountId: null, amountCents: 33n, bookingDate: new Date('2061-01-02'), description: 'Refund' },
        {
          accountId: null,
          amountCents: -9900n,
          bookingDate: new Date('2061-01-02'),
          description: 'Transfer',
          isTransfer: true,
        },
      ],
    });
    expect((await ledger.monthly('2060-12')).netCents).toBe('0');
    expect(await ledger.monthly('2061-01')).toMatchObject({
      incomeCents: '33',
      expenseCents: '101',
      netCents: '-68',
      previousNetCents: '0',
    });
    expect((await ledger.monthly('2061-01', target.id)).netCents).toBe('-101');
    expect(await resource.db.transaction.count({ where: { id: source.id, status: 'BOOKED' } })).toBe(1);
  });

  it('rolls back a whole assignment batch if a later preview is stale', /** Earlier choices must not persist when any selected row fails validation. */ async () => {
    const target = await account(),
      first = await csv(randomUUID()),
      second = await csv(randomUUID());
    const preview = await assignments.preview({ accountId: target.id, transactionIds: [first.id, second.id] });
    await ledger.patchTransaction(second.id, { isTransfer: true });
    await expect(
      assignments.apply({
        requestId: randomUUID(),
        accountId: target.id,
        decisions: preview.items.map(
          /** Attempt the displayed batch after one source changed. */ (item) => ({
            transactionId: item.incoming.transaction.id,
            token: item.token,
            action: 'SEPARATE' as const,
          }),
        ),
      }),
    ).rejects.toThrow('neu laden');
    for (const id of [first.id, second.id]) expect((await ledger.transaction(id)).accountId).toBeNull();
  });

  it('rejects stale and hidden candidates and serializes competing confirmations', /** Concurrent or modified previews must not silently lose a source row. */ async () => {
    const target = await account(),
      tag = randomUUID(),
      source = await csv(tag);
    const existing = await bank(target.id, target.bankConnectionId, tag);
    let preview = await assignments.preview({ accountId: target.id, transactionIds: [source.id] });
    const payload = {
      requestId: randomUUID(),
      accountId: target.id,
      decisions: [
        { transactionId: source.id, token: preview.items[0]!.token, action: 'BANK' as const, candidateId: existing.id },
      ],
    };
    await expect(
      assignments.apply({ ...payload, decisions: [{ ...payload.decisions[0]!, candidateId: randomUUID() }] }),
    ).rejects.toThrow('angebotene');
    await ledger.patchTransaction(source.id, { isTransfer: true });
    await expect(assignments.apply(payload)).rejects.toThrow('neu laden');
    preview = await assignments.preview({ accountId: target.id, transactionIds: [source.id] });
    const first = {
      ...payload,
      requestId: randomUUID(),
      decisions: [{ ...payload.decisions[0]!, token: preview.items[0]!.token }],
    };
    const second = { ...first, requestId: randomUUID() };
    const results = await Promise.allSettled([assignments.apply(first), assignments.apply(second)]);
    expect(
      results.filter(/** Only one competing source deletion can commit. */ (result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await resource.db.transaction.count({ where: { id: { in: [source.id, existing.id] } } })).toBe(1);
  });
  it('refuses to collapse the two sides of one explicit transfer group', /** A shared reference must not turn an opposing transfer pair into one transaction. */ async () => {
    const target = await account(),
      tag = randomUUID(),
      source = await csv(tag);
    const counterpart = await bank(target.id, target.bankConnectionId, tag, 1000n);
    const group = await ledger.createTransfer({ transactionIds: [source.id, counterpart.id] });
    const preview = await assignments.preview({ accountId: target.id, transactionIds: [source.id] });
    expect(
      preview.items[0]!.candidates.some(
        /** The reused reference makes this a visible but unsafe merge. */ (candidate) =>
          candidate.transaction.id === counterpart.id,
      ),
    ).toBe(true);
    await expect(
      assignments.apply({
        requestId: randomUUID(),
        accountId: target.id,
        decisions: [
          { transactionId: source.id, token: preview.items[0]!.token, candidateId: counterpart.id, action: 'BANK' },
        ],
      }),
    ).rejects.toThrow('Umbuchungszuordnung');
    const retained = await resource.db.transaction.findMany({ where: { transferGroupId: group.id } });
    expect(retained).toHaveLength(2);
    expect(
      retained.reduce(/** Opposing amounts remain intact after rejection. */ (sum, row) => sum + row.amountCents, 0n),
    ).toBe(0n);
  });
});
