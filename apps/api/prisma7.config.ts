// Prisma 7 configuration for apps/api.
//
// Prisma 7 does NOT auto-load `.env` (see prisma/prisma config docs); we import
// `dotenv/config` explicitly. The datasource URL is derived from DATABASE_URL
// when present, otherwise from the existing DB_* variables so the API only
// needs one set of DB credentials (docs/PRISMA_MIGRATION_PLAN.md AD-P10).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = encodeURIComponent(process.env.DB_USERNAME ?? 'root');
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? '');
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '3306';
  const database = process.env.DB_DATABASE ?? 'school';

  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

// Prisma Migrate needs a shadow database for `migrate dev` / `migrate diff
// --from-migrations`. Default to `<db>_shadow` on the same server; override
// with SHADOW_DATABASE_URL when the DB user lacks CREATE DATABASE rights.
function buildShadowDatabaseUrl(): string {
  if (process.env.SHADOW_DATABASE_URL) return process.env.SHADOW_DATABASE_URL;

  const base = buildDatabaseUrl();
  const url = new URL(base);
  url.pathname = `/${(process.env.DB_DATABASE ?? 'school')}_shadow`;
  return url.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // No `seed` yet: until a service is migrated to Prisma Client, seeding
    // stays with TypeORM (`pnpm seed`). Pointing at a non-existent
    // prisma/seed.ts would make `prisma db seed` fail, so it is omitted
    // deliberately (added back when the Prisma seed lands, Wave 6).
  },
  datasource: {
    url: buildDatabaseUrl(),
    shadowDatabaseUrl: buildShadowDatabaseUrl(),
  },
});
