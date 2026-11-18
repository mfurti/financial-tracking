import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import {
  defaultWorkspacePreferences,
  loadWorkspacePreferences,
  normalizeWorkspacePreferences,
  storeWorkspacePreferences,
  workspacePreferencesBootstrap,
  workspacePreferencesKey,
} from '../apps/web/app/utils/workspace-preferences.js';

describe('versioned device preferences', /** Device state must remain validated, private and independent of existing theme keys. */ () => {
  it('migrates legacy privacy and ordered modules without preserving unknown financial payloads', /** Exercise an actual old persisted shape, not a serialized implementation snapshot. */ () => {
    const result = normalizeWorkspacePreferences({
      language: 'en',
      hideAmounts: true,
      modules: ['reserve', 'months', 'reserve', 'unknown'],
      amountCents: '12345',
    });
    expect(result.language).toBe('en');
    expect(result.maskAmounts).toBe(true);
    expect(result.analysisModules).toEqual(['reserve', 'months']);
    expect(JSON.stringify(result)).not.toContain('12345');
    expect(JSON.stringify(result)).not.toContain('amountCents');
    expect(defaultWorkspacePreferences().analysisModules).toHaveLength(6);
  });
  it('handles missing, corrupt, unsupported and blocked storage without destroying a future version', /** Failed restore never writes a fabricated replacement over stored data. */ () => {
    expect(loadWorkspacePreferences({ getItem: /** Represent first use on a device. */ () => null }).status).toBe(
      'ready',
    );
    expect(
      loadWorkspacePreferences({ getItem: /** Return corrupt JSON without throwing on storage access. */ () => '{' })
        .status,
    ).toBe('invalid');
    expect(
      loadWorkspacePreferences({
        getItem: /** A future schema must not be overwritten during restore. */ () => '{"version":9,"language":"en"}',
      }).status,
    ).toBe('unsupported');
    expect(
      loadWorkspacePreferences({
        getItem: /** Simulate browser-level denial before parsing. */ () => {
          throw new Error('blocked');
        },
      }).status,
    ).toBe('unavailable');
  });
  it('saves only supported fields to its own key and reports persistence failure', /** Keep credentials/financial values and unrelated palette keys out of the actual storage write. */ () => {
    const writes: [string, string][] = [];
    const value = {
      ...defaultWorkspacePreferences(),
      language: 'en' as const,
      maskAmounts: true,
      secret: 'never-store',
    };
    expect(
      storeWorkspacePreferences(
        {
          setItem: /** Inspect the actual serialized storage boundary for leaked fields. */ (key, entry) => {
            writes.push([key, entry]);
          },
        },
        value,
      ),
    ).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0]![0]).toBe(workspacePreferencesKey);
    expect(writes[0]![1]).not.toContain('never-store');
    expect(
      storeWorkspacePreferences(
        {
          setItem: /** Persistence failure must remain visible to the caller. */ () => {
            throw new Error('blocked');
          },
        },
        value,
      ),
    ).toBe(false);
  });
  it('does not apply or persist unvalidated custom tone payloads', /** Custom tone UI and full contrast validation are a later owned slice, never arbitrary early CSS. */ () => {
    expect(normalizeWorkspacePreferences({ custom: { light: ['url(https://invalid.test)'] } }).custom).toBeNull();
    const writes: string[] = [];
    expect(
      storeWorkspacePreferences(
        {
          setItem: /** An invalid custom payload must never reach this write. */ (key) => {
            writes.push(key);
          },
        },
        { ...defaultWorkspacePreferences(), custom: {} },
      ),
    ).toBe(false);
    expect(writes).toHaveLength(0);
  });
  it('restores language and masking before mounting and survives storage denial', /** Execute the actual generated head script against an isolated DOM/storage boundary. */ () => {
    const document = { documentElement: { dataset: {} as Record<string, string>, lang: 'de' } };
    runInNewContext(workspacePreferencesBootstrap(), {
      document,
      localStorage: {
        getItem: /** Seed the real head script with a supported restored preference. */ () =>
          '{"version":1,"language":"en","maskAmounts":true}',
      },
    });
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dataset.amountsMasked).toBe('true');
    runInNewContext(workspacePreferencesBootstrap(), {
      document,
      localStorage: {
        getItem: /** Early script must fall back safely if storage is unavailable. */ () => {
          throw new Error('blocked');
        },
      },
    });
    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dataset.amountsMasked).toBe('false');
  });
});
