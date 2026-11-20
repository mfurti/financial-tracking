import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase } from './database.js';
import { NotificationsService } from '../apps/api/src/notifications.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import * as c from '../packages/contracts/src/index.js';

describe('source-derived private in-app notifications', /** Only acknowledgements persist; source events remain current financial/import projections. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>, service: NotificationsService;
  let runId: string, issueId: string, contractId: string;
  const now = new Date('2035-01-30T23:30:00.000Z');
  beforeAll(
    /** Own unresolved/resolved/canceled issues and month-end booked/pending/unknown payment fixtures. */ async () => {
      resource = await testDatabase();
      service = new NotificationsService(resource.db);
      const db = resource.db;
      await db.user.create({
        data: { username: 'notifications', passwordHash: await passwordHash('notifications-test-password') },
      });
      const run = await db.importRun.create({
        data: {
          source: 'CSV',
          status: 'PARTIAL_SUCCESS',
          reviewRequiredCount: 3,
          finishedAt: new Date('2035-01-30T12:00:00Z'),
        },
      });
      runId = run.id;
      const issues = await Promise.all(
        [1, 2, 3].map(
          /** Each issue has a real independent source identity. */ (rowNumber) =>
            db.importIssue.create({
              data: { runId, rowNumber, code: 'REVIEW_REQUIRED', message: 'Synthetic issue', candidateIds: [] },
            }),
        ),
      );
      issueId = issues[0]!.id;
      await db.importIssue.create({
        data: { runId, code: 'RESOLVED', message: 'Closed', candidateIds: [], resolved: true },
      });
      const canceled = await db.importRun.create({ data: { source: 'CSV', status: 'CANCELLED' } });
      await db.importIssue.create({
        data: { runId: canceled.id, code: 'CANCELED', message: 'Not actionable', candidateIds: [] },
      });
      const plan = await db.contract.create({
        data: {
          name: 'Month-end unknown payment',
          provider: 'Fixture',
          kind: 'OTHER',
          startDate: new Date('2035-01-31'),
          revisions: { create: { amountCents: 1000n, intervalMonths: 1, effectiveDate: new Date('2035-01-31') } },
        },
      });
      contractId = plan.id;
      for (const status of ['BOOKED', 'PENDING']) {
        const contract = await db.contract.create({
          data: {
            name: `${status} source`,
            provider: 'Fixture',
            kind: 'OTHER',
            startDate: new Date('2035-01-31'),
            revisions: { create: { amountCents: 2000n, intervalMonths: 1, effectiveDate: new Date('2035-01-31') } },
          },
          include: { revisions: true },
        });
        const transaction = await db.transaction.create({
          data: {
            amountCents: -2000n,
            bookingDate: new Date('2035-01-30'),
            description: `${status} linked source`,
            status,
          },
        });
        await db.contractPayment.create({
          data: {
            contractId: contract.id,
            revisionId: contract.revisions[0]!.id,
            transactionId: transaction.id,
            dueDate: new Date('2035-01-31'),
            source: 'MANUAL',
          },
        });
      }
      await db.contract.create({
        data: {
          name: 'Ended source',
          provider: 'Fixture',
          kind: 'OTHER',
          startDate: new Date('2034-01-01'),
          endDate: new Date('2034-12-31'),
          revisions: { create: { amountCents: 1000n, intervalMonths: 1, effectiveDate: new Date('2034-01-01') } },
        },
      });
    },
  );
  afterAll(/** Release only owned fixture resources. */ async () => resource?.close());

  it('derives stable bounded pages and planned-versus-booked semantics without a read backfill', /** Berlin midnight, month-end recurrence and pending actuals cannot fabricate paid status. */ async () => {
    const all = await service.list('notifications', c.notificationsQuerySchema.parse({ limit: 100 }), now);
    expect(
      all.items.filter(
        /** Count only genuinely unresolved actionable source issues. */ (item) => item.kind === 'IMPORT_REVIEW',
      ),
    ).toHaveLength(3);
    const due = all.items.filter(
      /** Planned events remain separately typed and valued. */ (item) => item.kind === 'CONTRACT_DUE',
    );
    expect(due).toHaveLength(5);
    expect(
      due.some(
        /** A booked linked due date is closed without changing its actual booking. */ (item) =>
          item.sourceLabel === 'BOOKED source' && item.dueDate === '2035-01-31',
      ),
    ).toBe(false);
    expect(
      due.some(
        /** Pending is still unconfirmed rather than a paid plan. */ (item) =>
          item.sourceLabel === 'PENDING source' && item.dueDate === '2035-01-31',
      ),
    ).toBe(true);
    expect(
      due.find(
        /** February clamps to month end using existing schedule logic. */ (item) =>
          item.sourceLabel === 'Month-end unknown payment' && item.dueDate === '2035-02-28',
      )?.plannedCents,
    ).toBe('1000');
    expect(all.unreadCount).toBe(8);
    expect(await resource.db.notificationAcknowledgement.count()).toBe(0);
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await service.list('notifications', c.notificationsQuerySchema.parse({ limit: 2, cursor }), now);
      ids.push(
        ...page.items.map(
          /** Retain each actual source identity across stable page boundaries. */ (item) => item.sourceKey,
        ),
      );
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(ids).toEqual(
      all.items.map(/** Stable paging neither duplicates nor skips current events. */ (item) => item.sourceKey),
    );
    expect(new Set(ids).size).toBe(8);
    const imports = await service.list(
      'notifications',
      c.notificationsQuerySchema.parse({ kind: 'IMPORT_REVIEW' }),
      now,
    );
    expect(
      imports.items.every(
        /** Type filtering cannot introduce plans into import views. */ (item) => item.kind === 'IMPORT_REVIEW',
      ),
    ).toBe(true);
    expect(imports.items[0]!.href).toBe(`/imports?run=${runId}`);
  });

  it('idempotently acknowledges concurrent/repeated keys while preserving every source field', /** Acknowledgements never resolve issues, link payments, change plans or mutate transactions. */ async () => {
    const before = {
      run: await resource.db.importRun.findMany({ orderBy: { id: 'asc' } }),
      issues: await resource.db.importIssue.findMany({ orderBy: { id: 'asc' } }),
      contracts: await resource.db.contract.findMany({ orderBy: { id: 'asc' } }),
      revisions: await resource.db.contractRevision.findMany({ orderBy: { id: 'asc' } }),
      payments: await resource.db.contractPayment.findMany({ orderBy: { id: 'asc' } }),
      transactions: await resource.db.transaction.findMany({ orderBy: { id: 'asc' } }),
    };
    const item = (await service.list('notifications', c.notificationsQuerySchema.parse({}), now)).items.find(
      /** Select the exact import source whose revision changes later. */ (item) =>
        item.sourceKey.startsWith(`import:${issueId}:`),
    )!;
    const saved = await Promise.all([
      service.acknowledge('notifications', { sourceKey: item.sourceKey }, now),
      service.acknowledge('notifications', { sourceKey: item.sourceKey }, now),
    ]);
    expect(saved[0]).toEqual(saved[1]);
    expect(await service.acknowledge('notifications', { sourceKey: item.sourceKey }, new Date('2035-02-01'))).toEqual(
      saved[0],
    );
    expect(await resource.db.notificationAcknowledgement.count()).toBe(1);
    expect((await service.list('notifications', c.notificationsQuerySchema.parse({}), now)).unreadCount).toBe(7);
    expect({
      run: await resource.db.importRun.findMany({ orderBy: { id: 'asc' } }),
      issues: await resource.db.importIssue.findMany({ orderBy: { id: 'asc' } }),
      contracts: await resource.db.contract.findMany({ orderBy: { id: 'asc' } }),
      revisions: await resource.db.contractRevision.findMany({ orderBy: { id: 'asc' } }),
      payments: await resource.db.contractPayment.findMany({ orderBy: { id: 'asc' } }),
      transactions: await resource.db.transaction.findMany({ orderBy: { id: 'asc' } }),
    }).toEqual(before);
  });

  it('requires new acknowledgements for revised import issues and effective payment revisions', /** A source revision cannot inherit a stale read flag from its earlier amount or diagnostic. */ async () => {
    const initial = await service.list('notifications', c.notificationsQuerySchema.parse({ limit: 100 }), now);
    const oldIssue = initial.items.find(
      /** Resolve the acknowledged old source identity. */ (item) => item.sourceKey.startsWith(`import:${issueId}:`),
    )!;
    await resource.db.importIssue.update({ where: { id: issueId }, data: { message: 'Revised synthetic diagnostic' } });
    const changed = (
      await service.list('notifications', c.notificationsQuerySchema.parse({ limit: 100 }), now)
    ).items.find(
      /** The same issue ID now has a different bounded revision identity. */ (item) =>
        item.sourceKey.startsWith(`import:${issueId}:`),
    )!;
    expect(changed.sourceKey).not.toBe(oldIssue.sourceKey);
    expect(changed.acknowledgedAt).toBeNull();
    const due = initial.items.find(
      /** Choose an upcoming due date whose effective price changes. */ (item) =>
        item.href === `/contracts/${contractId}` && item.dueDate === '2035-02-28',
    )!;
    await service.acknowledge('notifications', { sourceKey: due.sourceKey }, now);
    await resource.db.contractRevision.create({
      data: { contractId, effectiveDate: new Date('2035-02-01'), amountCents: 3000n, intervalMonths: 1 },
    });
    const revised = (
      await service.list('notifications', c.notificationsQuerySchema.parse({ limit: 100 }), now)
    ).items.find(
      /** Same contract and due date must expose the new effective revision. */ (item) =>
        item.href === `/contracts/${contractId}` && item.dueDate === '2035-02-28',
    )!;
    expect(revised.sourceKey).not.toBe(due.sourceKey);
    expect(revised.plannedCents).toBe('3000');
    expect(revised.acknowledgedAt).toBeNull();
  });

  it('rejects unknown/deleted current keys and stale cursors while replaying a previously saved receipt', /** Source disappearance removes the event, not its existing immutable acknowledgement receipt. */ async () => {
    const current = (
      await service.list('notifications', c.notificationsQuerySchema.parse({ limit: 100 }), now)
    ).items.find(
      /** Select a still-current revision without an acknowledgement. */ (item) =>
        item.sourceKey.startsWith(`import:${issueId}:`),
    )!;
    const count = await resource.db.notificationAcknowledgement.count();
    await resource.db.importIssue.delete({ where: { id: issueId } });
    await expect(service.acknowledge('notifications', { sourceKey: current.sourceKey }, now)).rejects.toMatchObject({
      code: 'NOTIFICATION_CHANGED',
    });
    await expect(
      service.list('notifications', c.notificationsQuerySchema.parse({ cursor: current.sourceKey }), now),
    ).rejects.toMatchObject({ code: 'NOTIFICATION_PAGE_CHANGED' });
    await expect(service.acknowledge('notifications', { sourceKey: 'invented:key' }, now)).rejects.toMatchObject({
      code: 'NOTIFICATION_CHANGED',
    });
    expect(await resource.db.notificationAcknowledgement.count()).toBe(count);
    const old = await resource.db.notificationAcknowledgement.findFirstOrThrow();
    expect((await service.acknowledge('notifications', { sourceKey: old.sourceKey }, now)).acknowledgedAt).toBe(
      old.acknowledgedAt.toISOString(),
    );
  });

  it('enforces real session/CSRF, bounded strict keys and matching runtime/OpenAPI contracts', /** The client cannot select another owner, inject money or use remote notification targets. */ async () => {
    const app = await createApp(resource.db, false);
    try {
      await app.app.getHttpAdapter().getInstance().ready();
      expect((await app.app.inject({ method: 'GET', url: '/api/v1/notifications' })).statusCode).toBe(401);
      const login = await app.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'notifications', password: 'notifications-test-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!,
        headers = { cookie, origin: 'http://localhost:3000', 'x-csrf-token': login.json().csrfToken };
      const page = await app.app.inject({
        method: 'GET',
        url: '/api/v1/notifications?limit=1&kind=IMPORT_REVIEW',
        headers,
      });
      expect(page.statusCode).toBe(200);
      expect(c.notificationsSchema.safeParse(page.json()).success).toBe(true);
      const sourceKey = page.json().items[0].sourceKey;
      expect(
        (
          await app.app.inject({
            method: 'PUT',
            url: '/api/v1/notifications/acknowledgement',
            headers: { cookie },
            payload: { sourceKey },
          })
        ).statusCode,
      ).toBe(403);
      for (const payload of [
        { sourceKey: '' },
        { sourceKey: 'x'.repeat(257) },
        { sourceKey, userId: 'another-owner' },
        { sourceKey, plannedCents: '1' },
      ])
        expect(
          (await app.app.inject({ method: 'PUT', url: '/api/v1/notifications/acknowledgement', headers, payload }))
            .statusCode,
        ).toBe(400);
      expect(
        (await app.app.inject({ method: 'GET', url: '/api/v1/notifications?limit=101', headers })).statusCode,
      ).toBe(400);
      expect(
        (
          await app.app.inject({
            method: 'PUT',
            url: '/api/v1/notifications/acknowledgement',
            headers,
            payload: { sourceKey },
          })
        ).statusCode,
      ).toBe(200);
      expect(app.openapi.paths['/api/v1/notifications']?.get).toBeDefined();
      expect(app.openapi.paths['/api/v1/notifications/acknowledgement']?.put).toBeDefined();
      expect(
        c.notificationSchema.safeParse({ ...page.json().items[0], plannedCents: '9223372036854775808' }).success,
      ).toBe(false);
      expect(c.notificationSchema.safeParse({ ...page.json().items[0], href: 'https://example.test' }).success).toBe(
        false,
      );
    } finally {
      await app.app.close();
    }
  });
});
