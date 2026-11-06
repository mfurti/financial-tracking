import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));

if (process.env.DB_PASSWORD_FILE) {
  const url = new URL('postgresql://postgres/ledger');
  url.username = process.env.DB_USER ?? 'ledger';
  url.password = (await readFile(process.env.DB_PASSWORD_FILE, 'utf8')).trim();
  url.hostname = process.env.DB_HOST ?? 'postgres';
  url.pathname = `/${process.env.DB_NAME ?? 'ledger'}`;
  process.env.DATABASE_URL = url.href;
}
if (!process.env.DATABASE_URL) throw new Error('Database secret configuration required');
// Container bootstrap may read a root-only secret, then relinquishes privileges before application code.
if (process.getuid?.() === 0) {
  process.setgid(1000);
  process.setuid(1000);
}
const command = process.argv[2] ?? 'serve';
if (command === 'migrate') {
  const child = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  });
  process.exitCode = child.status ?? 1;
} else if (command === 'admin') {
  await import('./dist/admin.js');
} else if (command === 'openapi') {
  await import('./dist/export-openapi.js');
} else if (command === 'serve') {
  await import('./dist/main.js');
} else {
  throw new Error('Unknown operation');
}
