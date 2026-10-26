import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration (replaces the deprecated `package.json#prisma`
 * block, which Prisma 7 removes outright).
 *
 * - `schema`: points at the single schema file; the client's `output`
 *   directory itself continues to live in the schema's `generator` block
 *   (`../src/generated/prisma`).
 * - `migrations.seed`: the command `prisma migrate/seed` runs — identical
 *   to the previous `package.json#prisma.seed` value.
 *
 * `dotenv/config` loads `apps/api/.env` (DATABASE_URL etc.) because the CLI
 * stops auto-loading `.env` files once a Prisma config file is in use.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "ts-node -T -r tsconfig-paths/register prisma/seed.ts",
  },
});
