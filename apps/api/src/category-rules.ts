import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  categoryRuleInputSchema,
  categoryRuleSchema,
  categoryRuleBackfillResultSchema,
  categoryTemplateInputSchema,
} from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { CategoryRule, Prisma, Transaction } from './generated/prisma/client.js';
import { AppError } from './errors.js';

/** Compare explicitly entered literal text without regular expressions or outside services. */
export function matchingCategoryRule(
  row: Pick<Transaction, 'counterpartyName' | 'description' | 'amountCents'>,
  rules: CategoryRule[],
) {
  const matches = rules.filter(
    /** Respect active state, amount direction and exact/literal matching. */ (rule) =>
      rule.isActive &&
      (rule.direction === 'ANY' || (rule.direction === 'EXPENSE' ? row.amountCents < 0n : row.amountCents > 0n)) &&
      (rule.matchType === 'COUNTERPARTY'
        ? !!row.counterpartyName &&
          row.counterpartyName.trim().toLocaleLowerCase('de-DE') === rule.text.trim().toLocaleLowerCase('de-DE')
        : row.description.toLocaleLowerCase('de-DE').includes(rule.text.trim().toLocaleLowerCase('de-DE'))),
  );
  const priority = Math.min(...matches.map(/** Lower priority numbers run first. */ (rule) => rule.priority));
  const first = matches.filter(
    /** Lower-ranked matches cannot override a winning priority. */ (rule) => rule.priority === priority,
  );
  if (
    new Set(
      first.map(/** Different categories at the same priority require user clarification. */ (rule) => rule.categoryId),
    ).size > 1
  )
    return { rule: null, conflicting: true };
  return {
    rule: first.sort(/** Stable provenance for equivalent rules. */ (a, b) => a.id.localeCompare(b.id))[0] ?? null,
    conflicting: false,
  };
}

/** Apply only to a newly created or explicitly selected non-manual transaction inside its owning transaction. */
export async function applyCategoryRule(tx: Prisma.TransactionClient, row: Transaction, rules?: CategoryRule[]) {
  if (row.categoryOrigin === 'MANUAL') return { updated: false, conflicting: false };
  const available =
    rules ?? (await tx.categoryRule.findMany({ where: { isActive: true, category: { isActive: true } } }));
  const result = matchingCategoryRule(row, available);
  if (!result.rule) {
    if (result.conflicting || row.categoryOrigin === 'RULE')
      await tx.transaction.update({
        where: { id: row.id },
        data: {
          categoryId: null,
          categoryOrigin: 'NONE',
          categoryRuleId: null,
          categoryRuleName: null,
          categoryRuleConflict: result.conflicting,
        },
      });
    return { updated: false, conflicting: result.conflicting };
  }
  await tx.transaction.update({
    where: { id: row.id },
    data: {
      categoryId: result.rule.categoryId,
      categoryOrigin: 'RULE',
      categoryRuleId: result.rule.id,
      categoryRuleName: result.rule.name,
      categoryRuleConflict: false,
    },
  });
  return { updated: true, conflicting: false };
}

/** Private rule/template management; changing a rule never silently recategorizes historical data. */
@Injectable()
export class CategoryRulesService {
  /** Use the existing application-owned database. */
  constructor(@Inject('DB') readonly db: Db) {}
  /** Return stable evaluation order including disabled rules. */
  async list() {
    return z
      .array(categoryRuleSchema)
      .parse(await this.db.categoryRule.findMany({ orderBy: [{ priority: 'asc' }, { id: 'asc' }] }));
  }
  /** Create or edit a bounded literal rule after validating its active category. */
  async save(
    input: z.infer<typeof categoryRuleInputSchema> | Partial<z.infer<typeof categoryRuleInputSchema>>,
    id?: string,
  ) {
    if (input.categoryId && !(await this.db.category.findFirst({ where: { id: input.categoryId, isActive: true } })))
      throw new AppError('NOT_FOUND', 'Aktive Kategorie nicht gefunden. Bitte erneut auswählen.', 404);
    const row = id
      ? await this.db.categoryRule.update({ where: { id }, data: input })
      : await this.db.categoryRule.create({ data: categoryRuleInputSchema.parse(input) });
    return categoryRuleSchema.parse(row);
  }
  /** Delete the rule, retaining snapshots on existing transactions. */
  async remove(id: string) {
    await this.db.categoryRule.delete({ where: { id } });
    return { ok: true };
  }
  /** Explicitly apply current rules to existing non-manual rows; preserve every manual clear/assignment. */
  async apply() {
    return this.db.$transaction(
      /** Keep rule selection and changed annotations consistent. */ async (tx) => {
        const rules = await tx.categoryRule.findMany({ where: { isActive: true, category: { isActive: true } } });
        const result = {
          updated: 0,
          conflicting: 0,
          protected: await tx.transaction.count({ where: { categoryOrigin: 'MANUAL' } }),
        };
        let cursor: string | undefined;
        while (true) {
          const rows = await tx.transaction.findMany({
            where: { categoryOrigin: { not: 'MANUAL' } },
            orderBy: { id: 'asc' },
            take: 500,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
          });
          for (const row of rows) {
            const outcome = await applyCategoryRule(tx, row, rules);
            if (outcome.updated) result.updated++;
            if (outcome.conflicting) result.conflicting++;
          }
          if (rows.length < 500) break;
          cursor = rows.at(-1)!.id;
        }
        return categoryRuleBackfillResultSchema.parse(result);
      },
      { isolationLevel: 'Serializable', timeout: 60000 },
    );
  }
  /** Reuse matching names and known food/shopping synonyms without renaming user categories. */
  async templates(names: z.infer<typeof categoryTemplateInputSchema>['names']) {
    return this.db.$transaction(
      /** Make repeated template installation idempotent. */ async (tx) => {
        const categories = await tx.category.findMany();
        const aliases: Record<string, string[]> = {
          Lebensmittel: ['lebensmittel', 'essen', 'essen/lebensmittel'],
          Mode: ['mode', 'kleidung'],
          Technik: ['technik', 'elektronik'],
        };
        const result = [];
        for (const name of [...new Set(names)]) {
          const existing = categories.find(
            /** Preserve an existing suitable label and identity. */ (entry) =>
              (aliases[name] ?? [name.toLocaleLowerCase('de-DE')]).includes(
                entry.name.trim().toLocaleLowerCase('de-DE'),
              ),
          );
          result.push(
            existing ?? (await tx.category.upsert({ where: { name }, create: { name, kind: 'EXPENSE' }, update: {} })),
          );
        }
        return result;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
