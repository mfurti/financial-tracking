import type { Contract, ContractRevision, Transaction, Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';

/** A persisted contract with immutable, time-effective payment rules. */
export type ScheduledContract = Omit<Contract, 'direction'> & {
  direction?: Contract['direction'];
  revisions: ContractRevision[];
};
/** A forecast occurrence has no bank identity and is never a ledger transaction. */
export type ContractOccurrence = { dueDate: string; amountCents: bigint; revisionId: string };
/** Read the local business day independently of the execution host's timezone. */
export function berlinToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
}
/** Serialize a database calendar date without local-time shifts. */
export function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
/** Move by calendar months while retaining the original contract day, including month-end/leap years. */
export function anchoredMonth(date: string, months: number, anchor: number): string {
  const start = new Date(`${date}T00:00:00Z`);
  const result = new Date(0);
  result.setUTCFullYear(start.getUTCFullYear(), start.getUTCMonth() + months + 1, 0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(Math.min(anchor, result.getUTCDate()));
  return isoDay(result);
}
/** Count month boundaries; monetary values never pass through numbers. */
function monthDifference(first: string, last: string) {
  return (
    (Number(last.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(last.slice(5, 7)) - Number(first.slice(5, 7))
  );
}
/** Generate only requested real schedule dates; earlier rules end before their successor begins. */
export function contractOccurrences(contract: ScheduledContract, from: string, to: string): ContractOccurrence[] {
  const start = isoDay(contract.startDate),
    end = contract.endDate ? isoDay(contract.endDate) : '9999-12-31';
  const anchor = contract.startDate.getUTCDate();
  const revisions = [...contract.revisions].sort(
    /** Effective dates define ownership of each occurrence. */ (a, b) =>
      a.effectiveDate.getTime() - b.effectiveDate.getTime(),
  );
  const result: ContractOccurrence[] = [];
  for (let index = 0; index < revisions.length; index++) {
    const revision = revisions[index]!;
    const effective = isoDay(revision.effectiveDate),
      next = revisions[index + 1] ? isoDay(revisions[index + 1]!.effectiveDate) : null;
    const first = Math.max(0, Math.floor(monthDifference(effective, from) / revision.intervalMonths) - 1);
    const last = Math.max(0, Math.ceil(monthDifference(effective, to) / revision.intervalMonths) + 1);
    for (let step = first; step <= last; step++) {
      const monthOffset = step * revision.intervalMonths;
      if (Number(effective.slice(0, 4)) * 12 + Number(effective.slice(5, 7)) - 1 + monthOffset >= 120000) break;
      const date = anchoredMonth(effective, monthOffset, anchor);
      if (date >= start && date >= effective && date >= from && date <= to && date <= end && (!next || date < next))
        result.push({ dueDate: date, amountCents: revision.amountCents, revisionId: revision.id });
    }
  }
  return result.sort(
    /** Upcoming dates and history use the same chronology. */ (a, b) => a.dueDate.localeCompare(b.dueDate),
  );
}
/** Determine the amount/date tolerance and explicitly configured provider/account of a payment. */
export function paymentMatches(contract: ScheduledContract, occurrence: ContractOccurrence, row: Transaction) {
  return (
    row.status === 'BOOKED' &&
    !row.isTransfer &&
    row.amountCents === (contract.direction === 'INCOME' ? occurrence.amountCents : -occurrence.amountCents) &&
    row.counterpartyName?.trim().toLocaleLowerCase('de-DE') === contract.provider.trim().toLocaleLowerCase('de-DE') &&
    (!contract.accountId || contract.accountId === row.accountId) &&
    Math.abs(row.bookingDate.getTime() - new Date(occurrence.dueDate).getTime()) <= 5 * 86400000
  );
}
/** Match only unambiguous one-to-one edges; a second plausible row/contract never wins by query order. */
export async function matchContractPayments(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817834)::text`;
  const contracts = await tx.contract.findMany({ include: { revisions: true, payments: true } });
  if (!contracts.length) return;
  const hasIncome = contracts.some((contract) => contract.direction === 'INCOME');
  const hasExpense = contracts.some((contract) => contract.direction !== 'INCOME');
  const rows = await tx.transaction.findMany({
    where: {
      status: 'BOOKED',
      isTransfer: false,
      amountCents: hasIncome && hasExpense ? { not: 0n } : hasIncome ? { gt: 0n } : { lt: 0n },
      contractAutoBlocked: false,
      contractPayment: null,
    },
  });
  const edges: { contractId: string; occurrence: ContractOccurrence; row: Transaction; key: string }[] = [];
  const rowCounts = new Map<string, number>(),
    dueCounts = new Map<string, number>();
  for (const contract of contracts) {
    const occupied = new Set(
      contract.payments.map(/** One actual bank transaction per occurrence. */ (payment) => isoDay(payment.dueDate)),
    );
    for (const row of rows) {
      const from = new Date(row.bookingDate);
      from.setUTCDate(from.getUTCDate() - 5);
      const to = new Date(row.bookingDate);
      to.setUTCDate(to.getUTCDate() + 5);
      for (const occurrence of contractOccurrences(contract, isoDay(from), isoDay(to))) {
        if (occupied.has(occurrence.dueDate) || !paymentMatches(contract, occurrence, row)) continue;
        const key = `${contract.id}:${occurrence.dueDate}`;
        edges.push({ contractId: contract.id, occurrence, row, key });
        rowCounts.set(row.id, (rowCounts.get(row.id) ?? 0) + 1);
        dueCounts.set(key, (dueCounts.get(key) ?? 0) + 1);
      }
    }
  }
  for (const edge of edges)
    if (rowCounts.get(edge.row.id) === 1 && dueCounts.get(edge.key) === 1)
      await tx.contractPayment.create({
        data: {
          contractId: edge.contractId,
          revisionId: edge.occurrence.revisionId,
          dueDate: new Date(edge.occurrence.dueDate),
          transactionId: edge.row.id,
          source: 'AUTO',
        },
      });
}
/** Prevent a reviewed source overwrite from silently changing the meaning of an existing contract payment. */
export async function assertContractPaymentPreserved(
  tx: Prisma.TransactionClient,
  row: Transaction,
  replacement: Pick<Transaction, 'amountCents' | 'bookingDate' | 'counterpartyName'>,
) {
  if (
    row.amountCents === replacement.amountCents &&
    isoDay(row.bookingDate) === isoDay(replacement.bookingDate) &&
    row.counterpartyName === replacement.counterpartyName
  )
    return;
  if (await tx.contractPayment.findUnique({ where: { transactionId: row.id } }))
    throw new AppError(
      'CONTRACT_CONFLICT',
      'Diese Buchung ist einem Vertrag zugeordnet. Prüfe und entferne die Zahlungszuordnung vor dem Ändern der Buchungsdaten.',
      409,
    );
}
