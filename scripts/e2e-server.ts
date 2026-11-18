import { spawn } from 'node:child_process';
import { createApp } from '../apps/api/dist/app.js';
import { passwordHash } from '../apps/api/dist/auth.js';
import { createDb } from '../apps/api/dist/db.js';
import { testDatabase } from '../tests/database.js';
import { defaultCategories } from '../apps/api/dist/default-categories.js';
import { seedConceptFixtures } from './concept-fixtures.js';
import { conceptViewports } from './concept-viewports.js';

const empty = process.argv.includes('--empty');
// Each populated browser project owns its login limits and persisted records.
const mobile = process.argv.includes('--mobile');
const conceptArgument = process.argv.find(
  /** Only explicit supported profiles can select concept fixtures. */ (value) => value.startsWith('--concept-width='),
);
const concept = conceptViewports.find(
  /** Refuse arbitrary ports or unknown viewport profiles. */ (profile) =>
    conceptArgument === `--concept-width=${profile.width}`,
);
if (conceptArgument && !concept) throw new Error('Unsupported concept viewport');
const webPort = concept ? concept.webPort : empty ? 4322 : mobile ? 4324 : 4320,
  apiPort = webPort + 1;
process.env.PUBLIC_APP_URL = `http://localhost:${webPort}`;
process.env.NODE_ENV = 'test';
const resource = await testDatabase({ isolated: true });
await resource.db.user.create({
  data: { username: 'e2e', passwordHash: await passwordHash('e2e-test-password-only') },
});
if (empty) await resource.db.category.createMany({ data: defaultCategories });
else {
  const connection = await resource.db.bankConnection.create({
    data: { name: 'Sparkasse Bodensee', bankCode: '69050001', connectorType: 'CSV' },
  });
  const account = await resource.db.account.create({
    data: { bankConnectionId: connection.id, name: 'Sparkasse Giro' },
  });
  const category = await resource.db.category.create({ data: { name: 'Wohnen', kind: 'EXPENSE' } });
  await resource.db.transaction.createMany({
    data: [
      {
        accountId: account.id,
        amountCents: 320000n,
        bookingDate: new Date('2026-11-01'),
        description: 'Gehalt November',
        counterpartyName: 'Beispiel GmbH',
      },
      {
        accountId: account.id,
        amountCents: -105000n,
        bookingDate: new Date('2026-11-02'),
        description: 'Miete November',
        categoryId: category.id,
      },
      {
        accountId: account.id,
        amountCents: -6490n,
        bookingDate: new Date('2026-11-03'),
        description: 'Wocheneinkauf',
        counterpartyName: 'Beispielmarkt',
      },
    ],
  });
}
if (concept) await seedConceptFixtures(resource.db);
const compiledDb = createDb(resource.url);
const service = await createApp(compiledDb);
await service.app.listen(apiPort, '127.0.0.1');
const web = spawn(process.execPath, ['apps/web/.output/server/index.mjs'], {
  env: {
    ...process.env,
    PORT: String(webPort),
    HOST: '127.0.0.1',
    NUXT_API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`,
    NUXT_REQUIRE_TRUSTED_PROXY: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
web.stdout.pipe(process.stdout);
web.stderr.pipe(process.stderr);
let closing = false;
/** Stop owned child processes and the disposable database on termination. */
async function shutdown() {
  if (closing) return;
  closing = true;
  web.kill();
  await service.app.close();
  await compiledDb.$disconnect();
  await resource.close();
  process.exit(0);
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
web.once(
  'exit',
  /** Close the API/database if the owned frontend stops. */ () => {
    void shutdown();
  },
);
