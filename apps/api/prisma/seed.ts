/**
 * Standard Prisma 7 seed entry point (`prisma db seed`).
 *
 * Registered in `prisma.config.ts` under the `migrations.seed` key, so the canonical
 * seeding command is:
 *
 *   pnpm exec prisma db seed
 *
 * Executes the idempotent seed scripts in dependency order:
 *   1. Authorization core (menus → role defaults → superadmin/admin/
 *      accountant/management first-login accounts)
 *   2. Academic results engine (grading scales → attendance slabs → users)
 *
 * Individual runnable scripts stay available:
 *   pnpm run seed:auth      (scripts/seed-authorization.ts)
 *   pnpm run seed:results   (scripts/seed-academic-results.ts)
 *
 * Environment overrides (e.g. SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD,
 * ADMIN_EMAIL / ADMIN_PASSWORD, ACCOUNTANT_EMAIL / ACCOUNTANT_PASSWORD,
 * MANAGEMENT_EMAIL / MANAGEMENT_PASSWORD) are picked up by the underlying
 * scripts via `dotenv/config`.
 */
import 'dotenv/config';
import { main as seedAuthorization } from '../scripts/seed-authorization';
import { main as seedResults } from '../scripts/seed-academic-results';

async function main(): Promise<void> {
  console.log('[db seed] (1/2) authorization core ...');
  await seedAuthorization();

  console.log('[db seed] (2/2) academic results engine ...');
  await seedResults();

  console.log('[db seed] done');
}

main().catch((err) => {
  console.error('[db seed] FAILED:', err);
  process.exit(1);
});
