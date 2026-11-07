import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';

/** Attach confirmed account aliases without ever stealing an identity from another logical transaction. */
export async function linkAccountIdentities(
  tx: Prisma.TransactionClient,
  accountId: string | null,
  transactionId: string,
  identities: { identityType: string; identityValue: string; importRunId: string | null }[],
  allowSeparate = false,
) {
  if (!accountId) return;
  for (const identity of identities) {
    const key = {
      scope: `account:${accountId}`,
      identityType: identity.identityType,
      identityValue: identity.identityValue,
    };
    const existing = await tx.transactionIdentity.findUnique({ where: { scope_identityType_identityValue: key } });
    if (existing && existing.transactionId !== transactionId) {
      if (allowSeparate) continue;
      throw new AppError(
        'IDENTITY_CONFLICT',
        'Diese Quellreferenz gehört zu einer anderen Zielbuchung. Vergleich erneut prüfen.',
        409,
      );
    }
    await tx.transactionIdentity.upsert({
      where: { scope_identityType_identityValue: key },
      create: { ...key, accountId, transactionId, importRunId: identity.importRunId },
      update: {},
    });
  }
}

/** Preserve a retained transfer group's opposite side when assigning or changing financial values. */
export async function assertTransferPlacement(
  tx: Prisma.TransactionClient,
  groupId: string | null,
  excludedIds: string[],
  accountId: string | null,
  amount: bigint,
) {
  if (!groupId) return;
  const where = { transferGroupId: groupId, id: { notIn: excludedIds } };
  const members = await tx.transaction.findMany({ where, orderBy: { id: 'asc' } });
  for (const member of members)
    await tx.$queryRaw`SELECT "id" FROM "Transaction" WHERE "id" = ${member.id}::uuid FOR UPDATE`;
  const current = await tx.transaction.findMany({ where });
  if (
    current.length > 1 ||
    current.some(
      /** Assignment must not turn a valid pair into same-account or unequal transfers. */ (member) =>
        member.accountId === accountId || member.amountCents + amount !== 0n || amount === 0n,
    )
  )
    throw new AppError(
      'TRANSFER_CONFLICT',
      'Umbuchung vor dieser Änderung prüfen und gegebenenfalls ausdrücklich aufheben.',
      409,
    );
}
