import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { LedgerService } from '../apps/api/src/ledger.js';
import { testDatabase } from './database.js';
import { csvEncodingSchema, csvDelimiterSchema } from '../packages/contracts/src/index.js';

describe('authentication and HTTP contract boundaries', /** Exercise real session expiry, rate limiting and response validation. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>, service: Awaited<ReturnType<typeof createApp>>;
  beforeAll(
    /** Initialize an independent app/database so throttle checks cannot affect other suites. */ async () => {
      resource = await testDatabase();
      await resource.db.user.create({
        data: { username: 'boundary', passwordHash: await passwordHash('synthetic-boundary-password') },
      });
      service = await createApp(resource.db);
      await service.app.getHttpAdapter().getInstance().ready();
    },
  );
  afterAll(
    /** Close the private HTTP fixture and its database. */ async () => {
      await service?.app.close();
      await resource?.close();
    },
  );
  /** Create a valid private session through the actual password verifier. */
  async function login() {
    const response = await service.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'http://localhost:3000' },
      payload: { username: 'boundary', password: 'synthetic-boundary-password' },
    });
    expect(response.statusCode).toBe(201);
    return {
      cookie: String(response.headers['set-cookie']).split(';')[0]!,
      origin: 'http://localhost:3000',
      'x-csrf-token': response.json().csrfToken,
    };
  }
  it.each(['absolute', 'idle'])(
    'revokes %s-expired sessions in the database',
    /** Both expiry boundaries reject the old cookie and remove its token hash. */ async (mode) => {
      const headers = await login();
      await resource.db.session.updateMany({
        data:
          mode === 'absolute'
            ? { expiresAt: new Date(Date.now() - 1000) }
            : { lastSeenAt: new Date(Date.now() - 13 * 3600_000) },
      });
      const expired = await service.app.inject({ method: 'GET', url: '/api/v1/auth/session', headers });
      expect(expired.statusCode).toBe(401);
      expect(expired.json().error.code).toBe('SESSION_EXPIRED');
      expect(await resource.db.session.count()).toBe(0);
    },
  );
  it('returns only safe invalid-field paths and validates output before serialization', /** Neither rejected values nor invalid internal responses may cross HTTP. */ async () => {
    const headers = await login();
    const invalid = await service.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers,
      payload: { iban: 'CANARY_REJECTED_IBAN_319a' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.details.fields).toContainEqual({ path: 'iban', code: 'custom' });
    expect(invalid.body).not.toContain('CANARY_REJECTED_IBAN_319a');
    expect(invalid.headers['cache-control']).toBe('no-store');
    const ledger = service.app.get(LedgerService),
      original = ledger.categories;
    try {
      ledger.categories = /** Represent a corrupt internal result, not a malformed HTTP request. */ async () =>
        [{ name: 'CANARY_INVALID_INTERNAL_4c1e' }] as unknown as Awaited<ReturnType<typeof original>>;
      const response = await service.app.inject({ method: 'GET', url: '/api/v1/categories', headers });
      expect(response.statusCode).toBe(500);
      expect(response.json().error.code).toBe('INVALID_RESPONSE');
      expect(response.body).not.toContain('CANARY_INVALID_INTERNAL_4c1e');
    } finally {
      ledger.categories = original;
    }
  });
  it('documents and accepts decoded CSV format metadata without weakening authentication', /** Byte decoding stays in the browser; API/OpenAPI share all supported format enums. */ async () => {
    const body = {
      content: 'Datum\tBetrag\tText\n07.11.2026\t-1,20\tÜberweisung Test\n',
      delimiter: '\t',
      encoding: 'utf-16le',
      mapping: { bookingDate: 'Datum', amount: 'Betrag', description: 'Text' },
    };
    const denied = await service.app.inject({ method: 'POST', url: '/api/v1/imports/csv/preview', payload: body });
    expect(denied.statusCode).toBe(401);
    const headers = await login();
    for (const encoding of csvEncodingSchema.options) {
      const response = await service.app.inject({
        method: 'POST',
        url: '/api/v1/imports/csv/preview',
        headers,
        payload: { ...body, encoding },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        totalRows: 1,
        invalidRows: 0,
        rows: [{ description: 'Überweisung Test', amountCents: '-120', accountId: null }],
      });
    }
    expect(await resource.db.transaction.count()).toBe(0);
    expect(service.openapi.paths['/api/v1/imports/csv/preview']?.post?.requestBody).toMatchObject({
      content: {
        'application/json': {
          schema: {
            properties: {
              encoding: { enum: csvEncodingSchema.options },
              delimiter: { enum: csvDelimiterSchema.options },
            },
          },
        },
      },
    });
    const invalid = await service.app.inject({
      method: 'POST',
      url: '/api/v1/imports/csv/preview',
      headers,
      payload: { ...body, encoding: 'utf-7' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.details.fields).toContainEqual({ path: 'encoding', code: 'invalid_value' });
  });
  it('limits repeated login failures without disclosing account existence', /** A separate app owns fresh in-memory IP/username rate limits. */ async () => {
    const isolated = await createApp(resource.db, false);
    await isolated.app.getHttpAdapter().getInstance().ready();
    try {
      for (let i = 0; i < 11; i++) {
        const response = await isolated.app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          headers: { origin: 'http://localhost:3000' },
          payload: { username: 'missing-account', password: 'CANARY_REJECTED_PASSWORD_9ad2' },
        });
        expect(response.statusCode).toBe(i < 10 ? 401 : 429);
        expect(response.body).not.toContain('CANARY_REJECTED_PASSWORD_9ad2');
        expect(response.json().error.code).toBe(i < 10 ? 'INVALID_LOGIN' : 'LOGIN_RATE_LIMIT');
      }
    } finally {
      await isolated.app.close();
    }
  });
});
