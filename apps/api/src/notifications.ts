import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import type { Db } from './db.js';
import type { Prisma } from './generated/prisma/client.js';
import { AppError } from './errors.js';
import { berlinToday, contractOccurrences, isoDay } from './contract-schedule.js';

/** Derive bounded current-source events; acknowledgements never become financial source edits. */
@Injectable()
export class NotificationsService {
  /** Use private persistence only, without email, push or banking adapters. */
  constructor(@Inject('DB') readonly db: Db) {}

  /** Resolve the guarded singleton identity without accepting a client owner ID. */
  private async owner(tx: Prisma.TransactionClient, username: string | undefined) {
    if (!username) throw new AppError('UNAUTHENTICATED', 'Bitte anmelden.', 401);
    const user = await tx.user.findUnique({ where: { username }, select: { id: true, singleton: true } });
    if (!user || user.singleton !== 1) throw new AppError('UNAUTHENTICATED', 'Bitte anmelden.', 401);
    return user.id;
  }

  /** Build stable event identities from actual unresolved issues or dated effective contract revisions. */
  private async events(tx: Prisma.TransactionClient, now: Date) {
    const today = berlinToday(now),
      end = new Date(`${today}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 30);
    const to = isoDay(end);
    const [issues, contracts] = await Promise.all([
      tx.importIssue.findMany({
        where: { resolved: false, run: { status: { notIn: ['CANCELLED', 'ROLLED_BACK'] } } },
        include: { run: true },
        orderBy: { id: 'asc' },
        take: 10001,
      }),
      tx.contract.findMany({
        where: { startDate: { lte: new Date(to) }, OR: [{ endDate: null }, { endDate: { gte: new Date(today) } }] },
        include: {
          revisions: true,
          payments: {
            where: { dueDate: { gte: new Date(today), lte: new Date(to) } },
            include: { transaction: { select: { status: true } } },
          },
        },
        orderBy: { id: 'asc' },
        take: 10001,
      }),
    ]);
    if (issues.length > 10000 || contracts.length > 10000)
      throw new AppError('NOTIFICATIONS_TOO_LARGE', 'Zu viele Hinweise. Offene Importprobleme zuerst bearbeiten.', 413);
    const events: z.infer<typeof c.notificationSchema>[] = [];
    for (const issue of issues) {
      const revision = createHash('sha256')
        .update(
          JSON.stringify([
            issue.code,
            issue.message,
            issue.rowNumber,
            issue.resolutionHash,
            [...issue.candidateIds].sort(),
            issue.run.status,
            issue.run.finishedAt?.toISOString() ?? null,
          ]),
        )
        .digest('hex');
      events.push({
        sourceKey: `import:${issue.id}:${revision}`,
        kind: 'IMPORT_REVIEW',
        sourceLabel: `${issue.run.source}-Import`,
        occurredAt: (issue.run.finishedAt ?? issue.run.startedAt).toISOString(),
        dueDate: null,
        plannedCents: null,
        rowNumber: issue.rowNumber,
        href: `/imports?run=${issue.runId}`,
        acknowledgedAt: null,
      });
    }
    let dueCount = 0;
    for (const contract of contracts) {
      const paid = new Set(
        contract.payments
          .filter(
            /** Only a booked actual payment closes a due notice; pending remains an unconfirmed plan. */ (payment) =>
              payment.transaction.status === 'BOOKED',
          )
          .map(
            /** Match the original schedule date independently of actual booking date. */ (payment) =>
              isoDay(payment.dueDate),
          ),
      );
      for (const occurrence of contractOccurrences(contract, today, to)) {
        if (paid.has(occurrence.dueDate)) continue;
        if (++dueCount > 10000)
          throw new AppError('NOTIFICATIONS_TOO_LARGE', 'Zu viele bevorstehende Fälligkeiten.', 413);
        events.push({
          sourceKey: `contract:${contract.id}:${occurrence.revisionId}:${occurrence.dueDate}`,
          kind: 'CONTRACT_DUE',
          sourceLabel: contract.name,
          occurredAt: `${occurrence.dueDate}T00:00:00.000Z`,
          dueDate: occurrence.dueDate,
          plannedCents: String(occurrence.amountCents),
          rowNumber: null,
          href: `/contracts/${contract.id}`,
          acknowledgedAt: null,
        });
      }
    }
    return events.sort(
      /** Import reviews come first newest-first; upcoming plans retain earliest due date and stable identity ties. */ (
        a,
        b,
      ) =>
        a.kind !== b.kind
          ? a.kind === 'IMPORT_REVIEW'
            ? -1
            : 1
          : (a.kind === 'IMPORT_REVIEW'
              ? b.occurredAt.localeCompare(a.occurredAt)
              : a.occurredAt.localeCompare(b.occurredAt)) || a.sourceKey.localeCompare(b.sourceKey),
    );
  }

  /** Read one consistent current-source page, exact unread count and metadata acknowledgements. */
  async list(username: string | undefined, raw: z.infer<typeof c.notificationsQuerySchema>, now = new Date()) {
    const query = c.notificationsQuerySchema.parse(raw);
    return this.db.$transaction(
      /** Resolve source and acknowledgement state in the same repeatable read. */ async (tx) => {
        const userId = await this.owner(tx, username);
        const events = (await this.events(tx, now)).filter(
          /** Optional type scope never changes underlying financial sources. */ (event) =>
            !query.kind || event.kind === query.kind,
        );
        const acknowledgements = events.length
          ? await tx.notificationAcknowledgement.findMany({
              where: {
                userId,
                sourceKey: {
                  in: events.map(/** Query only actual current source identities. */ (event) => event.sourceKey),
                },
              },
            })
          : [];
        const read = new Map(
          acknowledgements.map(
            /** Keep the original acknowledgement timestamp across replays. */ (ack) => [
              ack.sourceKey,
              ack.acknowledgedAt.toISOString(),
            ],
          ),
        );
        const start = query.cursor
          ? events.findIndex(
              /** Cursors are actual current identities rather than arbitrary sort offsets. */ (event) =>
                event.sourceKey === query.cursor,
            )
          : -1;
        if (query.cursor && start < 0)
          throw new AppError('NOTIFICATION_PAGE_CHANGED', 'Hinweise haben sich geändert. Liste neu laden.', 400);
        const page = events.slice(start + 1, start + query.limit + 2);
        return c.notificationsSchema.parse({
          items: page.slice(0, query.limit).map(
            /** Enrich a bounded derived page with independent read metadata. */ (event) => ({
              ...event,
              acknowledgedAt: read.get(event.sourceKey) ?? null,
            }),
          ),
          nextCursor: page.length > query.limit ? page[query.limit - 1]!.sourceKey : null,
          unreadCount: events.length - read.size,
          asOf: now.toISOString(),
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Idempotently acknowledge a current key; replay remains valid after the original source disappears. */
  async acknowledge(
    username: string | undefined,
    raw: z.infer<typeof c.notificationAcknowledgementInputSchema>,
    now = new Date(),
  ) {
    const input = c.notificationAcknowledgementInputSchema.parse(raw);
    let userId: string | undefined;
    try {
      return await this.db.$transaction(
        /** Only acknowledgement metadata is written after source validation. */ async (tx) => {
          userId = await this.owner(tx, username);
          const existing = await tx.notificationAcknowledgement.findUnique({
            where: { userId_sourceKey: { userId, sourceKey: input.sourceKey } },
          });
          if (existing)
            return c.notificationAcknowledgementSchema.parse({
              ...existing,
              acknowledgedAt: existing.acknowledgedAt.toISOString(),
            });
          if (
            !(await this.events(tx, now)).some(
              /** Unknown/deleted/revised keys cannot create phantom acknowledgement rows. */ (event) =>
                event.sourceKey === input.sourceKey,
            )
          )
            throw new AppError('NOTIFICATION_CHANGED', 'Dieser Hinweis ist nicht mehr aktuell. Liste neu laden.', 409);
          const saved = await tx.notificationAcknowledgement.create({
            data: { userId, sourceKey: input.sourceKey, acknowledgedAt: now },
          });
          return c.notificationAcknowledgementSchema.parse({
            ...saved,
            acknowledgedAt: saved.acknowledgedAt.toISOString(),
          });
        },
        { isolationLevel: 'RepeatableRead' },
      );
    } catch (caught) {
      if (
        userId &&
        caught &&
        typeof caught === 'object' &&
        'code' in caught &&
        ['P2002', 'P2034'].includes(String(caught.code))
      ) {
        const existing = await this.db.notificationAcknowledgement.findUnique({
          where: { userId_sourceKey: { userId, sourceKey: input.sourceKey } },
        });
        if (existing)
          return c.notificationAcknowledgementSchema.parse({
            ...existing,
            acknowledgedAt: existing.acknowledgedAt.toISOString(),
          });
      }
      throw caught;
    }
  }
}
