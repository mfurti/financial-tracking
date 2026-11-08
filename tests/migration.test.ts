import { afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { testDatabase } from './database.js';

describe('accountless upgrade preservation', /** Run the actual new SQL over a populated old schema. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  afterAll(/** Close the owned database even when a preservation assertion fails. */ async () => resource?.close());
  it('preserves exact amounts, annotations, account IDs and existing identities', /** New nullability must not silently rewrite old financial records. */ async () => {
    resource = await testDatabase({ initialOnly: true });
    const connection = new Client({ connectionString: resource.url });
    await connection.connect();
    try {
      await connection.query(`
        INSERT INTO "BankConnection" (id,name,"bankCode","connectorType","updatedAt") VALUES ('00000000-0000-4000-8000-000000000001','Synthetic legacy','69050001','CSV',NOW());
        INSERT INTO "Account" (id,"bankConnectionId",name) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Legacy account');
        INSERT INTO "Category" (id,name,kind) VALUES ('00000000-0000-4000-8000-000000000003','Legacy manual category','EXPENSE');
        INSERT INTO "Transaction" (id,"accountId","amountCents","bookingDate",description,"categoryId","isTransfer","updatedAt") VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002',9007199254740993,'2026-11-01','Exact legacy amount','00000000-0000-4000-8000-000000000003',TRUE,NOW());
        INSERT INTO "TransactionIdentity" (id,"accountId","identityType","identityValue","transactionId") VALUES ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000002','BANK_REFERENCE','legacy-reference','00000000-0000-4000-8000-000000000004');
      `);
    } finally {
      await connection.end();
    }
    await resource.applyMigrations();
    await resource.applyMigrations();
    const row = await resource.db.transaction.findUniqueOrThrow({
      where: { id: '00000000-0000-4000-8000-000000000004' },
      include: { identities: true },
    });
    expect(row.accountId).toBe('00000000-0000-4000-8000-000000000002');
    expect(row.amountCents).toBe(9007199254740993n);
    expect(row.categoryId).toBe('00000000-0000-4000-8000-000000000003');
    expect(row.categoryOrigin).toBe('MANUAL');
    expect(row.classification).toBeNull();
    expect(row.isTransfer).toBe(true);
    expect(row.identities[0]!.scope).toBe(`account:${row.accountId}`);
    expect(row.identities[0]!.importRunId).toBeNull();
    const unassigned = await resource.db.transaction.create({
      data: { amountCents: -1n, bookingDate: new Date('2026-11-01'), description: 'No placeholder account' },
    });
    expect(unassigned.accountId).toBeNull();
    const identity = {
      accountId: null,
      scope: 'import:one',
      identityType: 'BANK_REFERENCE',
      identityValue: 'same-ref',
      transactionId: unassigned.id,
    };
    await resource.db.transactionIdentity.create({ data: identity });
    await expect(resource.db.transactionIdentity.create({ data: identity })).rejects.toThrow();
    await resource.db.transactionIdentity.create({ data: { ...identity, scope: 'import:two' } });
    await expect(resource.db.transactionIdentity.create({ data: { ...identity, scope: '' } })).rejects.toThrow();
  });
});
