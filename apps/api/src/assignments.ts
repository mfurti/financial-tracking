import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  assignmentInputSchema,
  assignmentPreviewInputSchema,
  assignmentPreviewSchema,
  assignmentResultSchema,
} from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { Prisma } from './generated/prisma/client.js';
import { publicTransaction } from './ledger.js';
import { AppError } from './errors.js';
import { assertTransferPlacement, linkAccountIdentities } from './transaction-invariants.js';

const details = {
  account: true,
  identities: { include: { importRun: { select: { source: true } } }, orderBy: { id: 'asc' as const } },
};
type RecordWithSources = Prisma.TransactionGetPayload<{ include: typeof details }>;

/** Keep source references readable while preserving the original source identities in persistence. */
function record(row: RecordWithSources) {
  const references = row.identities.map(
    /** Old migrated identities have unknown provenance rather than an invented CSV/bank source. */ (identity) => ({
      type: identity.identityType,
      value: identity.identityValue,
      source:
        identity.importRun?.source === 'CSV' || identity.importRun?.source === 'FINTS'
          ? identity.importRun.source
          : 'LEGACY',
    }),
  );
  return { transaction: publicTransaction(row), accountName: row.account?.name ?? null, references };
}

/** Compare and assign existing unassigned transactions without duplicate sums or lost annotations. */
@Injectable()
export class AssignmentService {
  /** Share persistence; no source or target is inferred from browser-only state. */
  constructor(@Inject('DB') private readonly db: Db) {}

  /** Build a bounded current comparison whose token covers values, annotations and source identities. */
  private async previewRows(tx: Prisma.TransactionClient, input: z.infer<typeof assignmentPreviewInputSchema>) {
    const account = await tx.account.findUnique({ where: { id: input.accountId } });
    if (!account?.isActive) throw new AppError('NOT_FOUND', 'Aktives Zielkonto nicht gefunden.', 404);
    const rows = await tx.transaction.findMany({ where: { id: { in: input.transactionIds } }, include: details });
    if (
      rows.length !== input.transactionIds.length ||
      rows.some(
        /** Only explicit unassigned source transactions can be moved by this workflow. */ (row) =>
          row.accountId !== null,
      )
    )
      throw new AppError('ASSIGNMENT_STATE', 'Ausgewählte Buchung fehlt oder ist bereits einem Konto zugeordnet.', 409);
    const items = [];
    for (const id of input.transactionIds) {
      const row = rows.find(/** Preserve the user's explicit selection order. */ (item) => item.id === id)!;
      const references = row.identities
        .filter(
          /** Only meaningful bank references broaden candidate search beyond equal dates/amounts. */ (identity) =>
            identity.identityType === 'BANK_REFERENCE',
        )
        .map(
          /** Compare references, never use them as cross-source merge authorization. */ (identity) =>
            identity.identityValue,
        );
      const candidates = await tx.transaction.findMany({
        where: {
          accountId: account.id,
          OR: [
            { amountCents: row.amountCents, bookingDate: row.bookingDate },
            { identities: { some: { identityType: 'BANK_REFERENCE', identityValue: { in: references } } } },
          ],
        },
        include: details,
        orderBy: { id: 'asc' },
        take: 51,
      });
      const hasMoreCandidates = candidates.length > 50;
      if (hasMoreCandidates) candidates.pop();
      const incoming = record(row),
        offered = candidates.map(record);
      const token = createHash('sha256')
        .update(
          JSON.stringify({
            accountId: account.id,
            incoming,
            offered,
            hasMoreCandidates,
            versions: [
              row.updatedAt.toISOString(),
              ...candidates.map(
                /** Detect changes even when a value was changed back between requests. */ (candidate) =>
                  candidate.updatedAt.toISOString(),
              ),
            ],
          }),
        )
        .digest('hex');
      items.push({ incoming, candidates: offered, token, hasMoreCandidates });
    }
    return assignmentPreviewSchema.parse({ accountId: account.id, items });
  }

  /** Read-only preview is not approval to mutate or auto-match a similar transaction. */
  async preview(input: z.infer<typeof assignmentPreviewInputSchema>) {
    return this.previewRows(this.db, input);
  }

  /** Apply one reviewed batch atomically and replay only an identical committed request. */
  async apply(input: z.infer<typeof assignmentInputSchema>) {
    const inputHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const ids = input.decisions.map(/** Keep selection identity explicit. */ (decision) => decision.transactionId);
    if (new Set(ids).size !== ids.length) throw new AppError('INVALID_ASSIGNMENT', 'Buchung mehrfach ausgewählt.');
    const mergeIds = input.decisions
      .filter(
        /** One batch must not present contradictory overwrites of the same destination. */ (decision) =>
          ['BANK', 'CSV'].includes(decision.action),
      )
      .map(/** Extract only offered merge destinations. */ (decision) => decision.candidateId);
    if (new Set(mergeIds).size !== mergeIds.length)
      throw new AppError('INVALID_ASSIGNMENT', 'Eine Zielbuchung pro Bestätigung nur einmal verwenden.');
    return this.db.$transaction(
      /** Locks, optimistic tokens, aliases, annotations and replay receipt commit together. */ async (tx) => {
        const receipt = await tx.assignmentReceipt.findUnique({ where: { id: input.requestId } });
        if (receipt) {
          if (receipt.inputHash !== inputHash)
            throw new AppError('REQUEST_CONFLICT', 'Bestätigung wurde mit anderen Daten verwendet.', 409);
          return assignmentResultSchema.parse(receipt.result);
        }
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817833)::text`;
        await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${input.accountId}::uuid FOR UPDATE`;
        const lockedIds = [
          ...new Set([
            ...ids,
            ...mergeIds.filter(
              /** Missing merge choices are rejected below rather than interpolated into SQL. */ (id): id is string =>
                !!id,
            ),
          ]),
        ].sort();
        for (const id of lockedIds)
          await tx.$queryRaw`SELECT "id" FROM "Transaction" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const preview = await this.previewRows(tx, { accountId: input.accountId, transactionIds: ids });
        for (const decision of input.decisions) {
          const item = preview.items.find(
            /** Bind each decision to the complete current source comparison. */ (entry) =>
              entry.incoming.transaction.id === decision.transactionId,
          )!;
          if (decision.token !== item.token)
            throw new AppError('ASSIGNMENT_STALE', 'Vergleich wurde geändert. Vorschau neu laden.', 409);
          if (
            ['BANK', 'CSV'].includes(decision.action) &&
            !item.candidates.some(
              /** Refuse arbitrary hidden or cross-account target IDs. */ (candidate) =>
                candidate.transaction.id === decision.candidateId,
            )
          )
            throw new AppError('INVALID_MATCH', 'Nur angebotene Zielbuchungen wählen.', 409);
        }
        const result: z.infer<typeof assignmentResultSchema> = { assigned: 0, merged: 0, skipped: 0, results: [] };
        for (const decision of input.decisions) {
          const source = await tx.transaction.findUniqueOrThrow({
            where: { id: decision.transactionId },
            include: details,
          });
          if (decision.action === 'SKIP') {
            result.skipped++;
            result.results.push({ transactionId: source.id, resultingId: null });
            continue;
          }
          if (decision.action === 'SEPARATE') {
            await assertTransferPlacement(tx, source.transferGroupId, [source.id], input.accountId, source.amountCents);
            await tx.transaction.update({ where: { id: source.id }, data: { accountId: input.accountId } });
            await tx.transactionIdentity.updateMany({
              where: { transactionId: source.id },
              data: { accountId: input.accountId },
            });
            await linkAccountIdentities(tx, input.accountId, source.id, source.identities, true);
            result.assigned++;
            result.results.push({ transactionId: source.id, resultingId: source.id });
            continue;
          }
          const candidate = await tx.transaction.findUniqueOrThrow({
            where: { id: decision.candidateId! },
            include: details,
          });
          if (
            source.categoryId &&
            candidate.categoryId &&
            source.categoryId !== candidate.categoryId &&
            !decision.categoryChoice
          )
            throw new AppError(
              'ANNOTATION_CONFLICT',
              'Unterschiedliche manuelle Kategorien: Quelle ausdrücklich wählen.',
              409,
            );
          if (
            source.transferGroupId &&
            candidate.transferGroupId &&
            source.transferGroupId !== candidate.transferGroupId
          )
            throw new AppError(
              'TRANSFER_CONFLICT',
              'Zwei Umbuchungsgruppen zuerst ausdrücklich prüfen und auflösen.',
              409,
            );
          const categoryId =
            decision.categoryChoice === 'CSV'
              ? source.categoryId
              : decision.categoryChoice === 'BANK'
                ? candidate.categoryId
                : (candidate.categoryId ?? source.categoryId);
          const chosen = decision.action === 'CSV' ? source : candidate;
          const transferGroupId = candidate.transferGroupId ?? source.transferGroupId;
          await assertTransferPlacement(
            tx,
            transferGroupId,
            [source.id, candidate.id],
            input.accountId,
            chosen.amountCents,
          );
          await linkAccountIdentities(tx, input.accountId, candidate.id, source.identities);
          await tx.transactionIdentity.updateMany({
            where: { transactionId: source.id },
            data: { transactionId: candidate.id, accountId: input.accountId },
          });
          await tx.transaction.update({
            where: { id: candidate.id },
            data: {
              amountCents: chosen.amountCents,
              bookingDate: chosen.bookingDate,
              valueDate: chosen.valueDate,
              description: chosen.description,
              counterpartyName: chosen.counterpartyName,
              counterpartyIban: chosen.counterpartyIban,
              status: chosen.status,
              categoryId,
              isTransfer: source.isTransfer || candidate.isTransfer,
              transferGroupId,
            },
          });
          await tx.transaction.delete({ where: { id: source.id } });
          result.merged++;
          result.results.push({ transactionId: source.id, resultingId: candidate.id });
        }
        await tx.assignmentReceipt.create({ data: { id: input.requestId, inputHash, result } });
        return result;
      },
      { timeout: 60000, isolationLevel: 'Serializable' },
    );
  }
}
