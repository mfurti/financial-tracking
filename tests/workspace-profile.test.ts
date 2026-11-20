import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase } from './database.js';
import { WorkspaceService } from '../apps/api/src/workspace.js';
import { createApp } from '../apps/api/src/app.js';
import { passwordHash } from '../apps/api/src/auth.js';
import * as c from '../packages/contracts/src/index.js';

describe('current-owner display profile', /** Contact/profile metadata cannot change real authentication or financial records. */ () => {
  let resource: Awaited<ReturnType<typeof testDatabase>>, service: WorkspaceService, ownerId: string;
  beforeAll(
    /** Own disposable owner and financial fixtures independent of live credentials. */ async () => {
      resource = await testDatabase();
      service = new WorkspaceService(resource.db);
      ownerId = (
        await resource.db.user.create({
          data: { username: 'profile-owner', passwordHash: await passwordHash('profile-test-password') },
        })
      ).id;
      const connection = await resource.db.bankConnection.create({
        data: { name: 'Profile source', bankCode: '69050001', connectorType: 'CSV' },
      });
      const account = await resource.db.account.create({
        data: { bankConnectionId: connection.id, name: 'Unchanged financial account' },
      });
      await resource.db.transaction.create({
        data: {
          accountId: account.id,
          amountCents: -9007199254740993n,
          bookingDate: new Date('2035-01-01'),
          description: 'Preserved exact source',
        },
      });
    },
  );
  afterAll(/** Remove only the owned fixture database. */ async () => resource?.close());

  it('reads an unpersisted fallback and rejects missing/wrong authenticated identities', /** A GET never writes a profile or invents a contact address. */ async () => {
    expect(await service.profile('profile-owner')).toEqual({
      userId: ownerId,
      displayName: 'profile-owner',
      contactEmail: null,
      updatedAt: null,
    });
    expect(await resource.db.ownerProfile.count()).toBe(0);
    await expect(service.profile(undefined)).rejects.toMatchObject({ status: 401 });
    await expect(service.profile('another-owner')).rejects.toMatchObject({ status: 401 });
  });

  it('persists trimmed display/contact fields, preserves omitted email and explicitly clears it', /** Profile writes leave credentials, singleton and exact financial fields unchanged. */ async () => {
    const before = await resource.db.user.findUniqueOrThrow({ where: { id: ownerId } });
    const financial = await resource.db.transaction.findMany();
    const saved = await service.saveProfile('profile-owner', {
      displayName: ' Haushalt ',
      contactEmail: ' owner@example.test ',
    });
    expect(saved).toMatchObject({ userId: ownerId, displayName: 'Haushalt', contactEmail: 'owner@example.test' });
    expect(saved.updatedAt).not.toBeNull();
    expect(await service.profile('profile-owner')).toEqual(saved);
    const renamed = await service.saveProfile('profile-owner', { displayName: 'Neuer Anzeigename' });
    expect(renamed.contactEmail).toBe('owner@example.test');
    expect(
      (await service.saveProfile('profile-owner', { displayName: 'Neuer Anzeigename', contactEmail: null }))
        .contactEmail,
    ).toBeNull();
    await expect(service.saveProfile('profile-owner', { displayName: ' ' })).rejects.toThrow();
    await expect(
      service.saveProfile('profile-owner', { displayName: 'Owner', contactEmail: 'invalid' }),
    ).rejects.toThrow();
    expect(await resource.db.user.findUniqueOrThrow({ where: { id: ownerId } })).toEqual(before);
    expect(await resource.db.transaction.findMany()).toEqual(financial);
  });

  it('enforces session/CSRF, strict contact-only input and matching public runtime/OpenAPI contracts', /** Client identity, credentials and financial fields cannot be smuggled through profile metadata. */ async () => {
    const resourceApp = await createApp(resource.db, false);
    try {
      await resourceApp.app.getHttpAdapter().getInstance().ready();
      expect((await resourceApp.app.inject({ method: 'GET', url: '/api/v1/workspace/profile' })).statusCode).toBe(401);
      const login = await resourceApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: 'http://localhost:3000' },
        payload: { username: 'profile-owner', password: 'profile-test-password' },
      });
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      expect(
        (
          await resourceApp.app.inject({
            method: 'PATCH',
            url: '/api/v1/workspace/profile',
            headers: { cookie },
            payload: { displayName: 'Unauthorized save' },
          })
        ).statusCode,
      ).toBe(403);
      const headers = { cookie, origin: 'http://localhost:3000', 'x-csrf-token': login.json().csrfToken };
      for (const payload of [
        { displayName: '' },
        { displayName: 'x'.repeat(81) },
        { displayName: 'Owner', contactEmail: 'invalid' },
        { displayName: 'Owner', userId: ownerId },
        { displayName: 'Owner', username: 'new-login' },
        { displayName: 'Owner', passwordHash: 'forbidden' },
        { displayName: 'Owner', amountCents: '1' },
      ])
        expect(
          (await resourceApp.app.inject({ method: 'PATCH', url: '/api/v1/workspace/profile', headers, payload }))
            .statusCode,
        ).toBe(400);
      const response = await resourceApp.app.inject({
        method: 'PATCH',
        url: '/api/v1/workspace/profile',
        headers,
        payload: { displayName: 'API Owner', contactEmail: 'api@example.test' },
      });
      expect(response.statusCode).toBe(200);
      expect(c.workspaceProfileSchema.safeParse(response.json()).success).toBe(true);
      expect(
        (await resourceApp.app.inject({ method: 'GET', url: '/api/v1/workspace/profile', headers: { cookie } })).json(),
      ).toEqual(response.json());
      expect(
        (await resourceApp.app.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { cookie } })).json()
          .username,
      ).toBe('profile-owner');
      expect(resourceApp.openapi.paths['/api/v1/workspace/profile']?.get).toBeDefined();
      expect(resourceApp.openapi.paths['/api/v1/workspace/profile']?.patch).toBeDefined();
      expect(Object.keys(response.json()).sort()).toEqual(['contactEmail', 'displayName', 'updatedAt', 'userId']);
    } finally {
      await resourceApp.app.close();
    }
  });
});
