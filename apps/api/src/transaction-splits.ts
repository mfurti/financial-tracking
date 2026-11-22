import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';

type Part = { categoryId: string | null; amountCents: bigint; category?: { name: string } | null };
export type CategorizedBooking = Part & { splits?: Part[] };

export const splitCategories = { include: { category: { select: { name: true } } } } as const;

/** An explicit null selects the uncategorized contribution, including deleted categories. */
export function categoryScope(input: { categoryId?: string; uncategorized?: 'true' | 'false' }) {
  return input.uncategorized === 'true' ? null : input.categoryId;
}

export function categoryWhere(categoryId: string | null | undefined): Prisma.TransactionWhereInput {
  if (categoryId === undefined) return {};
  return { OR: [{ categoryId, splits: { none: {} } }, { splits: { some: { categoryId } } }] };
}

/** Derive signed category amounts. Several removed categories can share the uncategorized bucket. */
export function categoryParts(row: CategorizedBooking, categoryId?: string | null): Part[] {
  if (!row.splits?.length) return categoryId === undefined || row.categoryId === categoryId ? [row] : [];
  const parts = new Map<string | null, Part>();
  for (const split of row.splits) {
    if (categoryId !== undefined && categoryId !== split.categoryId) continue;
    const amountCents = row.amountCents < 0n ? -split.amountCents : split.amountCents;
    const previous = parts.get(split.categoryId);
    if (previous) previous.amountCents += amountCents;
    else parts.set(split.categoryId, { ...split, amountCents });
  }
  return [...parts.values()];
}

export function categoryAmount(row: CategorizedBooking, categoryId: string | null | undefined) {
  if (categoryId === undefined) return row.amountCents;
  return categoryParts(row, categoryId).reduce((sum, part) => sum + part.amountCents, 0n);
}

export function splitConflict() {
  return new AppError('SPLIT_CONFLICT', 'Bearbeite oder entferne zuerst die Teilbuchungen.', 409);
}

/** Preserve allocations when import confirmation changes the retained bank record. */
export async function assertSplitsPreserved(
  tx: Prisma.TransactionClient,
  original: { id: string; amountCents: bigint },
  next: { amountCents: bigint; status: string; isTransfer?: boolean },
) {
  if (next.amountCents === original.amountCents && next.status === 'BOOKED' && !next.isTransfer) return;
  if (await tx.transactionSplit.count({ where: { transactionId: original.id } })) throw splitConflict();
}

/** Carry allocations to the retained ID on an exact merge. Resolve two competing splits explicitly. */
export async function mergeSplits(
  tx: Prisma.TransactionClient,
  source: { id: string; amountCents: bigint },
  target: { id: string; amountCents: bigint },
  next: { amountCents: bigint; status: string; isTransfer: boolean },
) {
  await assertSplitsPreserved(tx, source, next);
  await assertSplitsPreserved(tx, target, next);
  if (!(await tx.transactionSplit.count({ where: { transactionId: source.id } }))) return;
  if (await tx.transactionSplit.count({ where: { transactionId: target.id } })) throw splitConflict();
  await tx.transactionSplit.updateMany({ where: { transactionId: source.id }, data: { transactionId: target.id } });
}
