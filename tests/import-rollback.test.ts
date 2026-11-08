import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { testDatabase } from './database.js';
import { ImportService } from '../apps/api/src/imports.js';
import { ImportRollbackService } from '../apps/api/src/import-rollback.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { rollbackInputSchema } from '../packages/contracts/src/index.js';

describe('previewed CSV rollback', /** Real PostgreSQL source ownership, links and HTTP boundaries. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let imports: ImportService, rollback: ImportRollbackService;
  beforeAll(
    /** Own all test data and processes. */ async () => {
      resource = await testDatabase();
      imports = new ImportService(resource.db);
      rollback = new ImportRollbackService(resource.db);
    },
  );
  afterAll(/** Remove only the disposable database. */ async () => resource?.close());
  /** Import one exact synthetic row, optionally repeating an account-scoped reference. */
  async function upload(label = randomUUID(), accountId: string | null = null) {
    const preview = await imports.preview({
      accountId,
      content: `Datum;Betrag;Text;Partner;Referenz\n01.02.2033;-12,20;${label};${label};${label}\n`,
      delimiter: ';',
      encoding: 'utf-8',
      mapping: {
        bookingDate: 'Datum',
        amount: 'Betrag',
        description: 'Text',
        counterpartyName: 'Partner',
        reference: 'Referenz',
      },
    });
    await imports.commit(preview.run.id, false);
    const row = await resource.db.transaction.findFirstOrThrow({ where: { description: label } });
    return { run: preview.run.id, row, label };
  }
  /** Submit exactly the current preview with explicit consent. */
  async function remove(id: string, linked: 'KEEP' | 'REMOVE' = 'KEEP', confirmLinks = false) {
    const preview = await rollback.preview(id);
    return rollback.rollback(
      id,
      rollbackInputSchema.parse({ token: preview.token, confirm: true, linked, confirmLinks }),
    );
  }
  it('removes owned rows and identities, then accepts the identical accountless upload again', /** Reimport must create a new actual row rather than a stale duplicate decision. */ async () => {
    const first = await upload();
    expect(await rollback.preview(first.run)).toMatchObject({ owned: 1, shared: 0, uncertain: 0 });
    expect(await remove(first.run)).toEqual({ deleted: 1, retained: 0 });
    expect(await resource.db.transactionIdentity.count({ where: { transactionId: first.row.id } })).toBe(0);
    expect(await resource.db.importRun.findUnique({ where: { id: first.run } })).toBeNull();
    const second = await upload(first.label);
    expect(second.row.id).not.toBe(first.row.id);
    expect(await resource.db.transaction.count({ where: { description: first.label } })).toBe(1);
  });
  it('upgrades legacy ownership conservatively without changing original financial fields', /** Apply the actual migration over the populated immediately preceding schema. */ async () => {
    const old = await testDatabase({ empty: true });
    const client = new Client({ connectionString: old.url });
    await client.connect();
    try {
      const root = resolve('apps/api/prisma/migrations');
      const migrations = (await readdir(root))
        .filter(/** Ignore the provider lock file. */ (name) => /^\d/.test(name))
        .sort();
      for (const migration of migrations.filter(
        /** Stop immediately before the migration under test. */ (name) => name < '202611080003_import_rollback',
      ))
        await client.query(await readFile(resolve(root, migration, 'migration.sql'), 'utf8'));
      const runId = randomUUID();
      await client.query(
        "INSERT INTO \"ImportRun\" (id,source,status,\"startedAt\",\"finishedAt\") VALUES ($1,'CSV','COMPLETED',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour')",
        [runId],
      );
      const owned = randomUUID(),
        unknown = randomUUID();
      for (const id of [owned, unknown]) {
        await client.query(
          'INSERT INTO "Transaction" (id,"amountCents","bookingDate",description,"updatedAt") VALUES ($1,9007199254740993,\'2033-02-01\',\'Legacy exact\',NOW())',
          [id],
        );
        await client.query(
          'INSERT INTO "TransactionIdentity" (id,scope,"importRunId","identityType","identityValue","transactionId") VALUES ($1,$2,$3,\'BANK_REFERENCE\',$4::text,$4::uuid)',
          [randomUUID(), `import:${runId}`, id === owned ? runId : null, id],
        );
      }
      const before = (await client.query('SELECT * FROM "Transaction" ORDER BY id')).rows;
      await client.query(await readFile(resolve(root, '202611080003_import_rollback/migration.sql'), 'utf8'));
      const after = (await client.query('SELECT * FROM "Transaction" ORDER BY id')).rows;
      expect(
        after.map(
          /** New ownership is the only changed field. */ (row) => {
            const fields = { ...row };
            delete fields.createdByImportRunId;
            return fields;
          },
        ),
      ).toEqual(before);
      expect(after.find(/** Match the definite origin. */ (row) => row.id === owned).createdByImportRunId).toBe(runId);
      expect(
        after.find(/** Missing evidence must stay unknown. */ (row) => row.id === unknown).createdByImportRunId,
      ).toBeNull();
    } finally {
      await client.end();
      await old.close();
    }
  });
  it('retains rows observed by another import and preserves their canonical reference', /** A repeated source is not permission to delete someone else's booking. */ async () => {
    const bank = await resource.db.bankConnection.create({
      data: { name: 'Synthetic', bankCode: '69050001', connectorType: 'CSV' },
    });
    const account = await resource.db.account.create({
      data: { name: 'Synthetic account', bankConnectionId: bank.id },
    });
    const first = await upload(randomUUID(), account.id);
    const second = await upload(first.label, account.id);
    expect(await rollback.preview(first.run)).toMatchObject({ shared: 1, owned: 0 });
    expect(await remove(first.run)).toEqual({ deleted: 0, retained: 1 });
    expect(await resource.db.transaction.findUnique({ where: { id: first.row.id } })).not.toBeNull();
    expect(
      await resource.db.transactionIdentity.count({ where: { transactionId: first.row.id, importRunId: second.run } }),
    ).toBeGreaterThan(0);
    const third = await upload(first.label, account.id);
    expect((await imports.run(third.run)).knownCount).toBe(1);
  });
  it('rejects stale impact and protects uncertain legacy ownership', /** No partial writes after manual edits or missing origin. */ async () => {
    const current = await upload();
    const preview = await rollback.preview(current.run);
    await resource.db.transaction.update({ where: { id: current.row.id }, data: { classification: 'VARIABLE' } });
    await expect(
      rollback.rollback(current.run, rollbackInputSchema.parse({ token: preview.token, confirm: true })),
    ).rejects.toMatchObject({ code: 'ROLLBACK_STALE' });
    expect(await rollback.preview(current.run)).toMatchObject({ manual: 1 });
    await resource.db.transaction.update({ where: { id: current.row.id }, data: { createdByImportRunId: null } });
    expect(await rollback.preview(current.run)).toMatchObject({ uncertain: 1, owned: 0 });
    expect(await remove(current.run, 'REMOVE', true)).toEqual({ deleted: 0, retained: 1 });
  });
  it('keeps linked payments by default and dissolves only explicitly selected links', /** Removing a payment never removes its contract or the transfer's opposite booking. */ async () => {
    for (const policy of ['KEEP', 'REMOVE'] as const) {
      const current = await upload();
      const contract = await resource.db.contract.create({
        data: {
          name: current.label,
          provider: current.label,
          kind: 'SUBSCRIPTION',
          startDate: new Date('2033-02-01'),
          revisions: { create: { amountCents: 1220n, intervalMonths: 1, effectiveDate: new Date('2033-02-01') } },
        },
        include: { revisions: true },
      });
      await resource.db.contractPayment.create({
        data: {
          contractId: contract.id,
          revisionId: contract.revisions[0]!.id,
          transactionId: current.row.id,
          dueDate: new Date('2033-02-01'),
          source: 'MANUAL',
        },
      });
      const group = await resource.db.transferGroup.create({ data: {} });
      await resource.db.transaction.update({
        where: { id: current.row.id },
        data: { transferGroupId: group.id, isTransfer: true },
      });
      const other = await resource.db.transaction.create({
        data: {
          amountCents: 1220n,
          description: 'Opposite side',
          bookingDate: new Date('2033-02-01'),
          transferGroupId: group.id,
          isTransfer: true,
        },
      });
      expect(await rollback.preview(current.run)).toMatchObject({ linked: 1 });
      if (policy === 'REMOVE')
        await expect(remove(current.run, policy)).rejects.toMatchObject({ code: 'ROLLBACK_LINK_CONFIRMATION' });
      expect(await remove(current.run, policy, policy === 'REMOVE')).toEqual({
        deleted: policy === 'REMOVE' ? 1 : 0,
        retained: policy === 'KEEP' ? 1 : 0,
      });
      expect(await resource.db.contract.findUnique({ where: { id: contract.id } })).not.toBeNull();
      const remaining = await resource.db.transaction.findUniqueOrThrow({ where: { id: other.id } });
      expect(remaining.isTransfer).toBe(policy === 'KEEP');
      expect(remaining.amountCents).toBe(1220n);
    }
  });
  it('serializes concurrent confirmations and enforces HTTP authentication, CSRF and shared contracts', /** Exercise actual transport rather than only service calls. */ async () => {
    const current = await upload();
    const preview = await rollback.preview(current.run);
    const input = rollbackInputSchema.parse({ token: preview.token, confirm: true });
    const results = await Promise.allSettled([
      rollback.rollback(current.run, input),
      rollback.rollback(current.run, input),
    ]);
    expect(
      results.filter(/** Exactly one destructive operation may commit. */ (result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    await resource.db.user.create({
      data: { username: 'rollback-user', passwordHash: await passwordHash('synthetic-rollback-password') },
    });
    const service = await createApp(resource.db, false);
    try {
      await service.app.getHttpAdapter().getInstance().ready();
      const target = await upload();
      const path = `/api/v1/imports/${target.run}`;
      expect((await service.app.inject({ method: 'GET', url: `${path}/rollback-preview` })).statusCode).toBe(401);
      const login = await service.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'rollback-user', password: 'synthetic-rollback-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      const headers = { cookie, origin: 'http://localhost:3000', 'x-csrf-token': login.json().csrfToken };
      const response = await service.app.inject({ method: 'GET', url: `${path}/rollback-preview`, headers });
      expect(response.statusCode).toBe(200);
      const payload = { token: response.json().token, confirm: true };
      expect(
        (
          await service.app.inject({
            method: 'POST',
            url: `${path}/rollback`,
            headers: { cookie, origin: 'http://localhost:3000' },
            payload,
          })
        ).statusCode,
      ).toBe(403);
      expect((await service.app.inject({ method: 'POST', url: `${path}/rollback`, headers, payload })).json()).toEqual({
        deleted: 1,
        retained: 0,
      });
      expect(service.openapi.paths['/api/v1/imports/{id}/rollback']?.post?.requestBody).toBeDefined();
    } finally {
      await service.app.close();
    }
  });
});
