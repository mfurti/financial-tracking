import type { categoryBudgetSummarySchema } from '@financial-tracking/contracts';
import type { z } from 'zod';

export type CategoryBudget = z.infer<typeof categoryBudgetSummarySchema>;
export type BudgetList =
  { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; budgets: CategoryBudget[] };

export function budgetBalance(budget: CategoryBudget) {
  return BigInt(budget.limitCents) - BigInt(budget.spentCents);
}

/** Reserve only the part of each remaining budget beyond the existing planned expenses. */
export function forecastBudgetRests(
  budgets: readonly CategoryBudget[],
  openExpenses: readonly { categoryId: string | null; plannedCents: string }[],
) {
  const plannedByCategory = new Map<string, bigint>();
  for (const expense of openExpenses) {
    if (expense.categoryId === null) continue;
    plannedByCategory.set(
      expense.categoryId,
      (plannedByCategory.get(expense.categoryId) ?? 0n) + BigInt(expense.plannedCents),
    );
  }
  return budgets.map((budget) => {
    const balance = budgetBalance(budget);
    const remaining = balance > 0n ? balance : 0n;
    const planned = plannedByCategory.get(budget.categoryId) ?? 0n;
    const covered = remaining < planned ? remaining : planned;
    return { ...budget, remaining, covered, additional: remaining - covered };
  });
}
