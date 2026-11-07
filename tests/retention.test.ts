import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
describe('backup time retention', /** Execute the actual pruning script on synthetic owned files. */ () => {
  it.skipIf(process.platform === 'win32' && !existsSync(bash))(
    'preserves a full week despite many manual backups and ignores unrelated files',
    /** File count never replaces elapsed-time retention. */ () => {
      mkdirSync('.local', { recursive: true });
      const directory = mkdtempSync(resolve('.local', 'retention-'));
      /** Give a synthetic file an explicit completion age, independent of its filename date. */
      function snapshot(name: string, days: number) {
        const path = join(directory, name);
        writeFileSync(path, 'synthetic ciphertext');
        const date = new Date(Date.now() - days * 86400_000);
        utimesSync(path, date, date);
        return path;
      }
      const weekly = snapshot('ledger-20261101T120000-1.dump.age', 6.99);
      const boundary = snapshot('ledger-20261031T000000-1.dump.age', 0);
      const midnight = new Date();
      midnight.setUTCHours(0, 0, 0, 0);
      midnight.setUTCDate(midnight.getUTCDate() - 7);
      utimesSync(boundary, midnight, midnight);
      const expired = snapshot('ledger-20261020T120000-1.dump.age', 8);
      const unrelated = snapshot('ledger-other-tool.dump.age', 20);
      const temporary = snapshot('.ledger-backup.incomplete', 20);
      for (let index = 0; index < 30; index++) snapshot(`ledger-20261107T120000-${index + 10}.dump.age`, 0);
      const result = spawnSync(bash, ['infrastructure/backup/prune-backups.sh', directory], {
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(existsSync(weekly)).toBe(true);
      expect(existsSync(boundary)).toBe(true);
      expect(existsSync(expired)).toBe(false);
      expect(existsSync(unrelated)).toBe(true);
      expect(existsSync(temporary)).toBe(true);
    },
  );
});
