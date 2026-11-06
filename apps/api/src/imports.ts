import { Inject, Injectable } from '@nestjs/common';
import { csvPreviewInputSchema, csvPreviewSchema, issueSchema, runSchema } from '@financial-tracking/contracts';
import { z } from 'zod';
import type { Db } from './db.js';
import { previewCsv } from './csv.js';
import { AppError } from './errors.js';

/** Durable previews without raw uploaded files or bank credentials. */
@Injectable()
export class ImportService {
  /** Inject the shared PostgreSQL client. */
  constructor(@Inject('DB') readonly db: Db) {}

  /** Return credential-free import status. */
  async run(id: string) {
    const run = await this.db.importRun.findUnique({ where: { id } });
    if (!run) throw new AppError('NOT_FOUND', 'Import nicht gefunden.', 404);
    return runSchema.parse({
      ...run,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      challenge: null,
    });
  }

  /** Stage normalized rows and diagnostics without committing financial data. */
  async preview(input: z.infer<typeof csvPreviewInputSchema>) {
    const account = await this.db.account.findUnique({ where: { id: input.accountId } });
    if (!account || !account.isActive) throw new AppError('NOT_FOUND', 'Aktives Zielkonto nicht gefunden.', 404);
    const preview = previewCsv(account.id, input.content, input.delimiter, input.mapping);
    const run = await this.db.$transaction(
      /** Keep a preview and all its rows atomic. */ async (tx) => {
        const created = await tx.importRun.create({
          data: { bankConnectionId: account.bankConnectionId, source: 'CSV' },
        });
        for (let offset = 0; offset < preview.rows.length; offset += 500)
          await tx.stagedRow.createMany({
            data: preview.rows
              .slice(offset, offset + 500)
              .map(
                /** Store normalized data only. */ (row) => ({
                  runId: created.id,
                  accountId: account.id,
                  rowNumber: row.rowNumber,
                  data: row.data,
                }),
              ),
          });
        for (let offset = 0; offset < preview.issues.length; offset += 500)
          await tx.importIssue.createMany({
            data: preview.issues
              .slice(offset, offset + 500)
              .map(/** Record safe row diagnostics. */ (issue) => ({ ...issue, runId: created.id, candidateIds: [] })),
          });
        return created;
      },
      { timeout: 60000 },
    );
    return csvPreviewSchema.parse({
      run: await this.run(run.id),
      headers: preview.headers,
      rows: preview.rows.slice(0, 20).map(/** Bound preview response size. */ (row) => row.data),
      totalRows: preview.totalRows,
      invalidRows: preview.issues.length,
      issues: await this.issues(run.id),
    });
  }

  /** Read bounded unresolved diagnostics. */
  async issues(runId: string) {
    await this.run(runId);
    return z
      .array(issueSchema)
      .parse(
        await this.db.importIssue.findMany({
          where: { runId, resolved: false },
          orderBy: { rowNumber: 'asc' },
          take: 1000,
        }),
      );
  }

  /** Cancel a preview and remove its normalized temporary rows. */
  async cancel(id: string) {
    await this.db.$transaction(
      /** Claim the preview before deleting staged data. */ async (tx) => {
        const claimed = await tx.importRun.updateMany({
          where: { id, status: 'CREATED' },
          data: { status: 'CANCELLED', finishedAt: new Date() },
        });
        if (!claimed.count) throw new AppError('IMPORT_STATE', 'Import kann nicht abgebrochen werden.', 409);
        await tx.stagedRow.deleteMany({ where: { runId: id } });
      },
    );
    return this.run(id);
  }
}
