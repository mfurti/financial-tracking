import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

/** Construct persistence without logging SQL parameters or financial values. */
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is required');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Prisma client owned by the application lifecycle. */
export type Db = ReturnType<typeof createDb>;
