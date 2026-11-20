import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';

/** Resolve optional identities into one set predicate; an empty group always means no matches. */
export async function resolveAccountScope(
  db: Pick<Prisma.TransactionClient, 'accountGroup'>,
  input: { accountId?: string; groupId?: string; unassigned?: 'true' | 'false' },
): Promise<string | { in: string[] } | null | undefined> {
  if (Number(Boolean(input.accountId)) + Number(Boolean(input.groupId)) + Number(input.unassigned === 'true') > 1)
    throw new AppError('INVALID_SCOPE', 'Konto, Kontogruppe oder Ohne-Konto-Filter einzeln auswählen.', 400);
  if (input.unassigned === 'true') return null;
  if (!input.groupId) return input.accountId;
  const group = await db.accountGroup.findUnique({
    where: { id: input.groupId },
    select: { members: { select: { accountId: true } } },
  });
  if (!group) throw new AppError('GROUP_NOT_FOUND', 'Kontogruppe nicht mehr verfügbar. Filter neu auswählen.', 404);
  return {
    in: [
      ...new Set(
        group.members.map(
          /** Retain inactive accounts for truthful historical reports, deduplicated by identity. */ (member) =>
            member.accountId,
        ),
      ),
    ],
  };
}
