import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { AssignmentService } from '../apps/api/src/assignments.js';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  contractOccurrences,
  anchoredMonth,
  matchContractPayments,
  type ScheduledContract,
} from '../apps/api/src/contract-schedule.js';
import { ContractsService } from '../apps/api/src/contracts.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { ImportService } from '../apps/api/src/imports.js';
import { testDatabase } from './database.js';
import { contractInputSchema } from '../packages/contracts/src/index.js';
import { editableEuro, euroCents } from '../apps/web/app/utils/euro-input.js';

/** Build a pure calendar fixture without any database or current-day assumptions. */
function schedule(start: string, intervalMonths = 1): ScheduledContract {
  const id = randomUUID();
  return {
    id,
    name: 'Synthetic',
    provider: 'SYNTHETIC',
    kind: 'OTHER',
    accountId: null,
    categoryId: null,
    startDate: new Date(start),
    endDate: null,
    cancellationDate: null,
    revisions: [
      { id: randomUUID(), contractId: id, effectiveDate: new Date(start), amountCents: 1234n, intervalMonths },
    ],
  };
}
describe('anchored calendar contracts', /** Calendar boundaries never drift after a shorter month. */ () => {
  it('retains month-end and leap-year anchors across every supported rhythm', /** Check actual dates rather than approximating periods by day counts. */ () => {
    expect(
      contractOccurrences(schedule('2024-01-31'), '2024-01-01', '2024-03-31').map(
        /** Inspect exact calendar due dates. */ (row) => row.dueDate,
      ),
    ).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
    expect(
      contractOccurrences(schedule('2025-01-31', 3), '2025-01-01', '2025-07-31').map(
        /** Quarter ends retain the original day. */ (row) => row.dueDate,
      ),
    ).toEqual(['2025-01-31', '2025-04-30', '2025-07-31']);
    expect(
      contractOccurrences(schedule('2024-02-29', 12), '2024-01-01', '2028-12-31').map(
        /** Annual leap-day contracts return to February 29 when possible. */ (row) => row.dueDate,
      ),
    ).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
    expect(anchoredMonth('2026-12-31', 6, 31)).toBe('2027-06-30');
  });
  it('partitions effective rules and honors inclusive ending without duplicate forecasts', /** Future changes do not rewrite earlier amounts or rhythms. */ () => {
    const contract = schedule('2026-01-31');
    contract.revisions.push({
      id: randomUUID(),
      contractId: contract.id,
      effectiveDate: new Date('2026-04-30'),
      amountCents: 2345n,
      intervalMonths: 3,
    });
    contract.endDate = new Date('2026-07-31');
    const rows = contractOccurrences(contract, '2026-01-01', '2027-01-01');
    expect(rows.map(/** Compare exact time-effective values. */ (row) => [row.dueDate, row.amountCents])).toEqual([
      ['2026-01-31', 1234n],
      ['2026-02-28', 1234n],
      ['2026-03-31', 1234n],
      ['2026-04-30', 2345n],
      ['2026-07-31', 2345n],
    ]);
    expect(euroCents('90071992547409,93')).toBe('9007199254740993');
    expect(editableEuro('9007199254740993')).toBe('90071992547409,93');
    expect(() => euroCents('1e3')).toThrow();
  });
});

describe('confirmed contracts and actual payments', /** Exercise real uniqueness, imports, overrides, unlink protection and preservation. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let contracts: ContractsService, ledger: LedgerService, imports: ImportService;
  beforeAll(
    /** Start a fully migrated disposable database. */ async () => {
      resource = await testDatabase();
      contracts = new ContractsService(resource.db);
      ledger = new LedgerService(resource.db);
      imports = new ImportService(resource.db);
    },
  );
  afterAll(/** Close only owned PostgreSQL resources. */ async () => resource?.close());
  /** Insert a synthetic actual booking, never a generated forecast. */
  async function booking(provider: string, date: string, cents = -1234n) {
    return resource.db.transaction.create({
      data: {
        description: `${provider} ${date}`,
        counterpartyName: provider,
        amountCents: cents,
        bookingDate: new Date(date),
      },
    });
  }
  /** Confirm a provider with bounded exact-cent input. */
  async function confirm(provider: string, startDate: string, amountCents = '1234') {
    return contracts.create(
      contractInputSchema.parse({
        name: provider,
        provider,
        kind: 'SUBSCRIPTION',
        startDate,
        amountCents,
        intervalMonths: 1,
      }),
    );
  }
  it('suggests only after two periods, requires confirmation and rolls next due past old gaps', /** Forecasts never increase actual transaction counts or monthly expenses. */ async () => {
    const provider = randomUUID();
    await booking(provider, '2026-01-31');
    expect(
      (await contracts.suggestions()).some(
        /** One booking is insufficient evidence. */ (row) => row.provider === provider,
      ),
    ).toBe(false);
    const second = await booking(provider, '2026-02-28');
    const proposed = (await contracts.suggestions()).find(
      /** Read only this provider's evidence. */ (row) => row.provider === provider,
    )!;
    expect(proposed.count).toBe(2);
    expect(await resource.db.contract.count()).toBe(0);
    const count = await resource.db.transaction.count(),
      before = await ledger.monthly('2026-02');
    const contract = await confirm(provider, proposed.startDate);
    expect(await resource.db.transaction.count()).toBe(count);
    expect((await ledger.monthly('2026-02')).expenseCents).toBe(before.expenseCents);
    expect((await ledger.transaction(second.id)).contract?.id).toBe(contract.id);
    expect((await ledger.transaction(second.id)).effectiveClassification).toBe('FIXED');
    expect((await ledger.patchTransaction(second.id, { classification: 'VARIABLE' })).effectiveClassification).toBe(
      'VARIABLE',
    );
    expect(
      (await contracts.list('2026-11-08')).find(
        /** Past unmatched dates must not block the live list. */ (row) => row.id === contract.id,
      )!.nextDueDate,
    ).toBe('2026-11-30');
    const earlier = await confirm(randomUUID(), '2026-11-10');
    const sorted = await contracts.list('2026-11-08');
    expect(sorted.findIndex(/** Locate earlier due date. */ (row) => row.id === earlier.id)).toBeLessThan(
      sorted.findIndex(/** Locate later obligation. */ (row) => row.id === contract.id),
    );
  });
  it('automatically marks new imports after the complete batch and preserves repeated imports', /** The matching hook is part of real CSV persistence. */ async () => {
    const provider = randomUUID(),
      contract = await confirm(provider, '2030-01-31');
    const connection = await ledger.createConnection({ name: provider, bankCode: '69050001', connectorType: 'CSV' });
    const account = await ledger.createAccount({
      name: provider,
      bankConnectionId: connection.id,
      accountType: 'CHECKING',
    });
    const input = {
      accountId: account.id,
      content: `Datum;Betrag;Text;Partner;Referenz\n31.01.2030;-12,34;Monthly;${provider};${provider}\n`,
      delimiter: ';' as const,
      encoding: 'utf-8' as const,
      mapping: {
        bookingDate: 'Datum',
        amount: 'Betrag',
        description: 'Text',
        counterpartyName: 'Partner',
        reference: 'Referenz',
      },
    };
    const first = await imports.preview(input);
    await imports.commit(first.run.id, false);
    const row = await resource.db.transaction.findFirstOrThrow({ where: { counterpartyName: provider } });
    expect((await ledger.transaction(row.id)).contract?.id).toBe(contract.id);
    const repeated = await imports.preview(input);
    expect((await imports.commit(repeated.run.id, false)).knownCount).toBe(1);
    expect(await resource.db.contractPayment.count({ where: { contractId: contract.id } })).toBe(1);
    const ambiguousProvider = randomUUID();
    await confirm(ambiguousProvider, '2031-01-01');
    const ambiguous = await imports.preview({
      ...input,
      content: `Datum;Betrag;Text;Partner;Referenz\n01.01.2031;-12,34;First;${ambiguousProvider};one\n02.01.2031;-12,34;Second;${ambiguousProvider};two\n`,
    });
    await imports.commit(ambiguous.run.id, false);
    expect(
      await resource.db.contractPayment.count({ where: { transaction: { counterpartyName: ambiguousProvider } } }),
    ).toBe(0);
  });
  it('leaves multiple plausible rows/contracts open, requires mismatch consent and blocks immediate relinking', /** One contract per actual booking and one actual booking per occurrence. */ async () => {
    const provider = randomUUID(),
      first = await booking(provider, '2031-01-01'),
      second = await booking(provider, '2031-01-02');
    const contract = await confirm(provider, '2031-01-01');
    expect(await resource.db.contractPayment.count({ where: { contractId: contract.id } })).toBe(0);
    await contracts.link(contract.id, { transactionId: first.id, dueDate: '2031-01-01', confirmMismatch: false });
    await expect(
      contracts.link(contract.id, { transactionId: second.id, dueDate: '2031-01-01', confirmMismatch: true }),
    ).rejects.toThrow('bereits');
    const payment = await resource.db.contractPayment.findUniqueOrThrow({ where: { transactionId: first.id } });
    await contracts.unlink(contract.id, payment.id);
    await resource.db.$transaction(
      /** Exercise the production matching helper after explicit unlink. */ async (tx) => matchContractPayments(tx),
    );
    expect((await ledger.transaction(first.id)).contract).toBeNull();
    expect((await ledger.transaction(first.id)).contractAutoBlocked).toBe(true);
    const different = await booking(provider, '2031-04-20', -1500n);
    await expect(
      contracts.link(contract.id, { transactionId: different.id, dueDate: '2031-04-01', confirmMismatch: false }),
    ).rejects.toThrow('weichen ab');
    await contracts.link(contract.id, { transactionId: different.id, dueDate: '2031-04-01', confirmMismatch: true });
    expect((await ledger.transaction(different.id)).amountCents).toBe('-1500');
    await expect(ledger.patchTransaction(different.id, { isTransfer: true })).rejects.toThrow('Vertragszahlung');
    const before = await resource.db.transaction.count();
    await contracts.remove(contract.id);
    expect(await resource.db.transaction.count()).toBe(before);
    expect((await ledger.transaction(different.id)).contract).toBeNull();
    const duplicateProvider = randomUUID();
    await confirm(duplicateProvider, '2032-01-01');
    await confirm(duplicateProvider, '2032-01-01');
    const ambiguous = await booking(duplicateProvider, '2032-01-01');
    await resource.db.$transaction(
      /** A row matching two confirmed contracts remains unresolved. */ async (tx) => matchContractPayments(tx),
    );
    expect((await ledger.transaction(ambiguous.id)).contract).toBeNull();
  });
  it('keeps past payment rules immutable and applies changed amounts from a future occurrence', /** Reject arbitrary effective dates and preserve actual history. */ async () => {
    const contract = await confirm(randomUUID(), '2035-01-31');
    await expect(
      contracts.revise(contract.id, { effectiveDate: '2035-02-15', amountCents: '2000', intervalMonths: 3 }),
    ).rejects.toThrow('Fälligkeit');
    const changed = await contracts.revise(contract.id, {
      effectiveDate: '2035-02-28',
      amountCents: '2000',
      intervalMonths: 3,
    });
    expect(changed.revisions).toHaveLength(2);
    const history = await contracts.payments(contract.id, { from: '2035-01-01', to: '2035-06-30' });
    expect(
      history.occurrences.map(
        /** Verify the versioned forecast rather than changing original bookings. */ (row) => [
          row.dueDate,
          row.amountCents,
        ],
      ),
    ).toEqual([
      ['2035-01-31', '1234'],
      ['2035-02-28', '2000'],
      ['2035-05-31', '2000'],
    ]);
    await contracts.patch(contract.id, { endDate: '2035-05-31' });
    expect((await contracts.payments(contract.id, { from: '2035-01-01', to: '2036-12-31' })).occurrences).toHaveLength(
      3,
    );
    expect(
      (await contracts.list('2035-06-01')).find(
        /** Ended contracts have no future obligation. */ (row) => row.id === contract.id,
      )!.nextDueDate,
    ).toBeNull();
  });
  it('transfers one contract link during account consolidation and rejects competing links atomically', /** Manual source decisions and actual-payment identity survive source-row removal. */ async () => {
    const provider = randomUUID(),
      source = await booking(provider, '2034-01-01');
    const contract = await confirm(provider, '2034-01-01');
    const connection = await ledger.createConnection({ name: provider, bankCode: '69050001', connectorType: 'CSV' });
    const account = await ledger.createAccount({
      name: provider,
      bankConnectionId: connection.id,
      accountType: 'CHECKING',
    });
    const target = await resource.db.transaction.create({
      data: {
        accountId: account.id,
        amountCents: source.amountCents,
        bookingDate: source.bookingDate,
        description: source.description,
        counterpartyName: provider,
      },
    });
    const assignments = new AssignmentService(resource.db);
    const preview = await assignments.preview({ accountId: account.id, transactionIds: [source.id] });
    await assignments.apply({
      requestId: randomUUID(),
      accountId: account.id,
      decisions: [{ transactionId: source.id, token: preview.items[0]!.token, action: 'BANK', candidateId: target.id }],
    });
    expect((await ledger.transaction(target.id)).contract?.id).toBe(contract.id);
    expect(await resource.db.transaction.findUnique({ where: { id: source.id } })).toBeNull();
    const otherSource = await booking(provider, '2034-02-01');
    const otherProvider = randomUUID(),
      otherTarget = await resource.db.transaction.create({
        data: {
          accountId: account.id,
          amountCents: otherSource.amountCents,
          bookingDate: otherSource.bookingDate,
          description: otherSource.description,
          counterpartyName: otherProvider,
        },
      });
    await confirm(otherProvider, '2034-02-01');
    await resource.db.$transaction(
      /** Attribute the second provider's February payment before merging. */ async (tx) => matchContractPayments(tx),
    );
    const conflict = await assignments.preview({ accountId: account.id, transactionIds: [otherSource.id] });
    await expect(
      assignments.apply({
        requestId: randomUUID(),
        accountId: account.id,
        decisions: [
          {
            transactionId: otherSource.id,
            token: conflict.items[0]!.token,
            action: 'BANK',
            candidateId: otherTarget.id,
          },
        ],
      }),
    ).rejects.toThrow('Beide Buchungen');
    expect((await ledger.transaction(otherSource.id)).contract?.id).toBe(contract.id);
    expect((await ledger.transaction(otherTarget.id)).contract).not.toBeNull();
    expect(
      (await contracts.list('2030-01-01')).find(
        /** A contract beginning far in the future still has a first due date. */ (row) => row.id === contract.id,
      )!.nextDueDate,
    ).not.toBeNull();
  });
  it('validates nested payment HTTP contracts, ownership and CSRF before unlinking', /** A second named path parameter must reach the shared serializer and OpenAPI. */ async () => {
    await resource.db.user.create({
      data: { username: 'contract-user', passwordHash: await passwordHash('synthetic-contract-password') },
    });
    const service = await createApp(resource.db, false);
    try {
      await service.app.getHttpAdapter().getInstance().ready();
      const provider = randomUUID(),
        row = await booking(provider, '2036-01-01'),
        contract = await confirm(provider, '2036-01-01');
      const payment = await resource.db.contractPayment.findUniqueOrThrow({ where: { transactionId: row.id } });
      const url = `/api/v1/contracts/${contract.id}/payments/${payment.id}`;
      expect((await service.app.inject({ method: 'DELETE', url })).statusCode).toBe(401);
      const login = await service.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'contract-user', password: 'synthetic-contract-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!,
        headers = { cookie, origin: 'http://localhost:3000', 'x-csrf-token': login.json().csrfToken };
      expect(
        (await service.app.inject({ method: 'DELETE', url, headers: { cookie, origin: 'http://localhost:3000' } }))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await service.app.inject({
            method: 'DELETE',
            url: `/api/v1/contracts/${randomUUID()}/payments/${payment.id}`,
            headers,
          })
        ).statusCode,
      ).toBe(404);
      const response = await service.app.inject({ method: 'DELETE', url, headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
      expect((await ledger.transaction(row.id)).contractAutoBlocked).toBe(true);
      expect(service.openapi.paths['/api/v1/contracts/{id}/payments/{paymentId}']?.delete?.parameters).toContainEqual(
        expect.objectContaining({ name: 'paymentId', in: 'path', required: true }),
      );
    } finally {
      await service.app.close();
    }
  });
});
