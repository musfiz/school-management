# Prisma ORM — Rollback Plan: v7 → v6 (`prisma_migration_v6`)

> **Scope:** `apps/api` only. **Goal:** remove every Prisma 7–specific config/behavior
> and run the exact same schema + driver-adapter architecture on **Prisma ORM 6**
> (pinned `6.19.3` — the last stable 6.x release before the 7.x line).
> **Out of scope:** the TypeORM → Prisma strangler migration itself
> (`docs/PRISMA_MIGRATION_PLAN.md`) is unaffected; this is a *version* rollback
> of the ORM tooling, not a re-litigation of using Prisma.

---

## 1. Why this is a small, surgical change

Prisma 7's headline changes vs. 6 are: (a) no `.env` autoloading in the CLI —
replaced by a mandatory `prisma.config.ts`, (b) the `prisma-client` generator
(TS-split output, `engineType`/`moduleFormat`/`runtime` options) became the
*default and only* generator, and (c) `migrate diff` renamed
`--from-schema-datasource` → `--from-config-datasource`.

Crucially, **(b) is not v7-only**: the `prisma-client` generator (and its
Rust-engine-free `engineType = "client"` mode) has been **Generally Available
since Prisma 6.16.0** — it is simply *optional* in 6.x and *mandatory* in 7.x.
That means this repo's existing generator block, generated-client import paths
(`generated/prisma/client`), `PrismaService`, and both `$extends` extensions
**do not need to change at all**. The only real v7-only pieces are:

1. `prisma7.config.ts` (the config-file concept itself, and its `datasource`/
   `migrations.seed` fields).
2. The `--from-config-datasource` flag in `scripts/db-migrate.ts`.
3. Version pins (`7.10.1` → `6.19.3`) in `package.json` / `pnpm-workspace.yaml`.
4. Doc/comment references to "Prisma 7".

## 2. Target architecture (after this change)

| Concern | v7 (before) | v6 (after) |
| --- | --- | --- |
| Config file | `apps/api/prisma7.config.ts` (`defineConfig`) | **none** — classic `schema.prisma` + `package.json` |
| Datasource URL | Computed in `prisma7.config.ts` from `DB_*` | Literal `url = env("DATABASE_URL")` in `schema.prisma`; `.env` must set `DATABASE_URL` (CLI auto-loads `.env`, unlike v7) |
| Shadow DB URL | Computed in `prisma7.config.ts` | Literal `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")` in `schema.prisma` |
| Seed command | `migrations.seed` in `prisma7.config.ts` | `"prisma": { "seed": "..." }` in `package.json` (classic, pre-config-file mechanism) |
| Generator | `provider = "prisma-client"`, no `engineType` (default/only mode in v7) | Same generator, **+ `engineType = "client"`** (opt-in GA no-Rust-engine mode since 6.16.0) |
| Generated client import | `../generated/prisma/client` | **unchanged** |
| `PrismaService` / extensions | driver adapter, `$extends` chain | **unchanged** |
| `migrate diff` flag | `--from-config-datasource` | `--from-schema-datasource` |
| Pinned versions | `prisma@7.10.1`, `@prisma/client@7.10.1`, `@prisma/adapter-mariadb@7.10.1` | `prisma@6.19.3`, `@prisma/client@6.19.3`, `@prisma/adapter-mariadb@6.19.3` |

## 3. Step-by-step plan

1. **Delete** `apps/api/prisma7.config.ts`.
2. **`apps/api/prisma/schema.prisma`**
   - `datasource db`: add `url = env("DATABASE_URL")` and
     `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")`.
   - `generator client`: add `engineType = "client"` (keeps the no-Rust-engine,
     driver-adapter-only behavior the app already relies on).
3. **`apps/api/.env` / `.env.example`**: make `DATABASE_URL` / `SHADOW_DATABASE_URL`
   literal, required values (classic Prisma 6 CLI reads them straight from
   `.env` via its own auto-load — no config file involved). `DB_*` vars are
   kept as-is; they remain the source of truth for the NestJS app's own runtime
   adapter config (`src/prisma/database-url.ts`, unaffected by this change).
4. **`apps/api/package.json`**
   - `devDependencies.prisma`: `7.10.1` → `6.19.3`.
   - `dependencies["@prisma/client"]` / `["@prisma/adapter-mariadb"]`: → `6.19.3`.
   - Add top-level `"prisma": { "seed": "ts-node -T -r tsconfig-paths/register prisma/seed.ts" }`.
5. **`apps/api/tsconfig.json`**: drop the now-nonexistent `prisma7.config.ts`
   exclude entry.
6. **`apps/api/scripts/db-migrate.ts`**: `--from-config-datasource` →
   `--from-schema-datasource` (both call sites).
7. **`apps/api/prisma/seed.ts`**, **`apps/api/scripts/prisma-smoke.ts`**,
   **`apps/api/src/prisma/prisma.service.ts`**,
   **`apps/api/src/academic-results/common/mapper.util.ts`**: update comments
   that assert "Prisma 7" behavior to describe the v6 + `engineType: "client"`
   reality instead. No logic changes.
8. **Docs**: `apps/api/prisma/README.md`, root `README.md`,
   `docs/RESULT_ENGINE_EXECUTION_PLAN.md`, `docs/PRISMA_MIGRATION_PLAN.md` —
   replace version numbers / config-file references / CLI flags that are now
   wrong. `PRISMA_MIGRATION_PLAN.md` is a historical decision log; it gets a
   short correction note at the superseded spots rather than a rewrite.
9. **`pnpm-workspace.yaml`**: `minimumReleaseAgeExclude` entries bumped to
   `6.19.3` (drop `@prisma/client-runtime-utils`, which doesn't exist pre-7).
10. **Install + verify**: `pnpm install`, `prisma generate`, `tsc --noEmit`,
    `prisma migrate status` / `prisma-smoke`, run the Jest suite.

## 4. Explicitly NOT changing

- `schema.prisma` models, mappings, migrations SQL — untouched.
- `src/generated/prisma/**` import paths across the ~30 service files that
  `import { Prisma, PrismaClient, ... } from '.../generated/prisma/client'`.
- `PrismaService`'s driver-adapter wiring, `passwordHashingExtension`,
  `wireFormatExtension`, `lock.ts` (pessimistic locks).
- `docs/PRISMA_MIGRATION_PLAN.md`'s TypeORM→Prisma architectural decisions
  (AD-P7/P8/P10/P13) — still valid under v6.

## 5. Verification checklist

- [ ] `pnpm --filter api exec prisma validate` passes.
- [ ] `pnpm --filter api run prisma:generate` regenerates
      `src/generated/prisma/client` with no Rust engine binary downloaded.
- [ ] `pnpm --filter api run prisma:status` / `db:migrate:status` connects and
      reports migration state (proves `DATABASE_URL` resolution works without
      a config file).
- [ ] `pnpm --filter api exec tsc --noEmit` — no type errors.
- [ ] `pnpm --filter api test` — full Jest suite green.
- [ ] `pnpm --filter api run prisma:smoke` — live DB round trip (requires a
      reachable database; run manually if the sandbox has none).
