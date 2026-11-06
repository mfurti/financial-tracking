import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import { testDatabase } from './database.js';

describe('private API authentication', /** Exercise sessions with real persisted token hashes. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>;
  let service: Awaited<ReturnType<typeof createApp>>;
  let cookie = '';
  let csrf = '';
  beforeAll(
    /** Start a disposable database and provision the only user. */ async () => {
      resource = await testDatabase();
      await resource.db.user.create({
        data: { username: 'max', passwordHash: await passwordHash('test-only-long-password') },
      });
      service = await createApp(resource.db);
      await service.app.getHttpAdapter().getInstance().ready();
    },
  );
  afterAll(
    /** Release HTTP and PostgreSQL resources. */ async () => {
      await service?.app.close();
      await resource?.close();
    },
  );
  it('rejects missing sessions and untrusted login origins', /** Guard every private route and login origin. */ async () => {
    expect((await service.app.inject({ method: 'GET', url: '/api/v1/auth/session' })).statusCode).toBe(401);
    expect(
      (
        await service.app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { username: 'max', password: 'test-only-long-password' },
          headers: { origin: 'https://evil.example' },
        })
      ).statusCode,
    ).toBe(403);
  });
  it('creates a hashed session with secure cookie attributes and shared response', /** Authentication exposes no database tokens. */ async () => {
    const response = await service.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'max', password: 'test-only-long-password' },
      headers: { origin: 'http://localhost:3000' },
    });
    expect(response.statusCode).toBe(201);
    const header = String(response.headers['set-cookie']);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    cookie = header.split(';')[0]!;
    csrf = response.json().csrfToken;
    const stored = await resource.db.session.findFirstOrThrow();
    expect(cookie).not.toContain(stored.tokenHash);
    expect(response.json().username).toBe('max');
  });
  it('rejects writes without CSRF and invalidates logout sessions', /** Token revocation must survive another request. */ async () => {
    expect(
      (
        await service.app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          headers: { cookie, origin: 'http://localhost:3000' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await service.app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          headers: { cookie, origin: 'http://localhost:3000', 'x-csrf-token': csrf },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (await service.app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { cookie } })).statusCode,
    ).toBe(401);
  });
  it('publishes the login/session schemas in OpenAPI', /** Documentation must include actual route contracts. */ () => {
    expect(service.openapi.paths['/api/v1/auth/login']?.post?.requestBody).toBeDefined();
    expect(service.openapi.paths['/api/v1/auth/session']?.get?.responses['200']).toBeDefined();
  });
});
