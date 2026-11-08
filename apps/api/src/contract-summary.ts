import * as c from '@financial-tracking/contracts';
import { z } from 'zod';
import type { Contract, ContractRevision } from './generated/prisma/client.js';
import { isoDay } from './contract-schedule.js';

/** Persistence projection required for today's contract-only monthly plan. */
export type CostContract = Contract & { revisions: ContractRevision[]; category: { name: string } | null };
const labels: Record<string, string> = {
  SUBSCRIPTION: 'Abo',
  RENT: 'Miete',
  INSURANCE: 'Versicherung',
  ENERGY: 'Energie',
  TELECOM: 'Telefon & Internet',
  OTHER: 'Sonstiges',
};

/** Sum the same rounded per-contract cents shown in every row, never bank transactions. */
export function summarizeContracts(records: CostContract[], today: string) {
  const contracts: z.infer<typeof c.contractCostSchema>[] = [];
  for (const record of records) {
    if (isoDay(record.startDate) > today || (record.endDate && isoDay(record.endDate) < today)) continue;
    const revision = record.revisions
      .filter(
        /** Future price changes do not affect today's fixed costs. */ (rule) => isoDay(rule.effectiveDate) <= today,
      )
      .sort(
        /** Pick the last effective rule even for unsorted database fixtures. */ (a, b) =>
          a.effectiveDate.getTime() - b.effectiveDate.getTime(),
      )
      .at(-1);
    if (!revision) continue;
    const divisor = BigInt(revision.intervalMonths);
    const monthlyCents = (revision.amountCents + divisor / 2n) / divisor;
    contracts.push(
      c.contractCostSchema.parse({
        id: record.id,
        name: record.name,
        provider: record.provider,
        kind: record.kind,
        categoryId: record.categoryId,
        categoryName: record.category?.name ?? 'Ohne Kategorie',
        amountCents: String(revision.amountCents),
        intervalMonths: revision.intervalMonths,
        monthlyCents: String(monthlyCents),
      }),
    );
  }
  /** Group exact displayed costs without independent rounding or implicit payment categories. */
  function groups(by: 'category' | 'kind') {
    const result = new Map<string, z.infer<typeof c.contractCostGroupSchema>>();
    for (const contract of contracts) {
      const key = by === 'category' ? (contract.categoryId ?? 'uncategorized') : contract.kind;
      const group = result.get(key) ?? {
        key,
        name: by === 'category' ? contract.categoryName : labels[contract.kind]!,
        monthlyCents: '0',
        count: 0,
        contractIds: [],
      };
      group.monthlyCents = String(BigInt(group.monthlyCents) + BigInt(contract.monthlyCents));
      group.count++;
      group.contractIds.push(contract.id);
      result.set(key, group);
    }
    return [...result.values()].sort(
      /** Order money exactly, then names for stable ties. */ (a, b) =>
        BigInt(a.monthlyCents) === BigInt(b.monthlyCents)
          ? a.name.localeCompare(b.name, 'de')
          : BigInt(a.monthlyCents) > BigInt(b.monthlyCents)
            ? -1
            : 1,
    );
  }
  return c.contractSummarySchema.parse({
    asOf: today,
    count: contracts.length,
    monthlyCents: String(
      contracts.reduce(
        /** Accumulate exact rounded cents, including beyond individual BIGINT limits. */ (total, row) =>
          total + BigInt(row.monthlyCents),
        0n,
      ),
    ),
    contracts,
    categories: groups('category'),
    kinds: groups('kind'),
  });
}
