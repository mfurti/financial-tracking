import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  accountInputSchema,
  accountPatchSchema,
  accountSchema,
  balanceSchema,
  categoryInputSchema,
  categorySchema,
  connectionInputSchema,
  connectionSchema,
  transactionQuerySchema,
  transactionPatchSchema,
  transactionSchema,
  transactionPageSchema,
  monthlySchema,
  transferSchema,
} from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { Prisma, Transaction } from './generated/prisma/client.js';
import { AppError } from './errors.js';
import { classificationWhere } from './analytics.js';

/** Serialize dates and BIGINT without exposing persistence metadata. */
export function publicTransaction(
  row: Transaction & { contractPayment?: { dueDate: Date; contract: { id: string; name: string } } | null },
) {
  return transactionSchema.parse({
    ...row,
    effectiveClassification: row.classification ?? (row.contractPayment ? 'FIXED' : 'UNCLASSIFIED'),
    contract: row.contractPayment
      ? {
          id: row.contractPayment.contract.id,
          name: row.contractPayment.contract.name,
          dueDate: row.contractPayment.dueDate.toISOString().slice(0, 10),
        }
      : null,
    amountCents: String(row.amountCents),
    bookingDate: row.bookingDate.toISOString().slice(0, 10),
    valueDate: row.valueDate?.toISOString().slice(0, 10) ?? null,
  });
}

/** Account management, user annotations, and exact monthly analytics. */
@Injectable()
export class LedgerService {
  /** Receive database ownership from the application. */
  constructor(@Inject('DB') readonly db: Db) {}

  /** List connections without protocol metadata. */
  async connections() {
    return z.array(connectionSchema).parse(await this.db.bankConnection.findMany({ orderBy: { createdAt: 'asc' } }));
  }
  /** Create a private bank connection; URLs and PINs cannot be supplied here. */
  async createConnection(input: z.infer<typeof connectionInputSchema>) {
    return connectionSchema.parse(await this.db.bankConnection.create({ data: input }));
  }
  /** Update only public connection settings. */
  async patchConnection(id: string, input: Partial<z.infer<typeof connectionInputSchema>> & { status?: string }) {
    await this.db.bankConnection.findUniqueOrThrow({ where: { id } });
    return connectionSchema.parse(await this.db.bankConnection.update({ where: { id }, data: input }));
  }
  /** List account details with the latest actual balance of each type. */
  async accounts(id?: string) {
    const records = await this.db.account.findMany({
      where: id ? { id } : {},
      orderBy: { name: 'asc' },
      include: { balances: { orderBy: { observedAt: 'desc' }, distinct: ['balanceType'] } },
    });
    return records.map(
      /** Convert database timestamps and amounts at the boundary. */ (row) =>
        accountSchema.parse({
          ...row,
          lastSuccessfulSyncAt: row.lastSuccessfulSyncAt?.toISOString() ?? null,
          balances: row.balances.map(
            /** Preserve the source observation time. */ (balance) => ({
              ...balance,
              amountCents: String(balance.amountCents),
              observedAt: balance.observedAt.toISOString(),
            }),
          ),
        }),
    );
  }
  /** Read one account or return a public not-found error. */
  async account(id: string) {
    const row = (await this.accounts(id))[0];
    if (!row) throw new AppError('NOT_FOUND', 'Konto nicht gefunden.', 404);
    return row;
  }
  /** Create a manually assigned account for CSV; no invented balance. */
  async createAccount(input: z.infer<typeof accountInputSchema>) {
    const connection = await this.db.bankConnection.findUnique({ where: { id: input.bankConnectionId } });
    if (!connection) throw new AppError('NOT_FOUND', 'Bankverbindung nicht gefunden.', 404);
    if (input.iban && (await this.db.account.findFirst({ where: { iban: input.iban } })))
      throw new AppError('ACCOUNT_EXISTS', 'IBAN bereits vorhanden. Bestehendes Konto verwenden.', 409);
    const row = await this.db.account.create({ data: { ...input, bankAccountReference: input.iban ?? null } });
    return this.account(row.id);
  }
  /** Update a display label or deactivate an account without deleting history. */
  async patchAccount(id: string, input: z.infer<typeof accountPatchSchema>) {
    const previous = await this.account(id);
    if (input.bankConnectionId) {
      if (!previous.iban || !(await this.db.bankConnection.findUnique({ where: { id: input.bankConnectionId } })))
        throw new AppError('ACCOUNT_MAPPING', 'IBAN und gültige Zielverbindung für die Zuordnung erforderlich.');
    }
    await this.db.account.update({
      where: { id },
      data: { ...input, ...(input.bankConnectionId ? { bankAccountReference: previous.iban } : {}) },
    });
    return this.account(id);
  }
  /** Return actual balance history independently of imported transaction totals. */
  async balances(id: string) {
    await this.account(id);
    return z.array(balanceSchema).parse(
      (
        await this.db.balanceSnapshot.findMany({
          where: { accountId: id },
          orderBy: { observedAt: 'desc' },
          take: 365,
        })
      ).map(
        /** Convert BIGINT and date to transport values. */ (row) => ({
          ...row,
          amountCents: String(row.amountCents),
          observedAt: row.observedAt.toISOString(),
        }),
      ),
    );
  }
  /** List all categories, including disabled historical choices. */
  async categories() {
    return z
      .array(categorySchema)
      .parse(await this.db.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }));
  }
  /** Create a user-managed category. */
  async createCategory(input: z.infer<typeof categoryInputSchema>) {
    return categorySchema.parse(await this.db.category.create({ data: input }));
  }
  /** Update category settings without changing transaction amounts. */
  async patchCategory(id: string, input: Partial<z.infer<typeof categoryInputSchema>>) {
    return categorySchema.parse(await this.db.category.update({ where: { id }, data: input }));
  }
  /** Delete a confirmed category; the FK clears transaction assignments. */
  async deleteCategory(id: string) {
    await this.db.category.delete({ where: { id } });
    return { ok: true };
  }
  /** Search transactions with a stable date/id cursor and bounded pages. */
  async transactions(query: z.infer<typeof transactionQuerySchema>) {
    const where: Prisma.TransactionWhereInput = {
      AND: classificationWhere(query.classification),
      accountId: query.unassigned === 'true' ? null : query.accountId,
      categoryId: query.uncategorized === 'true' ? null : query.categoryId,
      status: query.status,
      isTransfer: query.excludeTransfers === 'true' ? false : undefined,
      bookingDate: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
      amountCents: query.direction === 'INCOME' ? { gt: 0n } : query.direction === 'EXPENSE' ? { lt: 0n } : undefined,
      OR: query.search
        ? [
            { description: { contains: query.search, mode: 'insensitive' } },
            { counterpartyName: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const rows = await this.db.transaction.findMany({
      where,
      include: { contractPayment: { include: { contract: { select: { id: true, name: true } } } } },
      orderBy: [{ bookingDate: 'desc' }, { id: 'desc' }],
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
    });
    const more = rows.length > query.limit;
    if (more) rows.pop();
    return transactionPageSchema.parse({
      items: rows.map(publicTransaction),
      nextCursor: more ? rows.at(-1)!.id : null,
    });
  }
  /** Return a single transaction independent of its source. */
  async transaction(id: string) {
    const row = await this.db.transaction.findUnique({
      where: { id },
      include: { contractPayment: { include: { contract: { select: { id: true, name: true } } } } },
    });
    if (!row) throw new AppError('NOT_FOUND', 'Umsatz nicht gefunden.', 404);
    return publicTransaction(row);
  }
  /** Preserve transfer group consistency when annotations change. */
  async patchTransaction(id: string, input: z.infer<typeof transactionPatchSchema>) {
    return this.db.$transaction(
      /** Validate and update the group, counterpart, and annotation as one atomic change. */ async (tx) => {
        const previous = await tx.transaction.findUnique({ where: { id } });
        if (!previous) throw new AppError('NOT_FOUND', 'Umsatz nicht gefunden.', 404);
        if (input.isTransfer && (await tx.contractPayment.findUnique({ where: { transactionId: id } })))
          throw new AppError(
            'CONTRACT_CONFLICT',
            'Diese Ausgabe ist eine Vertragszahlung. Zahlungszuordnung vor dem Markieren als Umbuchung prüfen und entfernen.',
            409,
          );
        if (input.categoryId) {
          const category = await tx.category.findUnique({ where: { id: input.categoryId } });
          if (!category) throw new AppError('NOT_FOUND', 'Kategorie nicht gefunden.', 404);
        }
        if (input.isTransfer === false && previous.transferGroupId) {
          await tx.transaction.updateMany({
            where: { transferGroupId: previous.transferGroupId },
            data: { transferGroupId: null, isTransfer: false },
          });
          await tx.transferGroup.delete({ where: { id: previous.transferGroupId } });
        }
        return publicTransaction(
          await tx.transaction.update({
            where: { id },
            include: { contractPayment: { include: { contract: { select: { id: true, name: true } } } } },
            data: {
              ...input,
              ...('categoryId' in input
                ? {
                    categoryOrigin: 'MANUAL',
                    categoryRuleId: null,
                    categoryRuleName: null,
                    categoryRuleConflict: false,
                  }
                : {}),
            },
          }),
        );
      },
      { isolationLevel: 'Serializable' },
    );
  }
  /** Apply one manual category to a bounded, explicit list atomically. */
  async bulkCategory(ids: string[], categoryId: string | null) {
    if (categoryId && !(await this.db.category.findUnique({ where: { id: categoryId } })))
      throw new AppError('NOT_FOUND', 'Kategorie nicht gefunden.', 404);
    const unique = [...new Set(ids)];
    if ((await this.db.transaction.count({ where: { id: { in: unique } } })) !== unique.length)
      throw new AppError('NOT_FOUND', 'Umsatz nicht gefunden.', 404);
    await this.db.transaction.updateMany({
      where: { id: { in: unique } },
      data: {
        categoryId,
        categoryOrigin: 'MANUAL',
        categoryRuleId: null,
        categoryRuleName: null,
        categoryRuleConflict: false,
      },
    });
    return { updated: unique.length };
  }
  /** Apply a manual fixed/variable override to explicitly selected rows without changing amounts. */
  async bulkClassification(ids: string[], classification: 'FIXED' | 'VARIABLE' | null) {
    const unique = [...new Set(ids)];
    return this.db.$transaction(
      /** Reject missing selections atomically. */ async (tx) => {
        if ((await tx.transaction.count({ where: { id: { in: unique } } })) !== unique.length)
          throw new AppError('NOT_FOUND', 'Umsatz nicht gefunden. Auswahl neu laden.', 404);
        await tx.transaction.updateMany({ where: { id: { in: unique } }, data: { classification } });
        return { updated: unique.length };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  /** Link one missing-side transfer or two balanced own-account transactions. */
  async createTransfer(input: z.infer<typeof transferSchema>) {
    return this.db.$transaction(
      /** Check both sides and annotate them in one commit. */ async (tx) => {
        const rows = await tx.transaction.findMany({ where: { id: { in: input.transactionIds } } });
        if (
          rows.length !== input.transactionIds.length ||
          rows.some(/** Refuse membership in two groups. */ (row) => row.transferGroupId)
        )
          throw new AppError('INVALID_TRANSFER', 'Umbuchungszuordnung ungültig.', 409);
        if (await tx.contractPayment.count({ where: { transactionId: { in: input.transactionIds } } }))
          throw new AppError('CONTRACT_CONFLICT', 'Vertragszahlungen zuerst ausdrücklich vom Vertrag lösen.', 409);
        if (
          rows.length === 2 &&
          (rows[0]!.accountId === rows[1]!.accountId ||
            rows[0]!.amountCents + rows[1]!.amountCents !== 0n ||
            rows[0]!.amountCents === 0n)
        )
          throw new AppError(
            'INVALID_TRANSFER',
            'Umbuchung benötigt unterschiedliche Konten und entgegengesetzte gleiche Beträge.',
          );
        const group = await tx.transferGroup.create({ data: {} });
        await tx.transaction.updateMany({
          where: { id: { in: input.transactionIds } },
          data: { isTransfer: true, transferGroupId: group.id },
        });
        return { id: group.id };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  /** Remove the group and both transfer markers together. */
  async removeTransfer(id: string) {
    await this.db.$transaction(
      /** Prevent a dangling marked counterpart. */ async (tx) => {
        await tx.transaction.updateMany({
          where: { transferGroupId: id },
          data: { transferGroupId: null, isTransfer: false },
        });
        await tx.transferGroup.delete({ where: { id } });
      },
    );
    return { ok: true };
  }
  /** Aggregate exact cents using booking dates, excluding pending and own transfers. */
  async monthly(month: string, accountId?: string) {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const previous = new Date(start);
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    const rows = await this.db.transaction.findMany({
      where: { accountId, bookingDate: { gte: previous, lt: end }, status: 'BOOKED', isTransfer: false },
      include: { category: true },
    });
    let income = 0n,
      expense = 0n,
      previousNet = 0n;
    const categories = new Map<
      string,
      { categoryId: string | null; name: string; income: bigint; expense: bigint; count: number }
    >();
    for (const row of rows) {
      if (row.bookingDate < start) {
        previousNet += row.amountCents;
        continue;
      }
      const incoming = row.amountCents > 0n ? row.amountCents : 0n,
        outgoing = row.amountCents < 0n ? -row.amountCents : 0n;
      income += incoming;
      expense += outgoing;
      const key = row.categoryId ?? '';
      const category = categories.get(key) ?? {
        categoryId: row.categoryId,
        name: row.category?.name ?? 'Nicht kategorisiert',
        income: 0n,
        expense: 0n,
        count: 0,
      };
      category.income += incoming;
      category.expense += outgoing;
      category.count++;
      categories.set(key, category);
    }
    return monthlySchema.parse({
      month,
      incomeCents: String(income),
      expenseCents: String(expense),
      netCents: String(income - expense),
      previousNetCents: String(previousNet),
      deltaCents: String(income - expense - previousNet),
      categories: [...categories.values()].map(
        /** Round percentages only for presentation; never round cent totals. */ (category) => ({
          categoryId: category.categoryId,
          name: category.name,
          incomeCents: String(category.income),
          expenseCents: String(category.expense),
          count: category.count,
          expenseShare: expense ? Number(category.expense) / Number(expense) : null,
        }),
      ),
    });
  }
}
