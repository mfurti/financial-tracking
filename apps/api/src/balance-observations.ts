import type { Prisma } from './generated/prisma/client.js';

/** Read each selected account with its latest real booked observation using deterministic timestamp/ID ties. */
export async function latestBookedAccounts(tx: Prisma.TransactionClient, where: Prisma.AccountWhereInput) {
  return tx.account.findMany({
    where,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: {
      balances: { where: { balanceType: 'BOOKED' }, orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], take: 1 },
    },
  });
}
