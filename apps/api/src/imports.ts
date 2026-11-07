import { Inject, Injectable } from '@nestjs/common';
import {
  csvPreviewInputSchema,
  csvPreviewSchema,
  issueSchema,
  runSchema,
  resolutionSchema,
} from '@financial-tracking/contracts';
import { z } from 'zod';
import type { Db } from './db.js';
import { previewCsv, normalizedSchema, type NormalizedRow } from './csv.js';
import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';
import { publicTransaction } from './ledger.js';
import { createHash } from 'node:crypto';
import { assertTransferPlacement, linkAccountIdentities } from './transaction-invariants.js';

/** Account-scoped verified identities never rely on nullable-key uniqueness. */
export function identityScope(accountId: string | null, runId: string) {
  return accountId ? `account:${accountId}` : `import:${runId}`;
}

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
    const account = input.accountId ? await this.db.account.findUnique({ where: { id: input.accountId } }) : null;
    if (input.accountId && (!account || !account.isActive))
      throw new AppError('NOT_FOUND', 'Aktives Zielkonto nicht gefunden.', 404);
    const preview = previewCsv(account?.id ?? null, input.content, input.delimiter, input.mapping);
    const run = await this.db.$transaction(
      /** Keep a preview and all its rows atomic. */ async (tx) => {
        const created = await tx.importRun.create({
          data: { bankConnectionId: account?.bankConnectionId ?? null, source: 'CSV' },
        });
        for (let offset = 0; offset < preview.rows.length; offset += 500)
          await tx.stagedRow.createMany({
            data: preview.rows.slice(offset, offset + 500).map(
              /** Store normalized data only. */ (row) => ({
                runId: created.id,
                accountId: account?.id ?? null,
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
    let from: string | null = null,
      to: string | null = null;
    for (const row of preview.rows) {
      const date = row.data.bookingDate;
      if (!from || date < from) from = date;
      if (!to || date > to) to = date;
    }
    return csvPreviewSchema.parse({
      run: await this.run(run.id),
      headers: preview.headers,
      rows: preview.rows.slice(0, 20).map(/** Bound preview response size. */ (row) => row.data),
      totalRows: preview.totalRows,
      invalidRows: preview.issues.length,
      period: from && to ? { from, to } : null,
      issues: await this.issues(run.id),
    });
  }

  /** Read a bounded window with actionable reviews before non-actionable diagnostics. */
  async issues(runId: string) {
    const run = await this.run(runId);
    const reviews = await this.db.importIssue.findMany({
      where: { runId, resolved: false, stagedRowId: { not: null } },
      include: { stagedRow: true },
      orderBy: [{ rowNumber: 'asc' }, { id: 'asc' }],
      take: 1000,
    });
    const diagnostics =
      reviews.length < 1000
        ? await this.db.importIssue.findMany({
            where: { runId, resolved: false, stagedRowId: null },
            include: { stagedRow: true },
            orderBy: [{ rowNumber: 'asc' }, { id: 'asc' }],
            take: 1000 - reviews.length,
          })
        : [];
    const issues = [...reviews, ...diagnostics];
    const candidates = await this.db.transaction.findMany({
      where: { id: { in: issues.flatMap(/** Collect offered candidate IDs only. */ (issue) => issue.candidateIds) } },
      include: { identities: { include: { importRun: { select: { source: true } } } } },
    });
    return z.array(issueSchema).parse(
      issues.map(
        /** Supply enough context for an informed review. */ (issue) => ({
          ...issue,
          incoming: issue.stagedRow ? normalizedSchema.parse(issue.stagedRow.data) : null,
          incomingSource: run.source,
          incomingReference: issue.stagedRow ? normalizedSchema.parse(issue.stagedRow.data).reference : null,
          candidates: candidates
            .filter(
              /** Restrict records to this row's candidates. */ (candidate) =>
                issue.candidateIds.includes(candidate.id),
            )
            .map(publicTransaction),
          candidateVersions: Object.fromEntries(
            candidates
              .filter(
                /** Restrict optimistic versions to offered candidates. */ (row) => issue.candidateIds.includes(row.id),
              )
              .map(
                /** Expose no mutable financial values in a concurrency token. */ (row) => [
                  row.id,
                  row.updatedAt.toISOString(),
                ],
              ),
          ),
          candidateSources: Object.fromEntries(
            candidates
              .filter(
                /** Only disclose provenance for offered target records. */ (row) =>
                  issue.candidateIds.includes(row.id),
              )
              .map(
                /** Distinguish source observations from legacy records with unknown origin. */ (row) => [
                  row.id,
                  [
                    ...new Set(
                      row.identities.map(
                        /** Do not infer a bank source from a reference alone. */ (identity) =>
                          identity.importRun?.source ?? 'LEGACY',
                      ),
                    ),
                  ],
                ],
              ),
          ),
          candidateReferences: Object.fromEntries(
            candidates
              .filter(
                /** Restrict reference details to offered targets. */ (row) => issue.candidateIds.includes(row.id),
              )
              .map(
                /** Repeated observations do not need repeated labels. */ (row) => [
                  row.id,
                  [
                    ...new Set(
                      row.identities
                        .filter(
                          /** Opaque file fingerprints are not bank references. */ (identity) =>
                            identity.identityType === 'BANK_REFERENCE',
                        )
                        .map(/** Preserve exact source-reference text. */ (identity) => identity.identityValue),
                    ),
                  ],
                ],
              ),
          ),
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
    const scope = identityScope(row.accountId, runId);
    const identityWhere = {
      scope_identityType_identityValue: {
        scope,
        identityType: row.identityType,
        identityValue: row.identityValue,
      },
    };
    const exact = await tx.transactionIdentity.findUnique({ where: identityWhere, include: { transaction: true } });
    if (
      !forceNew &&
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
      await this.observe(tx, runId, row, exact.transactionId);
      return 'KNOWN' as const;
    }
    if (
      !forceNew &&
      exact &&
      exact.transaction.amountCents === BigInt(row.amountCents) &&
      exact.transaction.bookingDate.toISOString().slice(0, 10) === row.bookingDate &&
      exact.transaction.status === row.status &&
      (exact.transaction.valueDate?.toISOString().slice(0, 10) ?? null) === row.valueDate &&
      exact.transaction.description === row.description &&
      exact.transaction.counterpartyName === row.counterpartyName &&
      exact.transaction.counterpartyIban === row.counterpartyIban
    ) {
      await tx.stagedRow.delete({ where: { id: staged.id } });
      await this.observe(tx, runId, row, exact.transactionId);
      return 'KNOWN' as const;
    }
    const candidates = exact
      ? [exact.transaction]
      : await tx.transaction.findMany({
          where: {
            AND: row.accountId ? [{ OR: [{ accountId: row.accountId }, { accountId: null }] }] : undefined,
            OR: [
              {
                amountCents: BigInt(row.amountCents),
                bookingDate: new Date(row.bookingDate),
                description: row.description,
                counterpartyName: row.counterpartyName,
              },
              { identities: { some: { identityType: row.identityType, identityValue: row.identityValue } } },
            ],
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
    if (exact && !forceNew)
      throw new AppError('IDENTITY_CONFLICT', 'Eindeutige Bankreferenz kann nicht doppelt vergeben werden.', 409);
    const created = await tx.transaction.create({
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
          create: {
            scope: forceNew && exact ? `review:${staged.id}` : scope,
            importRunId: runId,
            accountId: row.accountId,
            identityType: row.identityType,
            identityValue: row.identityValue,
          },
        },
      },
    });
    if (!forceNew) await this.observe(tx, runId, row, created.id);
    await tx.stagedRow.delete({ where: { id: staged.id } });
    return 'NEW' as const;
  }

  /** Preserve each account's source-run observation without replacing its original identity. */
  private async observe(tx: Prisma.TransactionClient, runId: string, row: NormalizedRow, transactionId: string) {
    if (!row.accountId) return;
    const key = {
      scope: `source:${runId}:${row.accountId}`,
      identityType: row.identityType,
      identityValue: row.identityValue,
    };
    await tx.transactionIdentity.upsert({
      where: { scope_identityType_identityValue: key },
      create: { ...key, importRunId: runId, accountId: row.accountId, transactionId },
      update: {},
    });
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
          ...new Set(
            rows
              .map(/** Establish a stable account-lock order. */ (row) => row.accountId)
              .filter(/** Unassigned imports use a separate shared lock. */ (id): id is string => id !== null),
          ),
        ].sort();
        if (
          rows.some(
            /** Protect duplicate review across concurrent unassigned imports. */ (row) => row.accountId === null,
          )
        )
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817833)::text`;
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
  async resolve(id: string, resolutions: z.infer<typeof resolutionSchema>['resolutions']) {
    await this.db.$transaction(
      /** Claim each unresolved issue before applying a decision. */ async (tx) => {
        for (const resolution of resolutions) {
          const resolutionHash = createHash('sha256').update(JSON.stringify(resolution)).digest('hex');
          const issue = await tx.importIssue.findFirst({
            where: { id: resolution.issueId, runId: id },
            include: { stagedRow: true },
          });
          if (issue?.resolved) {
            if (issue.resolutionHash === resolutionHash) continue;
            throw new AppError('REVIEW_STATE', 'Prüfung bereits mit anderer Entscheidung erledigt.', 409);
          }
          if (!issue?.stagedRow)
            throw new AppError('REVIEW_STATE', 'Prüfung bereits erledigt oder nicht gefunden.', 409);
          const claimed = await tx.importIssue.updateMany({
            where: { id: issue.id, resolved: false },
            data: { resolved: true, resolutionHash },
          });
          if (!claimed.count) throw new AppError('REVIEW_STATE', 'Prüfung bereits erledigt.', 409);
          const row = normalizedSchema.parse(issue.stagedRow.data);
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(16817833)::text`;
          if (row.accountId)
            await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${row.accountId}::uuid FOR UPDATE`;
          if (resolution.action === 'NEW') {
            await this.ingest(tx, id, issue.stagedRow, true);
            await tx.importRun.update({ where: { id }, data: { importedCount: { increment: 1 } } });
          } else if (['MATCH', 'EXISTING', 'INCOMING'].includes(resolution.action)) {
            if (!resolution.transactionId || !issue.candidateIds.includes(resolution.transactionId))
              throw new AppError('INVALID_MATCH', 'Nur angebotene Kandidaten können gewählt werden.');
            await tx.$queryRaw`SELECT "id" FROM "Transaction" WHERE "id" = ${resolution.transactionId}::uuid FOR UPDATE`;
            const candidate = await tx.transaction.findUniqueOrThrow({ where: { id: resolution.transactionId } });
            if (row.accountId && candidate.accountId && candidate.accountId !== row.accountId)
              throw new AppError('MATCH_CONFLICT', 'Konto des angebotenen Treffers wurde geändert.', 409);
            const targetAccount = row.accountId ?? candidate.accountId;
            if (resolution.action !== 'MATCH' && resolution.candidateVersion !== candidate.updatedAt.toISOString())
              throw new AppError('REVIEW_STALE', 'Treffer wurde geändert. Vergleich neu laden.', 409);
            if (
              resolution.action === 'MATCH' &&
              (candidate.amountCents !== BigInt(row.amountCents) ||
                candidate.bookingDate.toISOString().slice(0, 10) !== row.bookingDate ||
                candidate.status !== row.status)
            )
              throw new AppError(
                'MATCH_CONFLICT',
                'Abweichende Buchungsdaten können nicht zusammengeführt werden. Überspringen oder gesondert prüfen.',
              );
            await assertTransferPlacement(
              tx,
              candidate.transferGroupId,
              [candidate.id],
              targetAccount,
              resolution.action === 'INCOMING' ? BigInt(row.amountCents) : candidate.amountCents,
            );
            if (resolution.action === 'INCOMING') {
              await tx.transaction.update({
                where: { id: candidate.id },
                data: {
                  amountCents: BigInt(row.amountCents),
                  bookingDate: new Date(row.bookingDate),
                  valueDate: row.valueDate ? new Date(row.valueDate) : null,
                  description: row.description,
                  counterpartyName: row.counterpartyName,
                  counterpartyIban: row.counterpartyIban,
                  status: row.status,
                },
              });
            }
            if (candidate.accountId !== targetAccount) {
              await tx.transaction.update({ where: { id: candidate.id }, data: { accountId: targetAccount } });
              await tx.transactionIdentity.updateMany({
                where: { transactionId: candidate.id },
                data: { accountId: targetAccount },
              });
            }
            const key = {
              scope: identityScope(row.accountId, id),
              identityType: row.identityType,
              identityValue: row.identityValue,
            };
            const previous = await tx.transactionIdentity.findUnique({
              where: { scope_identityType_identityValue: key },
            });
            if (previous && previous.transactionId !== candidate.id)
              throw new AppError(
                'IDENTITY_CONFLICT',
                'Quellreferenz gehört bereits zu einer anderen Buchung. Separat behalten oder prüfen.',
                409,
              );
            await tx.transactionIdentity.upsert({
              where: { scope_identityType_identityValue: key },
              create: { ...key, importRunId: id, accountId: targetAccount, transactionId: candidate.id },
              update: {},
            });
            await this.observe(tx, id, { ...row, accountId: targetAccount }, candidate.id);
            await linkAccountIdentities(tx, targetAccount, candidate.id, [
              {
                identityType: row.identityType,
                identityValue: row.identityValue,
                importRunId: id,
              },
            ]);
            await tx.stagedRow.delete({ where: { id: issue.stagedRow.id } });
            await tx.importRun.update({ where: { id }, data: { knownCount: { increment: 1 } } });
          } else await tx.stagedRow.delete({ where: { id: issue.stagedRow.id } });
          await tx.importRun.update({ where: { id }, data: { reviewRequiredCount: { decrement: 1 } } });
        }
      },
      { timeout: 60000, isolationLevel: 'Serializable' },
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
    leaseUntil: Date,
  ) {
    await this.db.$transaction(
      /** No network calls occur while account data is locked. */ async (tx) => {
        const owned = await tx.bankConnection.updateMany({
          where: { id: connectionId, leaseUntil: { equals: leaseUntil, gt: new Date() } },
          data: { leaseUntil },
        });
        if (!owned.count) throw new AppError('SYNC_LEASE_LOST', 'Abruf besitzt keine gültige Sperre mehr.', 409);
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
