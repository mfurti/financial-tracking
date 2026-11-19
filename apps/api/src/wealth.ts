import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';
import { latestBookedAccounts } from './balance-observations.js';

/** A complete frozen database row, including optional surviving source account links. */
type RecordedRow = Prisma.WealthRecordGetPayload<{ include: { components: true } }>;
const recordedInclude = { components: { orderBy: { id: 'asc' as const } } };

/** Serialize frozen values without rereading current balances or renaming historical source labels. */
function publicRecord(record: RecordedRow) {
  return c.wealthRecordSchema.parse({
    ...record,
    recordedAt: record.recordedAt.toISOString(),
    totalCents: String(record.totalCents),
    components: record.components.map(
      /** Preserve missing source amount/time and signed integer-cent strings. */ (component) => ({
        ...component,
        amountCents: component.amountCents === null ? null : String(component.amountCents),
        observedAt: component.observedAt?.toISOString() ?? null,
      }),
    ),
  });
}

/** Capture explicitly requested observed wealth with immutable components and safe retry identities. */
@Injectable()
export class WealthService {
  /** Receive only the application-owned database; capture never opens a bank or broker connection. */
  constructor(@Inject('DB') readonly db: Db) {}

  /** Preview current active-account observations, keeping foreign currencies unknown instead of converting them. */
  private async preview(tx: Prisma.TransactionClient, now: Date) {
    const accounts = await latestBookedAccounts(tx, { isActive: true });
    const components = accounts.map(
      /** Freeze only observed EUR booked cents; every other source remains explicit. */ (account) => {
        const balance = account.currency === 'EUR' ? account.balances[0] : undefined;
        return {
          accountId: account.id,
          sourceLabel: account.name,
          currency: account.currency,
          amountCents: balance ? String(balance.amountCents) : null,
          observedAt: balance?.observedAt.toISOString() ?? null,
          sourceType:
            account.currency !== 'EUR' ? `UNSUPPORTED_CURRENCY:${account.currency}` : (balance?.source ?? 'MISSING'),
          stale: !!balance && now.getTime() - balance.observedAt.getTime() > 48 * 60 * 60 * 1000,
        };
      },
    );
    const known = components.filter(
      /** Observed zero and negative amounts are known, while nulls remain absent. */ (component) =>
        component.amountCents !== null,
    );
    const total = known.reduce(
      /** Keep aggregation exact even beyond one record's BIGINT storage range. */ (sum, component) =>
        sum + BigInt(component.amountCents!),
      0n,
    );
    const blockingReason = !components.length
      ? 'NO_ACCOUNTS'
      : !c.centsSchema.safeParse(String(total)).success
        ? 'TOTAL_OUT_OF_RANGE'
        : components.some(
              /** Never truncate original account names to fit new source metadata. */ (component) =>
                component.sourceLabel.length > 120,
            )
          ? 'SOURCE_LABEL_TOO_LONG'
          : components.some(
                /** Never truncate an original source type either. */ (component) => component.sourceType.length > 64,
              )
            ? 'SOURCE_TYPE_TOO_LONG'
            : components.some(
                  /** Empty labels/types cannot form a truthful frozen source identity. */ (component) =>
                    !component.sourceLabel.trim() || !component.sourceType.trim(),
                )
              ? 'SOURCE_METADATA_INVALID'
              : null;
    return c.wealthPreviewSchema.parse({
      asOf: now.toISOString(),
      provenance: 'OBSERVED_BOOKED_BALANCES',
      totalCents: known.length ? String(total) : null,
      coverage: components.length > 0 && known.length === components.length ? 'COMPLETE' : 'PARTIAL',
      componentCount: components.length,
      observedCount: known.length,
      recordable: blockingReason === null,
      blockingReason,
      components,
    });
  }

  /** Read a stable recorded-at/ID cursor page and a separately labeled current-source preview. */
  async list(input: z.infer<typeof c.wealthRecordsQuerySchema>, now = new Date()) {
    const query = c.wealthRecordsQuerySchema.parse(input);
    return this.db.$transaction(
      /** Page and preview share a consistent read snapshot without financial writes. */ async (tx) => {
        if (query.cursor && !(await tx.wealthRecord.findUnique({ where: { id: query.cursor }, select: { id: true } })))
          throw new AppError('INVALID_CURSOR', 'Aufzeichnung nicht gefunden. Verlauf neu laden.', 400);
        const rows = await tx.wealthRecord.findMany({
          include: recordedInclude,
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          take: query.limit + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        });
        const page = rows.slice(0, query.limit);
        return c.wealthRecordsSchema.parse({
          items: page.map(publicRecord),
          nextCursor: rows.length > query.limit ? page.at(-1)!.id : null,
          preview: await this.preview(tx, now),
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Capture server-derived components atomically; replays return the original record even after source changes. */
  async capture(input: z.infer<typeof c.wealthRecordInputSchema>, now = new Date()) {
    const value = c.wealthRecordInputSchema.parse(input);
    try {
      return await this.db.$transaction(
        /** Unique retry identity and frozen source components commit together. */ async (tx) => {
          const existing = await tx.wealthRecord.findUnique({
            where: { idempotencyKey: value.idempotencyKey },
            include: recordedInclude,
          });
          if (existing) return publicRecord(existing);
          const preview = await this.preview(tx, now);
          if (!preview.recordable)
            throw new AppError(
              'WEALTH_NOT_RECORDABLE',
              'Quellen können so nicht aufgezeichnet werden. Prüfe Kontonamen, EUR-Abdeckung und den zulässigen Gesamtbetrag.',
              422,
              { reason: preview.blockingReason },
            );
          const record = await tx.wealthRecord.create({
            data: {
              idempotencyKey: value.idempotencyKey,
              recordedAt: now,
              totalCents: BigInt(preview.totalCents ?? '0'),
              coverage: preview.coverage,
              components: {
                create: preview.components.map(
                  /** Copy server observations, never monetary request fields or current account references as values. */ (
                    component,
                  ) => ({
                    accountId: component.accountId,
                    sourceLabel: component.sourceLabel,
                    amountCents: component.amountCents === null ? null : BigInt(component.amountCents),
                    observedAt: component.observedAt ? new Date(component.observedAt) : null,
                    sourceType: component.sourceType,
                  }),
                ),
              },
            },
            include: recordedInclude,
          });
          return publicRecord(record);
        },
        { isolationLevel: 'RepeatableRead' },
      );
    } catch (cause) {
      if (cause && typeof cause === 'object' && 'code' in cause && (cause.code === 'P2002' || cause.code === 'P2034')) {
        const recorded = await this.db.wealthRecord.findUnique({
          where: { idempotencyKey: value.idempotencyKey },
          include: recordedInclude,
        });
        if (recorded) return publicRecord(recorded);
      }
      throw cause;
    }
  }
}
