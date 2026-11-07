import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

describe('deployment bundle', /** Exercise the real packaging command and its immutable-image boundary. */ () => {
  /** Allocate a new ignored output, never an existing server or source directory. */
  function output() {
    mkdirSync('.local', { recursive: true });
    return mkdtempSync(resolve('.local', 'bundle-test-'));
  }
  /** Invoke the CLI with inert digest fixtures; no registry connection is needed. */
  function run(directory: string, apiDigest = `ghcr.io/mfurti/financial-tracking-api@sha256:${'a'.repeat(64)}`) {
    return spawnSync(
      process.execPath,
      [
        'scripts/package-deployment.mjs',
        '--output',
        directory,
        '--revision',
        'b'.repeat(40),
        '--api',
        apiDigest,
        '--web',
        `ghcr.io/mfurti/financial-tracking-web@sha256:${'c'.repeat(64)}`,
        '--backup',
        `ghcr.io/mfurti/financial-tracking-backup@sha256:${'d'.repeat(64)}`,
      ],
      { encoding: 'utf8', windowsHide: true },
    );
  }
  it('copies only allowlisted deployment files and refuses overwrite', /** A repository or secret must not enter an operator bundle. */ () => {
    const directory = output();
    expect(run(directory).status).toBe(0);
    expect(readdirSync(directory).sort()).toEqual(['.env.example', 'README.md', 'REVISION', 'compose.yaml'].sort());
    const env = readFileSync(resolve(directory, '.env.example'), 'utf8');
    expect(env).not.toContain('RELEASE_API_IMAGE');
    expect(env).toContain(`API_IMAGE=ghcr.io/mfurti/financial-tracking-api@sha256:${'a'.repeat(64)}`);
    expect(run(directory).status).not.toBe(0);
  });
  it('rejects mutable or foreign image references before writing', /** Tags alone cannot identify the tested production artifact. */ () => {
    const directory = output();
    expect(run(directory, 'ghcr.io/mfurti/financial-tracking-api:latest').status).not.toBe(0);
    expect(readdirSync(directory)).toEqual([]);
    expect(run(directory, `ghcr.io/other/api@sha256:${'a'.repeat(64)}`).status).not.toBe(0);
  });
});
