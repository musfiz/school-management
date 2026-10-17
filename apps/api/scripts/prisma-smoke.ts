/**
 * Prisma connectivity smoke check (Wave 0).
 *
 * Verifies the Prisma 7 client + `@prisma/adapter-mariadb` can connect to the
 * same database TypeORM uses, and that both a model query (`count`) and a raw
 * query return expected results. Run: `pnpm --filter api run prisma:smoke`.
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { buildDatabaseUrl } from '../src/prisma/database-url';

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(buildDatabaseUrl(), {
      database: process.env.DB_DATABASE ?? 'school',
    }),
  });

  try {
    const userCount = await prisma.users.count();
    const journalCount = await prisma.journalEntries.count();
    const [row] = await prisma.$queryRaw<{ v: string }[]>`SELECT VERSION() AS v`;

    console.log('[prisma-smoke] connected to', row.v);
    console.log('[prisma-smoke] users =', userCount);
    console.log('[prisma-smoke] journalEntries =', journalCount);

    if (userCount === 0) {
      throw new Error('Expected seeded users but found none.');
    }
    console.log('[prisma-smoke] OK');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[prisma-smoke] FAILED:', err);
  process.exit(1);
});
