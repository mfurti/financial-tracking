import { createApp } from './app.js';

if (process.env.NODE_ENV === 'production' && !process.env.PUBLIC_APP_URL?.startsWith('https://'))
  throw new Error('Production requires an HTTPS PUBLIC_APP_URL');
const { app, db } = await createApp();
await app.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1');

/** Release application resources on termination without persisting transient credentials. */
async function shutdown() {
  await app.close();
  await db.$disconnect();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
