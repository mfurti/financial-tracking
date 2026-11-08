import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { CategoryRulesService, matchingCategoryRule } from '../apps/api/src/category-rules.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { ImportService } from '../apps/api/src/imports.js';
import { AssignmentService } from '../apps/api/src/assignments.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { categoryRuleInputSchema } from '../packages/contracts/src/index.js';

describe('safe category rules and manual classifications', /** Real PostgreSQL persistence, imports, merges and authenticated transport. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let rules: CategoryRulesService, ledger: LedgerService, imports: ImportService;
  beforeAll(
    /** Start only an owned disposable database. */ async () => {
      resource = await testDatabase();
      rules = new CategoryRulesService(resource.db);
      ledger = new LedgerService(resource.db);
      imports = new ImportService(resource.db);
    },
  );
  afterAll(/** Release the disposable database and processes. */ async () => resource?.close());
  /** Import explicit synthetic data with unique source references. */
  async function csv(text: string, accountId: string | null = null) {
    const preview = await imports.preview({
      accountId,
      content: `Datum;Betrag;Text;Partner;Referenz\n01.10.2026;-12,34;${text};MARKT;${text}\n`,
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
    return resource.db.transaction.findFirstOrThrow({
      where: { identities: { some: { importRunId: preview.run.id } } },
    });
  }
  it('reuses templates, applies new-import rules and protects manual category clears on explicit backfill and repeat imports', /** A newly saved rule must not change old rows before explicit confirmation. */ async () => {
    const existing = await ledger.createCategory({ name: 'Kleidung', kind: 'EXPENSE' });
    const templates = await rules.templates(['Mode', 'Technik']);
    expect(templates[0]!.id).toBe(existing.id);
    expect(
      (await rules.templates(['Mode', 'Technik'])).map(/** Compare stable template identities. */ (row) => row.id),
    ).toEqual(templates.map(/** Repeated installation is idempotent. */ (row) => row.id));
    const category = templates[1]!;
    const tag = randomUUID();
    const old = await csv(`old-${tag}`);
    const rule = await rules.save(
      categoryRuleInputSchema.parse({
        name: 'Market rule',
        categoryId: category.id,
        matchType: 'COUNTERPARTY',
        text: 'markt',
        direction: 'EXPENSE',
      }),
    );
    expect((await ledger.transaction(old.id)).categoryId).toBeNull();
    const fresh = await csv(`new-${tag}`);
    expect(fresh.categoryId).toBe(category.id);
    expect(fresh.categoryOrigin).toBe('RULE');
    expect(fresh.categoryRuleName).toBe('Market rule');
    await ledger.patchTransaction(fresh.id, { categoryId: null, classification: 'VARIABLE' });
    await rules.apply();
    expect((await ledger.transaction(old.id)).categoryId).toBe(category.id);
    const manual = await ledger.transaction(fresh.id);
    expect(manual.categoryId).toBeNull();
    expect(manual.categoryOrigin).toBe('MANUAL');
    expect(manual.classification).toBe('VARIABLE');
    await rules.remove(rule.id);
    expect((await ledger.transaction(old.id)).categoryRuleId).toBe(rule.id);
    await ledger.bulkCategory([old.id], null);
    expect((await ledger.transaction(old.id)).categoryOrigin).toBe('MANUAL');
    expect(await ledger.bulkClassification([old.id, fresh.id], 'FIXED')).toEqual({ updated: 2 });
    await expect(ledger.bulkClassification([old.id, randomUUID()], 'VARIABLE')).rejects.toThrow();
    expect((await ledger.transaction(old.id)).classification).toBe('FIXED');
  });
  it('leaves equal-priority conflicts unresolved and treats regex characters literally', /** No guessing, regex execution or lower-priority override. */ async () => {
    const first = await ledger.createCategory({ name: randomUUID(), kind: 'EXPENSE' });
    const second = await ledger.createCategory({ name: randomUUID(), kind: 'EXPENSE' });
    const tag = randomUUID();
    const a = await rules.save(
      categoryRuleInputSchema.parse({
        name: 'first',
        categoryId: first.id,
        matchType: 'DESCRIPTION',
        text: tag,
        priority: 7,
      }),
    );
    const b = await rules.save(
      categoryRuleInputSchema.parse({
        name: 'second',
        categoryId: second.id,
        matchType: 'DESCRIPTION',
        text: tag,
        priority: 7,
      }),
    );
    const row = await csv(tag);
    expect(row.categoryId).toBeNull();
    expect(row.categoryRuleConflict).toBe(true);
    await rules.save({ isActive: false }, b.id);
    await rules.apply();
    expect((await ledger.transaction(row.id)).categoryId).toBe(first.id);
    const dbRule = await resource.db.categoryRule.findUniqueOrThrow({ where: { id: a.id } });
    expect(
      matchingCategoryRule({ description: 'ordinary', counterpartyName: null, amountCents: -1n }, [
        { ...dbRule, text: '.*' },
      ]).rule,
    ).toBeNull();
    expect(
      matchingCategoryRule({ description: tag, counterpartyName: null, amountCents: 1n }, [
        { ...dbRule, direction: 'EXPENSE' },
      ]).rule,
    ).toBeNull();
    await rules.remove(a.id);
    await rules.remove(b.id);
  });
  it('preserves manual empty category and resolves conflicting fixed/variable annotations during real consolidation', /** Failed decisions roll back source removal and successful merges keep one counted transaction. */ async () => {
    const tag = randomUUID();
    const connection = await ledger.createConnection({ name: tag, bankCode: '69050001', connectorType: 'CSV' });
    const account = await ledger.createAccount({ bankConnectionId: connection.id, name: tag, accountType: 'CHECKING' });
    const source = await csv(tag);
    const category = await ledger.createCategory({ name: tag, kind: 'EXPENSE' });
    await ledger.patchTransaction(source.id, { categoryId: null, classification: 'VARIABLE' });
    const target = await resource.db.transaction.create({
      data: {
        accountId: account.id,
        amountCents: source.amountCents,
        bookingDate: source.bookingDate,
        description: source.description,
        counterpartyName: source.counterpartyName,
        categoryId: category.id,
        categoryOrigin: 'MANUAL',
        classification: 'FIXED',
      },
    });
    const assignments = new AssignmentService(resource.db);
    const preview = await assignments.preview({ accountId: account.id, transactionIds: [source.id] });
    const decision = {
      transactionId: source.id,
      token: preview.items[0]!.token,
      action: 'BANK' as const,
      candidateId: target.id,
    };
    await expect(
      assignments.apply({ requestId: randomUUID(), accountId: account.id, decisions: [decision] }),
    ).rejects.toThrow('Kategorien');
    await expect(
      assignments.apply({
        requestId: randomUUID(),
        accountId: account.id,
        decisions: [{ ...decision, categoryChoice: 'CSV' }],
      }),
    ).rejects.toThrow('Fix/Variabel');
    expect(await resource.db.transaction.findUnique({ where: { id: source.id } })).not.toBeNull();
    await assignments.apply({
      requestId: randomUUID(),
      accountId: account.id,
      decisions: [{ ...decision, categoryChoice: 'CSV', classificationChoice: 'CSV' }],
    });
    const merged = await ledger.transaction(target.id);
    expect(merged.categoryId).toBeNull();
    expect(merged.categoryOrigin).toBe('MANUAL');
    expect(merged.classification).toBe('VARIABLE');
    expect(merged.amountCents).toBe('-1234');
    expect(await resource.db.transaction.findUnique({ where: { id: source.id } })).toBeNull();
    const repeated = await csv(tag, account.id);
    expect(repeated.id).toBe(target.id);
    expect(repeated.categoryId).toBeNull();
    expect(repeated.categoryOrigin).toBe('MANUAL');
    expect(repeated.classification).toBe('VARIABLE');
  });
  it('validates shared HTTP contracts and denies unauthenticated or missing-CSRF rule writes', /** Exercise the actual guard, controller, serializer and generated OpenAPI. */ async () => {
    await resource.db.user.create({
      data: { username: 'rules-user', passwordHash: await passwordHash('synthetic-rule-password') },
    });
    const service = await createApp(resource.db, false);
    try {
      await service.app.getHttpAdapter().getInstance().ready();
      expect((await service.app.inject({ method: 'GET', url: '/api/v1/category-rules' })).statusCode).toBe(401);
      const login = await service.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'rules-user', password: 'synthetic-rule-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      const headers = { cookie, origin: 'http://localhost:3000', 'x-csrf-token': login.json().csrfToken };
      expect(
        (
          await service.app.inject({
            method: 'POST',
            url: '/api/v1/category-rules/apply',
            headers: { cookie, origin: 'http://localhost:3000' },
            payload: { confirm: true },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await service.app.inject({ method: 'POST', url: '/api/v1/category-rules/apply', headers, payload: {} }))
          .statusCode,
      ).toBe(400);
      const response = await service.app.inject({ method: 'GET', url: '/api/v1/category-rules', headers });
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
      const category = await ledger.createCategory({ name: randomUUID(), kind: 'EXPENSE' });
      const storedRule = await rules.save(
        categoryRuleInputSchema.parse({
          name: 'partial original',
          categoryId: category.id,
          matchType: 'DESCRIPTION',
          text: 'partial',
          direction: 'EXPENSE',
          priority: 7,
          isActive: false,
        }),
      );
      const patched = await service.app.inject({
        method: 'PATCH',
        url: `/api/v1/category-rules/${storedRule.id}`,
        headers,
        payload: { name: 'partial renamed' },
      });
      expect(patched.statusCode).toBe(200);
      expect(patched.json()).toMatchObject({
        name: 'partial renamed',
        direction: 'EXPENSE',
        priority: 7,
        isActive: false,
      });
      expect(service.openapi.paths['/api/v1/category-rules']?.post?.requestBody).toBeDefined();
      expect(
        (
          await service.app.inject({
            method: 'POST',
            url: '/api/v1/category-rules',
            headers,
            payload: { name: 'invalid regex', categoryId: randomUUID(), matchType: 'REGEX', text: '.*' },
          })
        ).statusCode,
      ).toBe(400);
    } finally {
      await service.app.close();
    }
  });
});
