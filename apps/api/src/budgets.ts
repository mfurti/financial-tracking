import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import {
  categoryBudgetInputSchema,
  categoryBudgetSchema,
  categoryBudgetSummarySchema,
} from '@financial-tracking/contracts';
import { anchoredMonth } from './contract-schedule.js';
import type { Db } from './db.js';
import { AppError } from './errors.js';

/** Budgets store a positive monthly limit. Consumption is derived from the current ledger. */
@Injectable()
export class BudgetsService {
  constructor(@Inject('DB') private readonly db: Db) {}

  async list(month: string) {
    const from = `${month}-01`;
    const to = anchoredMonth(from, 0, 31);
    return this.db.$transaction(
      async (tx) => {
        const budgets = await tx.categoryBudget.findMany({
          where: { month },
          include: { category: { select: { name: true } } },
          orderBy: [{ category: { name: 'asc' } }, { id: 'asc' }],
        });
        if (!budgets.length) return [];

        const categoryId = { in: budgets.map((budget) => budget.categoryId) };
        const bookedExpenses = {
          bookingDate: { gte: new Date(from), lte: new Date(to) },
          status: 'BOOKED',
          isTransfer: false,
          amountCents: { lt: 0n },
        };
        const expenses = await tx.transaction.groupBy({
          by: ['categoryId'],
          where: { ...bookedExpenses, categoryId, splits: { none: {} } },
          _sum: { amountCents: true },
        });
        const allocations = await tx.transactionSplit.groupBy({
          by: ['categoryId'],
          where: { categoryId, transaction: bookedExpenses },
          _sum: { amountCents: true },
        });
        const spent = new Map(expenses.map((entry) => [entry.categoryId, -(entry._sum.amountCents ?? 0n)]));
        for (const allocation of allocations)
          spent.set(
            allocation.categoryId,
            (spent.get(allocation.categoryId) ?? 0n) + (allocation._sum.amountCents ?? 0n),
          );
        return budgets.map((budget) =>
          categoryBudgetSummarySchema.parse({
            id: budget.id,
            month: budget.month,
            categoryId: budget.categoryId,
            categoryName: budget.category.name,
            limitCents: String(budget.limitCents),
            spentCents: String(spent.get(budget.categoryId) ?? 0n),
          }),
        );
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** A database upsert gives repeated or concurrent edits one row per category and month. */
  async set(input: z.infer<typeof categoryBudgetInputSchema>) {
    const { month, categoryId } = input;
    if (!(await this.db.category.findUnique({ where: { id: categoryId }, select: { id: true } })))
      throw new AppError('NOT_FOUND', 'Kategorie nicht gefunden.', 404);
    const limitCents = BigInt(input.limitCents);
    const budget = await this.db.categoryBudget.upsert({
      where: { month_categoryId: { month, categoryId } },
      create: { month, categoryId, limitCents },
      update: { limitCents },
    });
    return categoryBudgetSchema.parse({ ...budget, limitCents: String(budget.limitCents) });
  }

  /** Repeating a removal after a successful request is harmless. */
  async remove(id: string) {
    await this.db.categoryBudget.deleteMany({ where: { id } });
    return { ok: true };
  }
}
