import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';

/** Atomically remove only provably import-owned rows, retaining other source evidence. */
@Injectable()
export class ImportRollbackService {
  /** Receive application persistence; this operation never accesses a bank. */
  constructor(@Inject('DB') readonly db: Db) {}

  /** Compute the same impact and complete fingerprint for preview and execution. */
  private async impact(tx: Prisma.TransactionClient, id: string) {
    const run = await tx.importRun.findUnique({ where: { id } });
    if (!run) throw new AppError('NOT_FOUND', 'Import nicht gefunden. Verlauf neu laden.', 404);
    if (run.source !== 'CSV' || !['COMPLETED', 'PARTIAL_SUCCESS'].includes(run.status))
      throw new AppError('IMPORT_STATE', 'Nur abgeschlossene CSV-Importe können zurückgenommen werden.', 409);
    const rows = await tx.transaction.findMany({
      where: { OR: [{ createdByImportRunId: id }, { identities: { some: { importRunId: id } } }] },
      include: { identities: { orderBy: { id: 'asc' } }, contractPayment: { include: { contract: true } } },
      orderBy: { id: 'asc' },
    });
    const groups = await tx.transferGroup.findMany({
      where: {
        id: {
          in: rows.flatMap(
            /** Include both transfer sides in the stale-preview guard. */ (row) =>
              row.transferGroupId ? [row.transferGroupId] : [],
          ),
        },
      },
      include: { transactions: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    });
    const items = rows.map(
      /** Decide source protection independently of the user's link policy. */ (row) => {
        const shared =
          row.identities.some(
            /** Foreign observations must outlive this rollback. */ (identity) =>
              identity.importRunId !== null && identity.importRunId !== id,
          ) ||
          (row.createdByImportRunId !== null && row.createdByImportRunId !== id);
        const uncertain =
          row.createdByImportRunId !== id ||
          row.identities.some(
            /** Unknown legacy evidence is never disposable. */ (identity) => identity.importRunId === null,
          );
        return {
          id: row.id,
          description: row.description,
          amountCents: String(row.amountCents),
          bookingDate: row.bookingDate.toISOString().slice(0, 10),
          protection: shared ? ('SHARED' as const) : uncertain ? ('UNCERTAIN' as const) : null,
          contractName: row.contractPayment?.contract.name ?? null,
          transfer: row.isTransfer || row.transferGroupId !== null,
          manual: row.categoryOrigin === 'MANUAL' || row.classification !== null,
        };
      },
    );
    const token = createHash('sha256')
      .update(
        JSON.stringify(
          { run, rows, groups },
          /** Serialize exact amounts only for the opaque in-memory fingerprint. */ (_key, value: unknown) =>
            typeof value === 'bigint' ? value.toString() : value,
        ),
      )
      .digest('hex');
    const owned = items.filter(
      /** Only unprotected rows are candidates for deletion. */ (item) => item.protection === null,
    );
    return {
      rows,
      items,
      preview: c.rollbackPreviewSchema.parse({
        runId: id,
        token,
        owned: owned.length,
        shared: items.filter(/** Count known other sources separately. */ (item) => item.protection === 'SHARED')
          .length,
        uncertain: items.filter(
          /** Explain missing origin instead of assuming ownership. */ (item) => item.protection === 'UNCERTAIN',
        ).length,
        linked: owned.filter(
          /** Link policy applies only to otherwise deletable rows. */ (item) =>
            item.contractName !== null || item.transfer,
        ).length,
        manual: owned.filter(/** Surface lost manual decisions before deletion. */ (item) => item.manual).length,
        items: items.slice(0, 100),
        truncated: items.length > 100,
      }),
    };
  }

  /** Return a consistent read-only preview, never claiming ownership from a filename. */
  async preview(id: string) {
    return this.db.$transaction(
      /** Bind all impact reads to one database snapshot. */ async (tx) => (await this.impact(tx, id)).preview,
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Revalidate a confirmed preview under locks before any deletion or unlinking. */
  async rollback(id: string, input: z.infer<typeof c.rollbackInputSchema>) {
    return this.db.$transaction(
      /** Preserve source/link invariants or roll everything back. */ async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ImportRun" WHERE id = ${id}::uuid FOR UPDATE`;
        const impact = await this.impact(tx, id);
        const accounts = [
          ...new Set(
            impact.rows.flatMap(
              /** Lock populated accounts in the same stable order as imports. */ (row) =>
                row.accountId ? [row.accountId] : [],
            ),
          ),
        ].sort();
        for (const account of accounts)
          await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${account}::uuid FOR UPDATE`;
        for (const row of impact.rows)
          await tx.$queryRaw`SELECT id FROM "Transaction" WHERE id = ${row.id}::uuid FOR UPDATE`;
        if (input.token !== impact.preview.token)
          throw new AppError(
            'ROLLBACK_STALE',
            'Buchungen wurden geändert. Vorschau neu laden und erneut bestätigen.',
            409,
          );
        if (input.linked === 'REMOVE' && impact.preview.linked && !input.confirmLinks)
          throw new AppError(
            'ROLLBACK_LINK_CONFIRMATION',
            'Entfernen der Vertrags- und Umbuchungszuordnungen ausdrücklich bestätigen.',
            422,
          );
        const ids = impact.items
          .filter(
            /** Protected rows remain under either policy. */ (item) =>
              !item.protection && (input.linked === 'REMOVE' || (!item.transfer && item.contractName === null)),
          )
          .map(/** Delete only the explicitly previewed identities. */ (item) => item.id);
        const groups = [
          ...new Set(
            impact.rows
              .filter(
                /** Only groups actually affected by deletion are dissolved. */ (row) =>
                  ids.includes(row.id) && row.transferGroupId,
              )
              .map(/** Group IDs were checked above. */ (row) => row.transferGroupId!),
          ),
        ];
        await tx.contractPayment.deleteMany({ where: { transactionId: { in: ids } } });
        await tx.transaction.updateMany({
          where: { transferGroupId: { in: groups } },
          data: { transferGroupId: null, isTransfer: false },
        });
        await tx.transferGroup.deleteMany({ where: { id: { in: groups } } });
        await tx.transaction.deleteMany({ where: { id: { in: ids } } });
        // Keep canonical references for retained rows; remove this run's redundant observations.
        await tx.transactionIdentity.deleteMany({ where: { importRunId: id, scope: { startsWith: 'source:' } } });
        await tx.transactionIdentity.updateMany({ where: { importRunId: id }, data: { importRunId: null } });
        await tx.importRun.delete({ where: { id } });
        return c.rollbackResultSchema.parse({ deleted: ids.length, retained: impact.rows.length - ids.length });
      },
      { isolationLevel: 'Serializable', timeout: 60000 },
    );
  }
}
