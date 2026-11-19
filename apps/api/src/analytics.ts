import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { Prisma, Transaction } from './generated/prisma/client.js';
import { anchoredMonth, berlinToday, isoDay } from './contract-schedule.js';
import { AppError } from './errors.js';
import { merchantIdentity, merchantKey, merchantWhere } from './merchant-identity.js';

/** Actual relevant bookings with optional presentation labels and confirmed payment ownership. */
export type AnalyticsRow = Pick<Transaction, 'amountCents' | 'bookingDate' | 'categoryId' | 'classification'> & {
  category?: { name: string } | null;
  contractPayment?: unknown;
};
/** The transaction drill-down uses the exact same manual-first classification as aggregation. */
export function classificationWhere(value?: z.infer<typeof c.classificationSchema>): Prisma.TransactionWhereInput {
  if (value === 'VARIABLE') return { classification: 'VARIABLE' };
  if (value === 'FIXED')
    return { OR: [{ classification: 'FIXED' }, { classification: null, contractPayment: { isNot: null } }] };
  if (value === 'UNCLASSIFIED') return { classification: null, contractPayment: null };
  return {};
}
/** Resolve twelve completed months by default and reject reversed or over-36-calendar-month windows before reading data. */
export function analyticsRange(input: z.infer<typeof c.analyticsOverviewQuerySchema>, today = berlinToday()) {
  const currentStart = `${today.slice(0, 7)}-01`;
  const from = input.from ?? anchoredMonth(currentStart, -12, 1),
    to = input.to ?? anchoredMonth(currentStart, -1, 31);
  const months =
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
  if (from > to || months < 1 || months > 36)
    throw new AppError('ANALYTICS_RANGE', 'Wähle einen gültigen Zeitraum von höchstens 36 Kalendermonaten.');
  return { from, to, months };
}
/** Round only a display percentage; all monetary calculations remain integer BIGINT. */
function share(part: bigint, total: bigint) {
  return total === 0n ? 0 : Number((part * 10000n) / total) / 10000;
}
/** Aggregate exact actual amounts, disclose gaps and derive averages only from complete past months containing data. */
export function calculateAnalytics(rows: AnalyticsRow[], from: string, to: string, today = berlinToday()) {
  const range = analyticsRange({ from, to }, today);
  const monthly = Array.from(
    { length: range.months },
    /** Initialize selected calendar months, including visible gaps. */ (_, index) => {
      const first = anchoredMonth(`${from.slice(0, 7)}-01`, index, 1),
        last = anchoredMonth(first, 0, 31);
      return {
        month: first.slice(0, 7),
        from: first < from ? from : first,
        to: last > to ? to : last,
        income: 0n,
        expense: 0n,
        count: 0,
        first,
        last,
      };
    },
  );
  const categories = new Map<string, { categoryId: string | null; name: string; expense: bigint; count: number }>();
  const classifications = new Map(
    (['FIXED', 'VARIABLE', 'UNCLASSIFIED'] as const).map(
      /** Keep empty classification buckets visible. */ (classification) => [
        classification,
        { classification, expense: 0n, count: 0 },
      ],
    ),
  );
  let income = 0n,
    expense = 0n;
  for (const row of rows) {
    const day = isoDay(row.bookingDate);
    if (day < from || day > to) continue;
    const month = monthly.find(
      /** Each calendar date belongs to one selected bucket. */ (entry) => entry.month === day.slice(0, 7),
    )!;
    month.count++;
    if (row.amountCents > 0n) {
      income += row.amountCents;
      month.income += row.amountCents;
    } else if (row.amountCents < 0n) {
      const amount = -row.amountCents;
      expense += amount;
      month.expense += amount;
      const key = row.categoryId ?? '',
        category = categories.get(key) ?? {
          categoryId: row.categoryId,
          name: row.category?.name ?? 'Nicht kategorisiert',
          expense: 0n,
          count: 0,
        };
      category.expense += amount;
      category.count++;
      categories.set(key, category);
      const classification = row.classification ?? (row.contractPayment ? 'FIXED' : 'UNCLASSIFIED');
      const bucket = classifications.get(classification as 'FIXED' | 'VARIABLE' | 'UNCLASSIFIED')!;
      bucket.expense += amount;
      bucket.count++;
    }
  }
  const months = monthly.map(
    /** Current/future/partial and empty months never become fabricated zero-denominator observations. */ (month) => {
      const reason =
        month.month === today.slice(0, 7)
          ? 'CURRENT'
          : month.month > today.slice(0, 7)
            ? 'FUTURE'
            : month.first < from || month.last > to
              ? 'PARTIAL'
              : month.count === 0
                ? 'NO_DATA'
                : null;
      return {
        month: month.month,
        from: month.from,
        to: month.to,
        incomeCents: String(month.income),
        expenseCents: String(month.expense),
        netCents: String(month.income - month.expense),
        count: month.count,
        averageEligible: reason === null,
        excludedReason: reason,
      };
    },
  );
  const eligible = months.filter(
    /** Income-only months count as observed zero-expense months. */ (month) => month.averageEligible,
  );
  const denominator = BigInt(eligible.length),
    sum = eligible.reduce(
      /** Sum only eligible expense magnitudes. */ (total, month) => total + BigInt(month.expenseCents),
      0n,
    );
  const latest = eligible.at(-1),
    previousMonth = latest ? anchoredMonth(`${latest.month}-01`, -1, 1).slice(0, 7) : null;
  const previous = eligible.find(
    /** A gap cannot be skipped to manufacture a trend. */ (month) => month.month === previousMonth,
  );
  const delta = latest && previous ? BigInt(latest.expenseCents) - BigInt(previous.expenseCents) : null;
  return c.analyticsOverviewSchema.parse({
    from,
    to,
    months,
    incomeCents: String(income),
    expenseCents: String(expense),
    netCents: String(income - expense),
    average: {
      expenseCents: denominator ? String((sum + denominator / 2n) / denominator) : null,
      monthCount: eligible.length,
      excludedMonths: months
        .filter(/** Explain every excluded month. */ (month) => month.excludedReason !== null)
        .map(
          /** No booking contents leak into exclusion explanations. */ (month) => ({
            month: month.month,
            reason: month.excludedReason,
          }),
        ),
    },
    trend:
      latest && previous && delta !== null
        ? {
            month: latest.month,
            previousMonth: previous.month,
            changeCents: String(delta),
            percent:
              BigInt(previous.expenseCents) === 0n
                ? null
                : Number((delta * 10000n) / BigInt(previous.expenseCents)) / 100,
          }
        : null,
    categories: [...categories.values()]
      .sort(
        /** Larger exact expenses lead the breakdown. */ (a, b) =>
          a.expense === b.expense ? a.name.localeCompare(b.name) : a.expense > b.expense ? -1 : 1,
      )
      .map(
        /** Serialize once, preserving integer precision. */ (category) => ({
          categoryId: category.categoryId,
          name: category.name,
          expenseCents: String(category.expense),
          count: category.count,
          share: share(category.expense, expense),
        }),
      ),
    classification: [...classifications.values()].map(
      /** Manual overrides and actual contract links determine the three-way split. */ (bucket) => ({
        classification: bucket.classification,
        expenseCents: String(bucket.expense),
        count: bucket.count,
        share: share(bucket.expense, expense),
      }),
    ),
  });
}
/** Bounded multi-month reports over actual booked non-transfer transactions only. */
@Injectable()
export class AnalyticsService {
  /** Reuse the application's private persistence. */
  constructor(@Inject('DB') readonly db: Db) {}
  /** Reuse actual aggregation for one inclusive Berlin calendar month and publish exactly contributing query identities. */
  async review(input: z.infer<typeof c.monthlyReviewQuerySchema>, today = berlinToday()) {
    const from = `${input.month}-01`,
      to = anchoredMonth(from, 0, 31);
    const report = await this.overview({ from, to, accountId: input.accountId }, today);
    const bookedCount = report.months[0]!.count;
    const query = {
      from,
      to,
      ...(input.accountId ? { accountId: input.accountId } : {}),
      status: 'BOOKED' as const,
      excludeTransfers: 'true' as const,
    };
    return c.monthlyReviewSchema.parse({
      month: input.month,
      scope: { from, to, accountId: input.accountId ?? null },
      incomeCents: report.incomeCents,
      expenseCents: report.expenseCents,
      netCents: report.netCents,
      bookedCount,
      completeness: {
        calendar: input.month < today.slice(0, 7) ? 'CLOSED' : input.month === today.slice(0, 7) ? 'CURRENT' : 'FUTURE',
        hasBookings: bookedCount > 0,
        historyComplete: false,
      },
      provenance: { basis: 'BOOKED_NON_TRANSFER', includesUnassigned: !input.accountId, refunds: 'INCOME' },
      queries: { income: { ...query, direction: 'INCOME' }, expense: { ...query, direction: 'EXPENSE' } },
    });
  }
  /** Aggregate booked non-transfer expenses by exact trimmed source identity, preserving effective query provenance. */
  async merchants(input: z.infer<typeof c.merchantAnalyticsQuerySchema>, today = berlinToday()) {
    const { from, to } = analyticsRange(input, today);
    const rows = await this.db.transaction.findMany({
      where: {
        AND: await merchantWhere(this.db, input.merchantKey),
        status: 'BOOKED',
        isTransfer: false,
        amountCents: { lt: 0n },
        accountId: input.unassigned === 'true' ? null : input.accountId,
        categoryId: input.uncategorized === 'true' ? null : input.categoryId,
        bookingDate: { gte: new Date(from), lte: new Date(to) },
      },
      select: { counterpartyName: true, amountCents: true },
    });
    const buckets = new Map<
      string,
      { key: string; name: string | null; label: string; expense: bigint; count: number }
    >();
    let total = 0n;
    for (const row of rows) {
      const name = merchantIdentity(row.counterpartyName),
        key = merchantKey(name);
      const bucket = buckets.get(key) ?? { key, name, label: name ?? 'Unbekannter Händler', expense: 0n, count: 0 };
      bucket.expense -= row.amountCents;
      bucket.count++;
      total -= row.amountCents;
      buckets.set(key, bucket);
    }
    return c.merchantAnalyticsSchema.parse({
      scope: {
        from,
        to,
        accountId: input.accountId ?? null,
        categoryId: input.categoryId ?? null,
        unassigned: input.unassigned === 'true',
        uncategorized: input.uncategorized === 'true',
        ...(input.merchantKey ? { merchantKey: input.merchantKey } : {}),
      },
      expenseCents: String(total),
      merchants: [...buckets.values()]
        .sort(
          /** Sort exact amounts with stable opaque identity tie-breaking. */ (a, b) =>
            a.expense === b.expense ? a.key.localeCompare(b.key) : a.expense > b.expense ? -1 : 1,
        )
        .map(
          /** Serialize arbitrary-precision aggregates only at the transport boundary. */ (bucket) => ({
            key: bucket.key,
            name: bucket.name,
            label: bucket.label,
            expenseCents: String(bucket.expense),
            count: bucket.count,
          }),
        ),
    });
  }
  /** Apply account/category filters before aggregation; accountless bookings count by default. */
  async overview(input: z.infer<typeof c.analyticsOverviewQuerySchema>, today = berlinToday()) {
    const { from, to } = analyticsRange(input, today);
    const rows = await this.db.transaction.findMany({
      where: {
        AND: await merchantWhere(this.db, input.merchantKey),
        status: 'BOOKED',
        isTransfer: false,
        accountId: input.unassigned === 'true' ? null : input.accountId,
        categoryId: input.uncategorized === 'true' ? null : input.categoryId,
        bookingDate: { gte: new Date(from), lte: new Date(to) },
      },
      include: { category: { select: { name: true } }, contractPayment: { select: { id: true } } },
    });
    return calculateAnalytics(rows, from, to, today);
  }
}
