import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

describe('private deployment boundaries', /** Static configuration proof; does not claim a Docker runtime test. */ () => {
  it('publishes only private HTTPS and keeps API/database ports internal', /** Prevent accidentally exposing financial services through host mappings. */ () => {
    const config = parse(readFileSync('infrastructure/compose.yaml', 'utf8'));
    for (const [name, service] of Object.entries(config.services) as [
      string,
      { ports?: string[]; secrets?: string[] },
    ][]) {
      if (name === 'proxy') {
        expect(service.ports).toHaveLength(1);
        expect(service.ports![0]).toContain('${PRIVATE_BIND_IP:?');
        expect(service.ports![0]).toMatch(/:443:443$/);
      } else expect(service.ports).toBeUndefined();
    }
    expect(config.services.postgres.environment.POSTGRES_PASSWORD).toBeUndefined();
    expect(config.services.postgres.environment.POSTGRES_PASSWORD_FILE).toBe('/run/secrets/db_password');
    expect(config.services.backup.profiles).toBeUndefined();
    expect(config.services.api.depends_on.migrate.condition).toBe('service_completed_successfully');
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
