# Prisma ORM — Upgrade Guide: v6 → v7 (`prisma_upgrade_v7`)

> **Scope:** `apps/api` (NestJS 11 backend), Prisma schema, migration runner, and monorepo workspace configuration.  
> **Goal:** Upgrade Prisma ORM from **v6 (6.19.3)** to **v7 (7.x / 7.10.x)** from scratch following the official Prisma 7 documentation.  
> **Reference Docs:** Official Prisma 7 Upgrade Guide & Release Notes, `docs/prisma_migration_v6.md`, `docs/PRISMA_MIGRATION_PLAN.md`.

---

## 1. Summary of Prisma 7 Breaking Changes & Architectural Shifts

Prisma 7 introduces key architectural modernizations:

1. **Central Configuration File (`prisma.config.ts`)**:
   - Replaces the classic scattered configuration across `schema.prisma` and `package.json`.
   - Uses `defineConfig` from `@prisma/config`.
   - Manages datasource connection URLs, shadow database URLs, and migration seed commands.
2. **CLI `.env` Autoloading Deprecation**:
   - In Prisma 7, the CLI no longer automatically loads `.env` by default without explicit configuration.
   - In `prisma.config.ts`, importing `dotenv/config` or configuring environment variables ensures seamless `.env` resolution.
3. **Seed Configuration Relocation**:
   - The seed command moves from `package.json`'s top-level `"prisma": { "seed": "..." }` into `migrations.seed` in `prisma.config.ts`.
4. **Generator Provider Modernization (`prisma-client`)**:
   - `provider = "prisma-client-js"` is superseded by `provider = "prisma-client"`.
   - Client engine is standard (no separate binary Rust query engine runtime), so explicit `engineType = "client"` in `schema.prisma` is redundant.
5. **CLI Migration Differ Flag Renamed**:
   - `prisma migrate diff`: `--from-schema-datasource` is renamed to `--from-config-datasource`.
6. **Driver Adapter Compatibility**:
   - `@prisma/adapter-mariadb`, `@prisma/client`, and `prisma` must be aligned on the same v7 release line.

---

## 2. Complete Repository Impact Matrix

| File Path | Action | Description of Changes |
|---|---|---|
| **`apps/api/prisma.config.ts`** | **CREATE** | New Prisma 7 config file with `defineConfig`, datasource URLs, and seed script definition. |
| **`apps/api/package.json`** | **MODIFY** | Upgrade `prisma`, `@prisma/client`, and `@prisma/adapter-mariadb` to `^7.10.1`. Add `@prisma/config`. Remove legacy `"prisma": { "seed": ... }`. |
| **`pnpm-workspace.yaml`** | **MODIFY** | Bump `minimumReleaseAgeExclude` versions for `@prisma/*` packages to match v7. |
| **`apps/api/prisma/schema.prisma`** | **MODIFY** | Update `generator client` to `provider = "prisma-client"`, remove `engineType = "client"`. |
| **`apps/api/scripts/db-migrate.ts`** | **MODIFY** | Update `migrate diff` calls: replace `--from-schema-datasource` with `--from-config-datasource`. |
| **`apps/api/tsconfig.json`** | **MODIFY** | Add `"prisma.config.ts"` to `"exclude"` so NestJS compilation does not fail on non-src root files. |
| **`apps/api/src/prisma/prisma.service.ts`** | **MODIFY** | Update JSDoc header comments from Prisma 6 to Prisma 7. Runtime adapter stays intact. |
| **`apps/api/scripts/prisma-smoke.ts`** | **MODIFY** | Update comments referencing Prisma 6 to Prisma 7. |
| **`apps/api/prisma/seed.ts`** | **MODIFY** | Update documentation header referencing Prisma 6 to Prisma 7. |
| **`apps/api/prisma/README.md`** | **MODIFY** | Update architectural tables, seed execution details, and configuration references to Prisma 7. |

---

## 3. Detailed File Diffs & Specifications

### 3.1. `apps/api/prisma.config.ts` (NEW FILE)

Create `apps/api/prisma.config.ts`:

```ts
import 'dotenv/config';
import { defineConfig } from '@prisma/config';
import {
  buildDatabaseUrl,
  buildShadowDatabaseUrl,
} from './src/prisma/database-url';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: buildDatabaseUrl(),
    shadowDatabaseUrl: buildShadowDatabaseUrl(),
  },
  migrations: {
    seed: 'ts-node -T -r tsconfig-paths/register prisma/seed.ts',
  },
});
```

---

### 3.2. `apps/api/package.json`

#### Changes:
1. Update dependency versions:
   ```json
   "dependencies": {
     "@prisma/adapter-mariadb": "^7.10.1",
     "@prisma/client": "^7.10.1"
   }
   ```
2. Update devDependencies:
   ```json
   "devDependencies": {
     "@prisma/config": "^7.10.1",
     "prisma": "^7.10.1"
   }
   ```
3. Remove the legacy seed configuration block (moved to `prisma.config.ts`):
   ```diff
   -  "prisma": {
   -    "seed": "ts-node -T -r tsconfig-paths/register prisma/seed.ts"
   -  }
   ```

---

### 3.3. `pnpm-workspace.yaml`

Update the version excludes in `pnpm-workspace.yaml` to allow v7:

```diff
  minimumReleaseAgeExclude:
-   - '@prisma/config@6.19.3'
-   - '@prisma/debug@6.19.3'
-   - '@prisma/engines@6.19.3'
-   - '@prisma/fetch-engine@6.19.3'
-   - '@prisma/get-platform@6.19.3'
-   - prisma@6.19.3
-   - '@prisma/client@6.19.3'
-   - '@prisma/adapter-mariadb@6.19.3'
-   - '@prisma/driver-adapter-utils@6.19.3'
+   - '@prisma/config@^7.10.1'
+   - '@prisma/debug@^7.10.1'
+   - '@prisma/engines@^7.10.1'
+   - '@prisma/fetch-engine@^7.10.1'
+   - '@prisma/get-platform@^7.10.1'
+   - 'prisma@^7.10.1'
+   - '@prisma/client@^7.10.1'
+   - '@prisma/adapter-mariadb@^7.10.1'
+   - '@prisma/driver-adapter-utils@^7.10.1'
    - ts-jest@29.4.15
```

---

### 3.4. `apps/api/prisma/schema.prisma`

Update generator definition and remove datasource URLs (Prisma 7 error P1012):

```diff
  generator client {
-   provider   = "prisma-client-js"
+   provider   = "prisma-client"
    output     = "../src/generated/prisma"
-   engineType = "client"
  }

  datasource db {
    provider          = "mysql"
-   url               = env("DATABASE_URL")
-   shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
  }
```

*Note: In Prisma 7, connection URLs are forbidden in `schema.prisma` and must be defined in `prisma.config.ts` (`datasource.url` and `datasource.shadowDatabaseUrl`). Models, fields, mappings, and relations in `schema.prisma` remain 100% unchanged.*

---

### 3.5. `apps/api/scripts/db-migrate.ts`

Update `--from-schema-datasource` flags to `--from-config-datasource`:

```diff
@@ line 380:
-      ['migrate', 'diff', '--from-schema-datasource', '--to-migrations', baseSubset, '--script'],
+      ['migrate', 'diff', '--from-config-datasource', '--to-migrations', baseSubset, '--script'],

@@ line 405:
-          ['migrate', 'diff', '--from-schema-datasource', '--to-migrations', baseSubset, '--exit-code', '--script'],
+          ['migrate', 'diff', '--from-config-datasource', '--to-migrations', baseSubset, '--exit-code', '--script'],
```

---

### 3.6. `apps/api/tsconfig.json`

Exclude `prisma.config.ts` from NestJS build compilation:

```diff
  "exclude": [
    "node_modules",
    "dist",
    "prisma",
+   "prisma.config.ts",
    "scripts",
    "**/*.spec.ts",
    "test",
    "src/generated"
  ]
```

---

### 3.7. Comment and Doc Alignments

1. **`apps/api/src/prisma/prisma.service.ts`**:
   Update JSDoc comment:
   ```diff
   - * Application-wide Prisma Client (Prisma ORM 6).
   - * Generated with `engineType = "client"` (GA since Prisma 6.16.0)...
   + * Application-wide Prisma Client (Prisma ORM 7).
   + * Generated with `provider = "prisma-client"`...
   ```
2. **`apps/api/scripts/prisma-smoke.ts`**:
   Update header comments from Prisma 6 to Prisma 7.
3. **`apps/api/prisma/seed.ts`**:
   Update header comments explaining that `prisma db seed` uses `migrations.seed` from `prisma.config.ts`.
4. **`apps/api/prisma/README.md`**:
   Update Section 1 architecture table and Section 10 seed documentation to reflect Prisma 7 and `prisma.config.ts`.

---

## 4. Step-by-Step Upgrade Execution Procedure

Follow these ordered steps to execute the upgrade in your environment:

### Step 1: Update Dependencies
In `apps/api/package.json` and `pnpm-workspace.yaml`, update the package versions, then run from the root:
```bash
pnpm install
```

### Step 2: Create Configuration File
Create `apps/api/prisma.config.ts` with datasource and migration seed configuration as detailed in §3.1.

### Step 3: Update `schema.prisma`
Change `provider = "prisma-client"` and remove `engineType = "client"` in `apps/api/prisma/schema.prisma`.

### Step 4: Update Migration Script & TsConfig
- Replace `--from-schema-datasource` with `--from-config-datasource` in `apps/api/scripts/db-migrate.ts`.
- Add `"prisma.config.ts"` to `exclude` in `apps/api/tsconfig.json`.
- Remove `"prisma": { "seed": ... }` from `apps/api/package.json`.

### Step 5: Regenerate Prisma Client
```bash
pnpm run prisma:generate
```
Ensure `apps/api/src/generated/prisma/client.ts` compiles cleanly.

### Step 6: Verify Database Connectivity & Status
```bash
pnpm run prisma:status
pnpm run prisma:smoke
```

### Step 7: Verify Reversible Migration Engine
```bash
pnpm run db:migrate:status
```

### Step 8: Run Test Suite & Build
```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter api test
pnpm run build
```

---

## 5. Verification Checklist

- [ ] `pnpm --filter api exec prisma validate` succeeds.
- [ ] `pnpm run prisma:generate` generates TypeScript client into `src/generated/prisma`.
- [ ] `pnpm run prisma:status` successfully reads database connection from `prisma.config.ts`.
- [ ] `pnpm run prisma:smoke` connects and validates query execution with `@prisma/adapter-mariadb`.
- [ ] `pnpm run db:migrate:status` connects and reports migration history with 0 checksum drift.
- [ ] `pnpm --filter api exec tsc --noEmit` reports 0 TypeScript compiler errors.
- [ ] `pnpm run build` produces production bundle without configuration conflicts.
