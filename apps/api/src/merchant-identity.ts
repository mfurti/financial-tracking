import { merchantKeySchema } from '@financial-tracking/contracts';
import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';

/** ECMAScript trim whitespace, passed as a SQL value so database and JavaScript identity agree exactly. */
const trimCharacters =
  '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

/** Preserve exact spelling/case after trimming; absent and whitespace-only sources share the unknown bucket. */
export function merchantIdentity(name: string | null) {
  return name?.trim() || null;
}

/** Encode the canonical source name without exposing a fuzzy text-search contract. */
export function merchantKey(name: string | null) {
  const identity = merchantIdentity(name);
  return identity === null ? 'unknown' : `name:${Buffer.from(identity, 'utf8').toString('base64url')}`;
}

/** Reject noncanonical encodings, invalid UTF-8 and untrimmed identities before any database read. */
export function merchantName(key: string) {
  merchantKeySchema.parse(key);
  if (key === 'unknown') return null;
  try {
    const name = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(key.slice(5), 'base64url'));
    if (!name.includes('\0') && merchantKey(name) === key) return name;
  } catch {
    /* Invalid UTF-8 is reported through the same safe input error below. */
  }
  throw new AppError('MERCHANT_KEY', 'Ungültiger Händlerfilter.', 400);
}

/** Resolve exact source variants in PostgreSQL before applying the existing bounded cursor pagination. */
export async function merchantWhere(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  key?: string,
): Promise<Prisma.TransactionWhereInput> {
  if (key === undefined) return {};
  const identity = merchantName(key);
  const rows = await db.$queryRaw<{ counterpartyName: string | null }[]>`
    SELECT DISTINCT "counterpartyName" FROM "Transaction"
    WHERE NULLIF(btrim("counterpartyName", ${trimCharacters}), '') IS NOT DISTINCT FROM ${identity}::text
  `;
  const names = rows.flatMap(
    /** Keep null separate from Prisma's non-null string membership filter. */ (row) =>
      row.counterpartyName === null ? [] : [row.counterpartyName],
  );
  return {
    OR: [
      { counterpartyName: { in: names } },
      ...(rows.some(/** Explicit unknown source, never a match-all predicate. */ (row) => row.counterpartyName === null)
        ? [{ counterpartyName: null }]
        : []),
    ],
  };
}
