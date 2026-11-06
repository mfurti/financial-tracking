import { Inject, Injectable } from '@nestjs/common';
import { csvPreviewInputSchema, csvPreviewSchema, issueSchema, runSchema } from '@financial-tracking/contracts';
import { z } from 'zod';
import type { Db } from './db.js';
import { previewCsv, normalizedSchema, type NormalizedRow } from './csv.js';
import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';
import { publicTransaction } from './ledger.js';

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
            data: preview.rows.slice(offset, offset + 500).map(
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
    const issues = await this.db.importIssue.findMany({
      where: { runId, resolved: false },
      include: { stagedRow: true },
      orderBy: { rowNumber: 'asc' },
      take: 1000,
    });
    const candidates = await this.db.transaction.findMany({
      where: { id: { in: issues.flatMap(/** Collect offered candidate IDs only. */ (issue) => issue.candidateIds) } },
    });
    return z.array(issueSchema).parse(
      issues.map(
        /** Supply enough context for an informed review. */ (issue) => ({
          ...issue,
          incoming: issue.stagedRow ? normalizedSchema.parse(issue.stagedRow.data) : null,
          candidates: candidates
            .filter(
              /** Restrict records to this row's candidates. */ (candidate) =>
                issue.candidateIds.includes(candidate.id),
            )
            .map(publicTransaction),
        }),
      ),
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

  /** Resolve an identity inside the caller's locked account transaction. */
  private async ingest(
    tx: Prisma.TransactionClient,
    runId: string,
    staged: { id: string; rowNumber: number; data: unknown },
    forceNew = false,
  ) {
    const row = normalizedSchema.parse(staged.data);
    const identityWhere = {
      accountId_identityType_identityValue: {
        accountId: row.accountId,
        identityType: row.identityType,
        identityValue: row.identityValue,
      },
    };
    const exact = await tx.transactionIdentity.findUnique({ where: identityWhere, include: { transaction: true } });
    if (
      exact &&
      row.identityType === 'BANK_REFERENCE' &&
      exact.transaction.status === 'PENDING' &&
      row.status === 'BOOKED' &&
      exact.transaction.amountCents === BigInt(row.amountCents)
    ) {
      await tx.transaction.update({
        where: { id: exact.transactionId },
        data: {
          status: 'BOOKED',
          bookingDate: new Date(row.bookingDate),
          valueDate: row.valueDate ? new Date(row.valueDate) : null,
        },
      });
      await tx.stagedRow.delete({ where: { id: staged.id } });
      return 'KNOWN' as const;
    }
    if (
      exact &&
      exact.transaction.amountCents === BigInt(row.amountCents) &&
      exact.transaction.bookingDate.toISOString().slice(0, 10) === row.bookingDate &&
      exact.transaction.status === row.status
    ) {
      await tx.stagedRow.delete({ where: { id: staged.id } });
      return 'KNOWN' as const;
    }
    const candidates = exact
      ? [exact.transaction]
      : await tx.transaction.findMany({
          where: {
            accountId: row.accountId,
            amountCents: BigInt(row.amountCents),
            bookingDate: new Date(row.bookingDate),
            description: row.description,
            counterpartyName: row.counterpartyName,
          },
          take: 10,
        });
    if (!forceNew && candidates.length) {
      await tx.importIssue.create({
        data: {
          runId,
          stagedRowId: staged.id,
          rowNumber: staged.rowNumber,
          code: exact ? 'SOURCE_CHANGED' : 'REVIEW_REQUIRED',
          message: exact
            ? 'Bekannte Referenz mit geänderten Buchungsdaten. Bitte prüfen.'
            : 'Mögliche Dublette. Neue Buchung, bekannte Buchung oder überspringen wählen.',
          candidateIds: candidates.map(
            /** Restrict choices to this account's actual candidates. */ (candidate) => candidate.id,
          ),
        },
      });
      return 'REVIEW' as const;
    }
    if (exact)
      throw new AppError('IDENTITY_CONFLICT', 'Eindeutige Bankreferenz kann nicht doppelt vergeben werden.', 409);
    await tx.transaction.create({
      data: {
        accountId: row.accountId,
        amountCents: BigInt(row.amountCents),
        bookingDate: new Date(row.bookingDate),
        valueDate: row.valueDate ? new Date(row.valueDate) : null,
        description: row.description,
        counterpartyName: row.counterpartyName,
        counterpartyIban: row.counterpartyIban,
        currency: row.currency,
        status: row.status,
        identities: {
          create: { accountId: row.accountId, identityType: row.identityType, identityValue: row.identityValue },
        },
      },
    });
    await tx.stagedRow.delete({ where: { id: staged.id } });
    return 'NEW' as const;
  }

  /** Commit a confirmed preview atomically; account locks serialize overlapping sources. */
  async commit(id: string, allowPartial: boolean) {
    await this.db.$transaction(
      /** Claim the preview and all affected accounts before reconciliation. */ async (tx) => {
        const claimed = await tx.importRun.updateMany({
          where: { id, source: 'CSV', status: 'CREATED' },
          data: { status: 'COMMITTING' },
        });
        if (!claimed.count) throw new AppError('IMPORT_STATE', 'Vorschau wurde bereits verarbeitet.', 409);
        const invalid = await tx.importIssue.count({ where: { runId: id, code: 'CSV_INVALID_ROW' } });
        if (invalid && !allowPartial)
          throw new AppError(
            'PARTIAL_CONFIRMATION_REQUIRED',
            'Fehlerhafte Zeilen vorhanden. Teilimport ausdrücklich bestätigen.',
            422,
          );
        const rows = await tx.stagedRow.findMany({ where: { runId: id }, orderBy: { rowNumber: 'asc' } });
        const accounts = [
          ...new Set(rows.map(/** Establish a stable account-lock order. */ (row) => row.accountId)),
        ].sort();
        for (const accountId of accounts)
          await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId}::uuid FOR UPDATE`;
        let imported = 0,
          known = 0,
          review = 0;
        for (const row of rows) {
          const result = await this.ingest(tx, id, row);
          if (result === 'NEW') imported++;
          else if (result === 'KNOWN') known++;
          else review++;
        }
        await tx.importRun.update({
          where: { id },
          data: {
            status: invalid ? 'PARTIAL_SUCCESS' : 'COMPLETED',
            importedCount: imported,
            knownCount: known,
            reviewRequiredCount: review,
            finishedAt: new Date(),
          },
        });
      },
      { timeout: 120000 },
    );
    return this.run(id);
  }

  /** Resolve one ambiguous row without overwriting user annotations. */
  async resolve(
    id: string,
    resolutions: { issueId: string; action: 'NEW' | 'MATCH' | 'SKIP'; transactionId?: string }[],
  ) {
    await this.db.$transaction(
      /** Claim each unresolved issue before applying a decision. */ async (tx) => {
        for (const resolution of resolutions) {
          const issue = await tx.importIssue.findFirst({
            where: { id: resolution.issueId, runId: id, resolved: false },
            include: { stagedRow: true },
          });
          if (!issue?.stagedRow)
            throw new AppError('REVIEW_STATE', 'Prüfung bereits erledigt oder nicht gefunden.', 409);
          const claimed = await tx.importIssue.updateMany({
            where: { id: issue.id, resolved: false },
            data: { resolved: true },
          });
          if (!claimed.count) throw new AppError('REVIEW_STATE', 'Prüfung bereits erledigt.', 409);
          const row = normalizedSchema.parse(issue.stagedRow.data);
          await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${row.accountId}::uuid FOR UPDATE`;
          if (resolution.action === 'NEW') {
            await this.ingest(tx, id, issue.stagedRow, true);
            await tx.importRun.update({ where: { id }, data: { importedCount: { increment: 1 } } });
          } else if (resolution.action === 'MATCH') {
            if (!resolution.transactionId || !issue.candidateIds.includes(resolution.transactionId))
              throw new AppError('INVALID_MATCH', 'Nur angebotene Kandidaten können gewählt werden.');
            const candidate = await tx.transaction.findUniqueOrThrow({ where: { id: resolution.transactionId } });
            if (
              candidate.accountId !== row.accountId ||
              candidate.amountCents !== BigInt(row.amountCents) ||
              candidate.bookingDate.toISOString().slice(0, 10) !== row.bookingDate ||
              candidate.status !== row.status
            )
              throw new AppError(
                'MATCH_CONFLICT',
                'Abweichende Buchungsdaten können nicht zusammengeführt werden. Überspringen oder gesondert prüfen.',
              );
            await tx.transactionIdentity.create({
              data: {
                accountId: row.accountId,
                identityType: row.identityType,
                identityValue: row.identityValue,
                transactionId: candidate.id,
              },
            });
            await tx.stagedRow.delete({ where: { id: issue.stagedRow.id } });
            await tx.importRun.update({ where: { id }, data: { knownCount: { increment: 1 } } });
          } else await tx.stagedRow.delete({ where: { id: issue.stagedRow.id } });
          await tx.importRun.update({ where: { id }, data: { reviewRequiredCount: { decrement: 1 } } });
        }
      },
      { timeout: 60000 },
    );
    return this.run(id);
  }

  /** Stage and commit a fully retrieved bank account with its authoritative balance. */
  async bankAccount(
    runId: string,
    connectionId: string,
    account: {
      reference: string;
      name: string;
      iban: string | null;
      balanceCents: string;
      observedAt: string;
      rows: Omit<NormalizedRow, 'accountId'>[];
    },
    toDate: string,
  ) {
    await this.db.$transaction(
      /** No network calls occur while account data is locked. */ async (tx) => {
        const conflictingAccount = account.iban
          ? await tx.account.findFirst({ where: { iban: account.iban, bankConnectionId: { not: connectionId } } })
          : null;
        if (conflictingAccount)
          throw new AppError(
            'ACCOUNT_MAPPING_REQUIRED',
            'Vorhandenes CSV-Konto zuerst ausdrücklich dieser Bankverbindung zuordnen.',
            409,
          );
        const current = await tx.account.upsert({
          where: {
            bankConnectionId_bankAccountReference: {
              bankConnectionId: connectionId,
              bankAccountReference: account.reference,
            },
          },
          create: {
            bankConnectionId: connectionId,
            bankAccountReference: account.reference,
            name: account.name,
            iban: account.iban,
          },
          update: {},
        });
        await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${current.id}::uuid FOR UPDATE`;
        let imported = 0,
          known = 0,
          review = 0;
        for (const [index, input] of account.rows.entries()) {
          const data = normalizedSchema.parse({ ...input, accountId: current.id });
          const staged = await tx.stagedRow.create({
            data: { runId, accountId: current.id, rowNumber: index + 1, data },
          });
          const result = await this.ingest(tx, runId, staged);
          if (result === 'NEW') imported++;
          else if (result === 'KNOWN') known++;
          else review++;
        }
        await tx.balanceSnapshot.create({
          data: {
            accountId: current.id,
            importRunId: runId,
            amountCents: BigInt(account.balanceCents),
            balanceType: 'BOOKED',
            observedAt: new Date(account.observedAt),
            source: 'FINTS',
          },
        });
        await tx.account.update({
          where: { id: current.id },
          data: { cursorDate: new Date(toDate), lastSuccessfulSyncAt: new Date() },
        });
        await tx.importRun.update({
          where: { id: runId },
          data: {
            importedCount: { increment: imported },
            knownCount: { increment: known },
            reviewRequiredCount: { increment: review },
          },
        });
      },
      { timeout: 120000 },
    );
  }
}
