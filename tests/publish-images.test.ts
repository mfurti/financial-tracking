import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const revision = 'a'.repeat(40),
  digest = `sha256:${'b'.repeat(64)}`;
/** Convert only owned fixture paths for the platform's Bash PATH separator rules. */
function shellPath(path: string) {
  return process.platform === 'win32'
    ? path
        .replaceAll('\\', '/')
        .replace(
          /^([A-Za-z]):/,
          /** Git Bash names drive roots as /c, /v, and so on. */ (_match, drive: string) => `/${drive.toLowerCase()}`,
        )
    : path;
}
/** Execute the real publisher against an inert Docker CLI seam, without touching a registry. */
function run(mode = '', ref = 'refs/heads/main') {
  mkdirSync('.local', { recursive: true });
  const root = mkdtempSync(resolve('.local', 'publish-test-')),
    bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FIXTURE_LOG"
case "$1" in
 image)
  if [[ "$*" == *RepoDigests* ]]; then printf 'docker.io/library/ledger-verified-api@sha256:${'e'.repeat(64)}\\n';
  elif [[ "$FIXTURE_MODE" == mismatch ]]; then printf 'wrong-revision\\n';
  else printf '%s\\n' "$GITHUB_SHA"; fi;;
 tag) exit 0;;
 push) if [[ "$FIXTURE_MODE" == push-failure ]]; then exit 9; fi; printf 'pushed\\n';;
 buildx) if [[ "$FIXTURE_MODE" == registry-failure ]]; then exit 8; fi
  if [[ "$FIXTURE_MODE" == invalid-digest ]]; then printf '{"digest":"mutable-tag"}\\n';
  else printf '{"digest":"${digest}"}\\n'; fi;;
 *) exit 7;;
esac
`,
    { mode: 0o755 },
  );
  const result = spawnSync(bash, ['-c', 'export PATH="$FIXTURE_BIN:$PATH"; bash "$PUBLISH_SCRIPT"'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: ref,
      GITHUB_SHA: revision,
      FIXTURE_BIN: shellPath(bin),
      FIXTURE_LOG: shellPath(join(root, 'commands.log')),
      FIXTURE_MODE: mode,
      PUBLISH_SCRIPT: shellPath(resolve('scripts/publish-images.sh')),
    },
  });
  const output = join(root, '.local', 'published-images.env');
  return {
    ...result,
    env: existsSync(output) ? readFileSync(output, 'utf8') : '',
    commands: existsSync(join(root, 'commands.log')) ? readFileSync(join(root, 'commands.log'), 'utf8') : '',
  };
}

describe.skipIf(process.platform === 'win32' && !existsSync(bash))(
  'tested image publication',
  /** Verify registry-derived immutable references and existing release gates through the real shell entry point. */ () => {
    it('uses authoritative registry digests even when the first local alias is unrelated', /** Loaded artifacts can retain local repository aliases ahead of pushed names. */ () => {
      const result = run();
      expect(result.status, result.stderr).toBe(0);
      for (const service of ['api', 'web', 'backup'])
        expect(result.env).toContain(
          `${service.toUpperCase()}_IMAGE=ghcr.io/mfurti/financial-tracking-${service}@${digest}`,
        );
      expect(result.commands).not.toContain('RepoDigests');
      expect(result.commands).not.toContain('build ');
    });
    it('refuses a revision mismatch before pushing', /** Only the exact tested artifact can be published. */ () => {
      const result = run('mismatch');
      expect(result.status).not.toBe(0);
      expect(result.env).toBe('');
      expect(result.commands).not.toContain('push ');
    });
    it.each(['push-failure', 'registry-failure', 'invalid-digest'])(
      'fails closed on %s',
      /** A failed push/lookup cannot become a fabricated immutable release reference. */ (mode) => {
        const result = run(mode);
        expect(result.status).not.toBe(0);
        expect(result.env).toBe('');
      },
    );
    it('rejects feature-branch publication before touching Docker', /** PR verification must not acquire production publication semantics. */ () => {
      const result = run('', 'refs/heads/codex/test');
      expect(result.status).not.toBe(0);
      expect(result.commands).toBe('');
    });
  },
);
