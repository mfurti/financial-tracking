import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { Prisma, ContractPayment } from './generated/prisma/client.js';
import { AppError } from './errors.js';
import {
  anchoredMonth,
  berlinToday,
  contractOccurrences,
  isoDay,
  matchContractPayments,
  paymentMatches,
  type ScheduledContract,
} from './contract-schedule.js';

const contractDetails = { revisions: { orderBy: { effectiveDate: 'asc' as const } }, payments: true };
/** Serialize actual links separately from forecast occurrences. */
function publicPayment(payment: ContractPayment) {
  return c.contractPaymentSchema.parse({ ...payment, dueDate: isoDay(payment.dueDate) });
}
/** Roll the next date forward past historical gaps and explicitly prepaid occurrences. */
function publicContract(contract: ScheduledContract & { payments: ContractPayment[] }, today = berlinToday()) {
  const paid = new Set(
    contract.payments.map(/** Only actual links close an occurrence. */ (payment) => isoDay(payment.dueDate)),
  );
  const latest = [today, isoDay(contract.startDate), ...paid].sort().at(-1)!;
  const horizon = Number(latest.slice(0, 4)) >= 9998 ? '9999-12-31' : anchoredMonth(latest, 24, 31);
  const next = contractOccurrences(contract, today, horizon).find(
    /** Past gaps do not block the live due list. */ (occurrence) => !paid.has(occurrence.dueDate),
  );
  return c.contractSchema.parse({
    ...contract,
    startDate: isoDay(contract.startDate),
    endDate: contract.endDate ? isoDay(contract.endDate) : null,
    cancellationDate: contract.cancellationDate ? isoDay(contract.cancellationDate) : null,
    revisions: contract.revisions.map(
      /** Keep rule history with exact cents. */ (revision) => ({
        ...revision,
        effectiveDate: isoDay(revision.effectiveDate),
        amountCents: String(revision.amountCents),
      }),
    ),
    nextDueDate: next?.dueDate ?? null,
    nextAmountCents: next ? String(next.amountCents) : null,
    active: !contract.endDate || isoDay(contract.endDate) >= today,
  });
}
/** Contract lifecycle, explicit suggestions and unique actual-payment ownership. */
@Injectable()
export class ContractsService {
  /** Receive the application-owned database; no bank connection is opened by this service. */
  constructor(@Inject('DB') readonly db: Db) {}
  /** Read a contract with its immutable payment history or a public not-found error. */
  private async find(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.contract.findUnique({ where: { id }, include: contractDetails });
    if (!row) throw new AppError('NOT_FOUND', 'Vertrag nicht gefunden.', 404);
    return row;
  }
  /** Validate explicit account/category bindings without inventing resources. */
  private async references(
    tx: Prisma.TransactionClient,
    input: { accountId?: string | null; categoryId?: string | null },
  ) {
    if (input.accountId && !(await tx.account.findUnique({ where: { id: input.accountId } })))
      throw new AppError('NOT_FOUND', 'Konto nicht gefunden.', 404);
    if (input.categoryId && !(await tx.category.findUnique({ where: { id: input.categoryId } })))
      throw new AppError('NOT_FOUND', 'Kategorie nicht gefunden.', 404);
  }
  /** List active next-due contracts first; the UI refreshes this read when the business day changes. */
  async list(today = berlinToday()) {
    return (await this.db.contract.findMany({ include: contractDetails }))
      .map(/** Derive dates without creating transactions. */ (row) => publicContract(row, today))
      .sort(
        /** Undated or ended contracts follow current obligations. */ (a, b) =>
          Number(b.active) - Number(a.active) ||
          (a.nextDueDate ?? '9999-12-31').localeCompare(b.nextDueDate ?? '9999-12-31') ||
          a.name.localeCompare(b.name),
      );
  }
  /** Read the current schedule summary. */
  async get(id: string) {
    return publicContract(await this.find(id));
  }
  /** Confirmation creates a real contract and then matches only unambiguous existing actual payments. */
  async create(input: z.infer<typeof c.contractInputSchema>) {
    const id = await this.db.$transaction(
      /** Contract and safe initial links commit together. */ async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817834)::text`;
        await this.references(tx, input);
        const contract = await tx.contract.create({
          data: {
            name: input.name,
            provider: input.provider,
            kind: input.kind,
            accountId: input.accountId,
            categoryId: input.categoryId,
            startDate: new Date(input.startDate),
            endDate: input.endDate ? new Date(input.endDate) : null,
            cancellationDate: input.cancellationDate ? new Date(input.cancellationDate) : null,
            revisions: {
              create: {
                effectiveDate: new Date(input.startDate),
                amountCents: BigInt(input.amountCents),
                intervalMonths: input.intervalMonths,
              },
            },
          },
        });
        await matchContractPayments(tx);
        return contract.id;
      },
      { isolationLevel: 'Serializable', timeout: 60000 },
    );
    return this.get(id);
  }
  /** Edit metadata/end dates while preserving prior links and payment-rule history. */
  async patch(id: string, input: z.infer<typeof c.contractPatchSchema>) {
    await this.db.$transaction(
      /** Reject an invalid inclusive end or hidden removal of linked dates. */ async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817834)::text`;
        const previous = await this.find(id, tx);
        await this.references(tx, input);
        if (
          input.endDate &&
          (input.endDate < isoDay(previous.startDate) ||
            previous.payments.some(
              /** Linked history cannot be silently hidden by shortening the term. */ (payment) =>
                isoDay(payment.dueDate) > input.endDate!,
            ))
        )
          throw new AppError(
            'CONTRACT_END',
            'Das Ende liegt vor Beginn oder vor einer zugeordneten Zahlung. Zahlungszuordnung zuerst prüfen.',
            409,
          );
        await tx.contract.update({
          where: { id },
          data: {
            ...input,
            endDate: input.endDate === undefined ? undefined : input.endDate ? new Date(input.endDate) : null,
            cancellationDate:
              input.cancellationDate === undefined
                ? undefined
                : input.cancellationDate
                  ? new Date(input.cancellationDate)
                  : null,
          },
        });
        await matchContractPayments(tx);
      },
      { isolationLevel: 'Serializable', timeout: 60000 },
    );
    return this.get(id);
  }
  /** Start a changed amount/rhythm at an existing future due date, without rewriting previous rules. */
  async revise(id: string, input: z.infer<typeof c.contractRevisionInputSchema>) {
    await this.db.$transaction(
      /** Protect every historical rule and linked occurrence. */ async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817834)::text`;
        const contract = await this.find(id, tx);
        if (
          input.effectiveDate <= berlinToday() ||
          !contractOccurrences(contract, input.effectiveDate, input.effectiveDate).length
        )
          throw new AppError(
            'CONTRACT_REVISION',
            'Wähle eine zukünftige bestehende Fälligkeit als Beginn der Änderung. Frühere Zahlungsregeln bleiben erhalten.',
          );
        if (
          contract.revisions.some(
            /** Keep successive planned revisions explicit, rather than overwriting one. */ (revision) =>
              isoDay(revision.effectiveDate) >= input.effectiveDate,
          ) ||
          contract.payments.some(
            /** Do not invalidate already attributed future payments. */ (payment) =>
              isoDay(payment.dueDate) >= input.effectiveDate,
          )
        )
          throw new AppError(
            'CONTRACT_REVISION',
            'Für diesen Zeitraum gibt es bereits eine Zahlungsregel oder Zuordnung. Bitte zuerst prüfen.',
            409,
          );
        await tx.contractRevision.create({
          data: {
            contractId: id,
            effectiveDate: new Date(input.effectiveDate),
            amountCents: BigInt(input.amountCents),
            intervalMonths: input.intervalMonths,
          },
        });
        await matchContractPayments(tx);
      },
      { isolationLevel: 'Serializable', timeout: 60000 },
    );
    return this.get(id);
  }
  /** Read a bounded calendar-history window and all actual links, including manually divergent dates. */
  async payments(id: string, input: z.infer<typeof c.contractPaymentsQuerySchema>) {
    const contract = await this.find(id),
      today = berlinToday();
    const from = input.from ?? anchoredMonth(today, -12, 1),
      to = input.to ?? anchoredMonth(today, 12, 31);
    if (from > to || Number(to.slice(0, 4)) - Number(from.slice(0, 4)) > 100)
      throw new AppError('INVALID_RANGE', 'Zeitraum prüfen; höchstens 100 Jahre gleichzeitig anzeigen.');
    return c.contractPaymentsSchema.parse({
      from,
      to,
      payments: contract.payments.map(publicPayment),
      occurrences: contractOccurrences(contract, from, to).map(
        /** Attach real ownership without synthesizing payments for open dates. */ (occurrence) => ({
          ...occurrence,
          amountCents: String(occurrence.amountCents),
          payment: contract.payments.find(
            /** A due date has at most one payment. */ (payment) => isoDay(payment.dueDate) === occurrence.dueDate,
          )
            ? publicPayment(
                contract.payments.find(
                  /** Read the same unique occurrence. */ (payment) => isoDay(payment.dueDate) === occurrence.dueDate,
                )!,
              )
            : null,
        }),
      ),
    });
  }
  /** Explicitly link a booked expense; an unusual amount/date/provider/account requires separate confirmation. */
  async link(id: string, input: z.infer<typeof c.contractPaymentInputSchema>) {
    return this.db.$transaction(
      /** Ownership and mismatch consent are checked atomically. */ async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817834)::text`;
        const contract = await this.find(id, tx),
          occurrence = contractOccurrences(contract, input.dueDate, input.dueDate)[0];
        const row = await tx.transaction.findUnique({
          where: { id: input.transactionId },
          include: { contractPayment: true },
        });
        if (!row || !occurrence || row.status !== 'BOOKED' || row.isTransfer || row.amountCents >= 0n)
          throw new AppError('CONTRACT_PAYMENT', 'Wähle eine gebuchte Ausgabe und eine gültige Vertragsfälligkeit.');
        if (
          row.contractPayment ||
          contract.payments.some(
            /** One actual transaction per occurrence. */ (payment) => isoDay(payment.dueDate) === input.dueDate,
          )
        )
          throw new AppError(
            'CONTRACT_PAYMENT',
            'Buchung oder Fälligkeit ist bereits zugeordnet. Bestehende Zuordnung zuerst prüfen.',
            409,
          );
        if (!paymentMatches(contract, occurrence, row) && !input.confirmMismatch)
          throw new AppError(
            'PAYMENT_MISMATCH',
            'Betrag, Datum, Gegenpartei oder Konto weichen ab. Prüfe beide Angaben und bestätige die Abweichung ausdrücklich.',
            409,
          );
        await tx.transaction.update({ where: { id: row.id }, data: { contractAutoBlocked: false } });
        return publicPayment(
          await tx.contractPayment.create({
            data: {
              contractId: id,
              revisionId: occurrence.revisionId,
              dueDate: new Date(input.dueDate),
              transactionId: row.id,
              source: 'MANUAL',
            },
          }),
        );
      },
      { isolationLevel: 'Serializable' },
    );
  }
  /** Removing a link blocks automatic reassignment; the bank transaction remains untouched. */
  async unlink(id: string, paymentId: string) {
    await this.db.$transaction(
      /** Block before deletion in the same commit. */ async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817834)::text`;
        const payment = await tx.contractPayment.findFirst({ where: { id: paymentId, contractId: id } });
        if (!payment) throw new AppError('NOT_FOUND', 'Zahlungszuordnung nicht gefunden.', 404);
        await tx.transaction.update({ where: { id: payment.transactionId }, data: { contractAutoBlocked: true } });
        await tx.contractPayment.delete({ where: { id: payment.id } });
      },
      { isolationLevel: 'Serializable' },
    );
    return { ok: true };
  }
  /** Delete only the contract and links; preserve all actual bank transactions and manual annotations. */
  async remove(id: string) {
    await this.db.$transaction(
      /** Avoid linking another contract immediately after explicit removal. */ async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817834)::text`;
        const contract = await this.find(id, tx);
        await tx.transaction.updateMany({
          where: {
            id: {
              in: contract.payments.map(
                /** Keep the user's unlink decision on the actual row. */ (payment) => payment.transactionId,
              ),
            },
          },
          data: { contractAutoBlocked: true },
        });
        await tx.contractPayment.deleteMany({ where: { contractId: id } });
        await tx.contract.delete({ where: { id } });
      },
      { isolationLevel: 'Serializable' },
    );
    return { ok: true };
  }
  /** Suggest only repeated equal expenses with coherent calendar spacing; never create contracts. */
  async suggestions() {
    const rows = await this.db.transaction.findMany({
      where: {
        status: 'BOOKED',
        isTransfer: false,
        amountCents: { lt: 0n },
        counterpartyName: { not: null },
        contractPayment: null,
        contractAutoBlocked: false,
      },
      orderBy: { bookingDate: 'asc' },
    });
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const provider = row.counterpartyName!.trim().toLocaleLowerCase('de-DE');
      if (!provider) continue;
      const key = `${provider}:${row.amountCents}:${row.accountId}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const suggestions = [];
    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      const last = group.at(-1)!,
        previous = group.at(-2)!;
      const months =
        (last.bookingDate.getUTCFullYear() - previous.bookingDate.getUTCFullYear()) * 12 +
        last.bookingDate.getUTCMonth() -
        previous.bookingDate.getUTCMonth();
      if (![1, 3, 6, 12].includes(months)) continue;
      const matching = group.filter(
        /** Every proposed observation must lie within the same anchored recurrence. */ (row) => {
          const difference =
            (row.bookingDate.getUTCFullYear() - previous.bookingDate.getUTCFullYear()) * 12 +
            row.bookingDate.getUTCMonth() -
            previous.bookingDate.getUTCMonth();
          return (
            difference % months === 0 &&
            Math.abs(
              new Date(
                anchoredMonth(isoDay(previous.bookingDate), difference, previous.bookingDate.getUTCDate()),
              ).getTime() - row.bookingDate.getTime(),
            ) <=
              5 * 86400000
          );
        },
      );
      if (matching.length < 2) continue;
      suggestions.push({
        key: createHash('sha256').update(key).digest('hex'),
        provider: last.counterpartyName!,
        amountCents: String(-last.amountCents),
        intervalMonths: months,
        startDate: isoDay(matching[0]!.bookingDate),
        accountId: last.accountId,
        transactionIds: matching.map(/** Confirmation preserves all actual bank identities. */ (row) => row.id),
        count: matching.length,
      });
    }
    return z.array(c.contractSuggestionSchema).parse(suggestions);
  }
}
