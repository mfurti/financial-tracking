import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

describe('private deployment boundaries', /** Static configuration proof; does not claim a Docker runtime test. */ () => {
  it('uses registry images, private services and explicit health/start gates', /** Production needs no repository/build context or host mappings. */ () => {
    const config = parse(readFileSync('infrastructure/compose.yaml', 'utf8'));
    for (const [name, service] of Object.entries(config.services) as [
      string,
      { ports?: string[]; secrets?: string[] },
    ][]) {
      void name;
      expect(service.ports).toBeUndefined();
      expect(service).not.toHaveProperty('build');
    }
    expect(config.services.postgres.environment.POSTGRES_PASSWORD).toBeUndefined();
    expect(config.services.postgres.environment.POSTGRES_PASSWORD_FILE).toBe('/run/secrets/db_password');
    expect(config.services.postgres.healthcheck.test).toContain('pg_isready -h 127.0.0.1 -U ledger -d ledger');
    expect(config.services.backup.profiles).toBeUndefined();
    expect(config.services.api.depends_on.migrate.condition).toBe('service_completed_successfully');
    expect(config.services.migrate.image).toBe(config.services.api.image);
    expect(config.services.api.healthcheck.test.join(' ')).toContain('/health/ready');
    expect(config.services.web.healthcheck.test.join(' ')).toContain('/health');
    expect(config.services.web.environment.NUXT_REQUIRE_TRUSTED_PROXY).toBe('true');
    expect(config.services.web.networks.lan.ipv4_address).toContain('192.168.178.33');
    expect(config.services.api.networks).not.toHaveProperty('lan');
    expect(config.services.postgres.networks).toEqual(['private']);
    expect(config.networks.lan).toMatchObject({ external: true, name: 'FRITZBOX' });
  });
  it('requires explicit empty-target restoration and authenticated encryption', /** Operators cannot accidentally run a destructive restore over existing public tables. */ () => {
    const restore = readFileSync('infrastructure/backup/restore.sh', 'utf8');
    const backup = readFileSync('infrastructure/backup/backup.sh', 'utf8');
    expect(restore).toContain('restore-to-empty-database');
    expect(restore).toContain('information_schema.tables');
    expect(restore).toContain('--single-transaction');
    expect(backup).toContain('set -euo pipefail');
    expect(backup).toContain('age --recipients-file');
    expect(backup.indexOf('pg_dump')).toBeLessThan(backup.indexOf('mv --'));
  });
});
