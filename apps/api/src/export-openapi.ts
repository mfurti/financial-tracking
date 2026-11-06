import { writeFile } from 'node:fs/promises';
import { createApp } from './app.js';

const { app, db, openapi } = await createApp(undefined, false);
try {
  await writeFile(process.env.OPENAPI_OUTPUT ?? 'openapi.json', JSON.stringify(openapi, null, 2) + '\n');
} finally {
  await app.close();
  await db.$disconnect();
}
