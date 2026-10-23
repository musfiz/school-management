# Prisma ORM & Database Migration Guide (`apps/api`)

Complete reference and step-by-step operating guide for database schemas, reversible migrations, deployment, rollback procedures, recovery from failure states, and Prisma 7 driver-adapter runtime operations in this repository.

All commands documented below are executed from the **`apps/api/`** directory.

---

## 1. Architecture & Core Specifications

| Component | Specification | Description |
|---|---|---|
| **ORM Engine** | **Prisma 7** (`7.10.1`) | Driver-adapter architecture (no binary Rust query engine runtime) |
| **Database Driver** | `@prisma/adapter-mariadb` + `mariadb` | High-performance native JavaScript driver connecting to MySQL / MariaDB |
| **Schema Source** | `apps/api/prisma/schema.prisma` | Single declarative source of truth for database entities and relations |
| **Generated Client** | `apps/api/src/generated/prisma/` | Generated TypeScript client (rebuilt on migration; never edit manually) |
| **Migration Directory** | `apps/api/prisma/migrations/` | Timestamped directories with paired `migration.sql` (up) and `down.sql` (down) |
| **Migration Engine** | `apps/api/scripts/db-migrate.ts` | Reversible migration manager enforcing symmetric up/down scripts & scratch DB verification |
| **Session Timezone** | UTC (`+00:00`) | Every connection automatically executes `SET time_zone = '+00:00'` (`src/prisma/database-url.ts`) |
| **Runtime Service** | `src/prisma/prisma.service.ts` | NestJS injectable provider wrapping Prisma client extensions |

### Runtime Client Extensions

Every query routed through `PrismaService` automatically benefits from two global extensions:

1. **`passwordHashingExtension`**: Automatically hashes plaintext strings in `users.password` on `create`, `update`, `upsert`, and `$transaction`. Never manually bcrypt passwords at call sites or in seed scripts.
2. **`wireFormatExtension`**: Emulates legacy TypeORM serialization formats (`Decimal` to string `"1250.00"`, `Date` to `"YYYY-MM-DD"`, and camelCase to snake_case mapping via `toWire()` / `toWireList()`).

---

## 2. Directory Layout

```
apps/api/
├── prisma/
│   ├── README.md                                  ← This guide
│   ├── schema.prisma                              ← Canonical schema definition
│   └── migrations/
│       ├── 20261016000000_init/
│       │   ├── migration.sql                      ← Up script (applies baseline)
│       │   └── down.sql                           ← Down script (reverses baseline)
│       ├── 20261023150000_add_custom_actions/
│       │   ├── migration.sql                      ← Up script
│       │   └── down.sql                           ← Down script
│       └── migration_lock.toml                    ← Lock file tracking provider & engine
├── scripts/
│   ├── db-migrate.ts                              ← Reversible migration & rollback engine
│   ├── prisma-smoke.ts                            ← Connection healthcheck script
│   ├── seed-authorization.ts                      ← Authorization, menus & superadmin seed
│   └── seed-academic-results.ts                   ← Academic results engine seed
└── src/
    ├── generated/prisma/                          ← Auto-generated Prisma client (git-ignored)
    └── prisma/
        ├── prisma.service.ts                      ← Injected NestJS service
        ├── prisma.module.ts                       ← Global NestJS module
        ├── database-url.ts                        ← Connection URL builder & UTC session setup
        ├── password-hashing.extension.ts          ← Automatic bcrypt password hashing
        └── wire.extension.ts / wire.ts            ← Legacy TypeORM JSON serialization helper
```

---

## 3. Environment Variables Configuration

Configure these parameters in `apps/api/.env` (refer to `.env.example`). The connection URL is built automatically unless an explicit `DATABASE_URL` is provided:

| Variable | Description | Default | Notes |
|---|---|---|---|
| `DB_HOST` | Database host | `localhost` | MySQL/MariaDB server host |
| `DB_PORT` | Database port | `3306` | Default port |
| `DB_USERNAME` | Database username | `root` | Must have table DDL privileges |
| `DB_PASSWORD` | Database password | *(empty)* | Password for DB user |
| `DB_DATABASE` | Primary database name | `school` | Production & dev database |
| `DATABASE_URL` | Explicit connection URL | *(derived)* | Example: `mysql://root:pass@localhost:3306/school` |
| `SHADOW_DATABASE_URL` | Shadow DB for Prisma differ | *(derived)* | Defaults to `<DB_DATABASE>_shadow`. Required if user cannot `CREATE DATABASE`. |

> **Note on Shadow Database:** `prisma migrate diff` and `db:migrate:new` require a shadow database to calculate schema diffs. If your database user lacks `CREATE DATABASE` privilege, create a separate database named `school_shadow` and set `SHADOW_DATABASE_URL="mysql://user:pass@localhost:3306/school_shadow"` in `.env`.

---

## 4. Complete Command Reference

### Reversible Migration Commands (`scripts/db-migrate.ts`)

| Command | Action | Description |
|---|---|---|
| `npm run db:migrate` | **Up / Apply** | Verifies checksums, checks for failed migrations, runs `prisma migrate deploy`, regenerates client. |
| `npm run db:migrate:new -- --name <slug>` | **Author New** | Generates paired `migration.sql` + `down.sql`, verifies round-trip reversibility on scratch DB. |
| `npm run db:rollback` | **Rollback (1 step)** | Executes `down.sql` of newest applied migration, deletes history row, regenerates client. |
| `npm run db:rollback -- --steps=N` | **Rollback (N steps)** | Rolls back the last `N` applied migrations sequentially. |
| `npm run db:rollback -- --dry-run` | **Preview Rollback** | Lists statements that would execute during rollback without modifying DB. |
| `npm run db:migrate:status` | **Status** | Displays status table of applied, pending, and rolled-back migrations with checksum checks. |
| `npm run db:migrate:repair -- <name> --applied` | **Repair (Applied)** | Resolves a failed migration by recording it as successfully applied. |
| `npm run db:migrate:repair -- <name> --rolled-back` | **Repair (Rolled Back)** | Resolves a failed migration by marking it rolled back so it can be re-applied. |

### Standard Prisma CLI Commands

| Command | Action | Description |
|---|---|---|
| `npm run prisma:generate` | **Generate Client** | Regenerates TypeScript client into `src/generated/prisma`. Run after schema changes. |
| `npm run prisma:deploy` | **Deploy (Native)** | Runs raw `prisma migrate deploy` directly against the database. |
| `npm run prisma:status` | **Status (Native)** | Runs native Prisma CLI migration status check. |
| `npm run prisma:studio` | **Prisma Studio** | Launches browser GUI at `http://localhost:5555` to browse/edit database records. |
| `npm run prisma:pull` | **Introspect DB** | Introspects existing DB structure back into `schema.prisma` (**overwrites file**). |
| `npm run prisma:smoke` | **Smoke Check** | Executes connection sanity test (`scripts/prisma-smoke.ts`). |
| `npx prisma migrate reset` | **Reset (Dev Only)** | ⚠️ Drops schema, recreates DB, re-runs all migrations from scratch. Dev only! |

---

## 5. Step-by-Step Guide: Creating a Reversible Migration

Every database modification in this repository **must be reversible**. That means every migration folder must contain both:
- `migration.sql` (applies the schema changes)
- `down.sql` (completely reverses the changes back to the exact prior state)

The automated script `npm run db:migrate:new` guarantees this contract.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 REVERSIBLE MIGRATION AUTHORING WORKFLOW                  │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. Edit schema.prisma                                                    │
│ 2. npm run db:migrate:new -- --name <slug>                               │
│    ├── Validates working tree                                            │
│    ├── Generates migration.sql via prisma migrate diff                   │
│    ├── Materializes scratch DB (school_migrate_verify)                   │
│    ├── Generates symmetric down.sql via reverse diff                    │
│    └── Reversibility test: replay all -> up -> down -> check for 0 drift │
│ 3. Review migration.sql & down.sql                                       │
│ 4. npm run db:migrate (apply to local DB)                                │
│ 5. Commit migration folder, migration_lock.toml, and schema.prisma       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Update `schema.prisma`

Make your declarative changes in `apps/api/prisma/schema.prisma`.
Follow repository conventions:
- Model names are `PascalCase` (e.g., `ExamSubjectComponent`).
- Table names are `snake_case` using `@@map("table_name")`.
- Column names are `snake_case` in DB using `@map("column_name")`.

### Step 2: Author the Reversible Migration

Run the generator script with a descriptive snake_case name:

```bash
npm run db:migrate:new -- --name add_custom_actions_to_menu_permissions
```

**What the script executes behind the scenes:**
1. Checks that your migration directory is clean and in sync with `migration_lock.toml`.
2. Computes the forward SQL diff (`migration.sql`).
3. Creates a temporary scratch database (e.g. `school_migrate_verify`).
4. Replays all existing migrations into the scratch database, followed by the new `migration.sql`.
5. Calculates the exact reverse SQL (`down.sql`) using a live DB-to-DB symmetric comparison.
6. Applies `down.sql` on the scratch DB and verifies that the resulting schema matches the pre-migration baseline with **zero drift**.
7. Cleans up scratch databases and temporary files.

### Step 3: Inspect the Generated SQL Files

Check the newly created folder under `apps/api/prisma/migrations/<timestamp>_<name>/`:
- Inspect `migration.sql`: Verify table creations, column alterations, indexes, foreign keys.
- Inspect `down.sql`: Verify `DROP TABLE`, `DROP COLUMN`, or `MODIFY` statements reverse the changes cleanly.

### Step 4: Apply to Local Development Database

Apply the verified migration to your active database:

```bash
npm run db:migrate
```

This applies the SQL, registers the migration in `_prisma_migrations`, and automatically runs `prisma generate` to update the TypeScript client in `src/generated/prisma`.

### Step 5: Commit to Git

Commit the full set of synchronized files together:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`
- `apps/api/prisma/migrations/<timestamp>_<name>/down.sql`
- `apps/api/prisma/migrations/migration_lock.toml`

---

## 6. Step-by-Step Guide: Deploying Migrations

### In Development & Staging

When pulling new commits created by teammates:

```bash
# 1. Pull latest code
git pull origin main

# 2. Apply all pending migrations safely
npm run db:migrate

# 3. Verify status
npm run db:migrate:status
```

### In Production / CI Pipelines

`npm run db:migrate` is safe for CI/CD and production environments because:
1. It verifies all committed migration files against checksums in `_prisma_migrations`.
2. It blocks execution if any failed migration is detected in the database.
3. It uses `prisma migrate deploy`, which **never prompts for input and never resets or drops tables**.
4. It regenerates the Prisma client immediately after execution.

In deployment Dockerfiles or CI deployment steps:
```bash
# Inside apps/api
npm run db:migrate
```

---

## 7. Step-by-Step Guide: Rolling Back Migrations

When a migration introduces an issue or a deployment needs to be reverted, use the rollback engine (`npm run db:rollback`).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ROLLBACK EXECUTION FLOW                          │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. npm run db:rollback -- --dry-run                                      │
│    └── Previews target migration and SQL statements                      │
│ 2. npm run db:rollback [--steps=N]                                       │
│    ├── Reads newest applied migration from _prisma_migrations            │
│    ├── Refuses baseline migration (protects base schema from drop)       │
│    ├── Executes statements in down.sql                                   │
│    ├── Deletes migration record from _prisma_migrations table            │
│    └── Re-runs prisma generate to sync TypeScript client                 │
│ 3. Reconcile schema.prisma (git checkout or prisma db pull)              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Preview the Rollback (Dry Run)

Always test with `--dry-run` first to see which migration will be targeted and what statements will execute:

```bash
npm run db:rollback -- --dry-run
```

Output example:
```
[migrate] rollback plan: 20261023150000_add_custom_actions_to_menu_permissions
  --dry-run: 20261023150000_add_custom_actions_to_menu_permissions → 3 statement(s), first:
      ALTER TABLE `menu_user_permissions` DROP COLUMN `custom_actions`
[migrate] dry-run complete (nothing executed)
```

### Step 2: Execute the Rollback

To roll back the single most recently applied migration:

```bash
npm run db:rollback
```

To roll back multiple applied migrations in reverse chronological order:

```bash
npm run db:rollback -- --steps=2
```

### Step 3: Reconcile `schema.prisma`

> ⚠️ **CRITICAL STEP:** `db:rollback` reverses the database tables, but your local `apps/api/prisma/schema.prisma` file still contains the updated models!

Choose one of two reconciliation methods:
1. **If you are discarding the change entirely:**
   ```bash
   # Revert schema.prisma to the git commit state
   git checkout -- prisma/schema.prisma
   npm run prisma:generate
   ```
2. **If you want Prisma to sync from the current rolled-back database:**
   ```bash
   npm run prisma:pull
   npm run prisma:generate
   ```

### Safety Protections Built into Rollback:
- **Baseline Protection:** The engine will **refuse** to roll back `20261016000000_init`. Attempting to do so would drop every table in the database.
- **Missing `down.sql` Blocker:** The engine aborts before executing if any migration targeted for rollback lacks a `down.sql` file.
- **Re-appliable State:** The history row is deleted from `_prisma_migrations`, leaving the database clean so that running `npm run db:migrate` later will re-apply the migration cleanly.

---

## 8. Step-by-Step Guide: Repairing Failed Migrations

If a migration fails midway during execution (e.g. syntax error, data truncation, or duplicate table error), Prisma marks the migration as **failed** in `_prisma_migrations` (`finished_at IS NULL`). Prisma will refuse to apply any subsequent migrations until the failure state is resolved.

### Diagnostic Flowchart

```
                          MIGRATION FAILED (Error P3018)
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
     Partial DB changes exist                             SQL failed completely
 (Tables created / columns modified)                     (No changes persisted)
             │                                                     │
 ┌───────────┴───────────┐                       ┌─────────────────┴─────────────────┐
 │ Option A: Complete it │                       │ Option B: Clean up and retry      │
 ├───────────────────────┤                       ├───────────────────────────────────┤
 │ 1. Fix data/run SQL   │                       │ 1. Drop partial tables (if any)   │
 │    manually in MySQL  │                       │ 2. npm run db:migrate:repair --   │
 │ 2. npm run            │                       │    <name> --rolled-back           │
 │    db:migrate:repair  │                       │ 3. Fix migration.sql file         │
 │    -- <name> --applied│                       │ 4. npm run db:migrate             │
 └───────────────────────┘                       └───────────────────────────────────┘
```

---

### Scenario 1: MySQL Error 1265 ("Data truncated for column")

**Symptom:**
```
Error: P3018
A migration failed to apply.
Migration name: 20261017135221_create_result_engine_tables
Database error code: 1265
Database error: Data truncated for column 'role' at row 1
```

**Cause:**
An `ALTER TABLE users MODIFY role ENUM(...)` was executed, but existing database rows held values (e.g. `'superadmin'`) omitted from the new ENUM definition.

**Recovery Steps:**
1. Open the migration file: `prisma/migrations/<name>/migration.sql`.
2. Correct the query to include all active database values:
   ```sql
   ALTER TABLE `users` MODIFY `role` ENUM('superadmin', 'admin', 'management', 'accountant', 'teacher', 'student', 'guardian', 'exam_controller') NOT NULL DEFAULT 'student';
   ```
3. Mark the failed migration as rolled-back:
   ```bash
   npm run db:migrate:repair -- 20261017135221_create_result_engine_tables --rolled-back
   ```
4. Re-run deployment:
   ```bash
   npm run db:migrate
   ```

---

### Scenario 2: MySQL Error 1050 ("Table already exists")

**Symptom:**
```
Error: P3018
Database error code: 1050
Database error: Table 'attendance_mark_slabs' already exists
```

**Cause:**
A migration failed on query #2 or later, but query #1 already created `attendance_mark_slabs`. Alternatively, the table was created manually or in a previous run.

**Recovery Steps:**

**Approach A (If the table and schema were already created successfully):**
If you verified the tables exist and match the migration intent, tell Prisma it has been applied:
```bash
npm run db:migrate:repair -- 20261017135221_create_result_engine_tables --applied
```
Then proceed with:
```bash
npm run db:migrate
```

**Approach B (If you want a clean re-run):**
1. Connect to MySQL and drop the partially created tables:
   ```sql
   DROP TABLE IF EXISTS `attendance_mark_slabs`;
   ```
2. Mark the migration as rolled back:
   ```bash
   npm run db:migrate:repair -- 20261017135221_create_result_engine_tables --rolled-back
   ```
3. Re-run migration deployment:
   ```bash
   npm run db:migrate
   ```

---

### Scenario 3: Error P3008 ("Migration is already recorded as applied")

**Symptom:**
```
Error: P3008
The migration 20261017135221_create_result_engine_tables is already recorded as applied in the database.
```

**Cause:**
You ran `prisma migrate resolve --applied <migration>` on a migration that is already marked as completed in `_prisma_migrations` (`finished_at IS NOT NULL`).

**Recovery Steps:**
You do not need to resolve it. Simply check the status or continue deployment:
```bash
npm run db:migrate:status
npm run db:migrate
```

---

### Scenario 4: Database Drift / Resetting Dev Database

If a local development database drifts heavily due to test experimentation, manual SQL changes, or broken state:

```bash
# ⚠️ DEV ONLY: Drops database, recreates, runs all migrations from scratch
npx prisma migrate reset

# Re-run standard seeders
npx ts-node -T -r tsconfig-paths/register scripts/seed-authorization.ts
npm run seed:results
```

---

## 9. Safe Schema Migration Patterns (MySQL / MariaDB Gotchas)

### 1. Modifying ENUM Columns
In MySQL/MariaDB, modifying an `ENUM` requires re-specifying the entire list of values.
- **Rule:** Never remove or rename an ENUM value while rows in the table hold that value.
- **Always verify:** Check existing distinct values before writing the migration:
  ```sql
  SELECT DISTINCT role FROM users;
  ```

### 2. Adding `NOT NULL` Columns to Existing Tables
Adding a `NOT NULL` column without a `DEFAULT` to a table with existing rows causes migration failure or populates empty zero-values in non-strict modes.
- **Safe Pattern:** Provide a sensible `DEFAULT` in Prisma:
  ```prisma
  isActive Boolean @default(true) @map("is_active")
  ```
- **Two-phase Pattern (For columns requiring calculated data):**
  1. Add column as nullable (`String?`).
  2. Run data backfill script.
  3. Alter column to `NOT NULL` in a subsequent migration.

### 3. Renaming Tables or Columns
By default, Prisma's differ interprets a renamed field as `DROP COLUMN old` + `ADD COLUMN new`, resulting in **immediate data loss**.
- When renaming a field in `schema.prisma`, inspect the generated `migration.sql`.
- Replace the `DROP` + `ADD` with MySQL's rename syntax:
  ```sql
  -- Safe rename in MySQL 8 / MariaDB 10.5+
  ALTER TABLE `users` RENAME COLUMN `old_name` TO `new_name`;
  ```

---

## 10. Seeding & Verification

All seed scripts live in `apps/api/scripts/`. They are designed to be **idempotent** (safe to run multiple times without creating duplicate records or throwing primary key conflicts).

| Target | Command | Purpose |
|---|---|---|
| **Authorization Core** | `npx ts-node -T -r tsconfig-paths/register scripts/seed-authorization.ts` | Seeds 10 system menus, role default permissions, and default SuperAdmin (`superadmin@school.com` / `SuperAdmin@123`). |
| **Custom SuperAdmin Credentials** | `SUPERADMIN_EMAIL=admin@domain.com SUPERADMIN_PASSWORD=SecretPassword! npx ts-node -T -r tsconfig-paths/register scripts/seed-authorization.ts` | Overrides default SuperAdmin credentials via environment variables during seeding. |
| **Academic Results Engine** | `npm run seed:results` | Populates grading scales, exam terms, subject components, and attendance slabs. |
| **Verify Results Engine** | `npm run verify:results` | Runs calculation engine integrity test. |

---

## 11. Application Code Usage Patterns

### Injecting `PrismaService`

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {} // PrismaModule is globally available
}
```

### Automatic Password Hashing

```ts
// Password plaintext is automatically hashed via bcrypt in passwordHashingExtension
await this.prisma.users.create({
  data: {
    name: 'Rahim Ahmed',
    email: 'rahim@school.com',
    password: 'PlainTextPassword123', // Automatically stored as bcrypt hash
    role: 'teacher',
  },
});
```

### Interactive Transactions with Automatic Extensions

```ts
// Transactions inherit all client extensions (password hashing, wire format)
const result = await this.prisma.$transaction(async (tx) => {
  const user = await tx.users.create({
    data: { name: 'Karim', email: 'karim@school.com', password: 'secretPassword', role: 'student' },
  });
  
  await tx.menuUserPermission.createMany({
    data: roleDefaults.map((d) => ({
      userId: user.id,
      menuId: d.menuId,
      canView: d.canView,
      canCreate: d.canCreate,
      canEdit: d.canEdit,
      canDelete: d.canDelete,
    })),
  });

  return user;
});
```

### Wire Format Transformation

To maintain API compatibility with frontend interfaces expecting legacy snake_case serialization:

```ts
import { toWire, toWireList } from '../prisma/wire';

// Single entity
return toWire(user); // converts camelCase to snake_case, Decimals to strings

// Entity lists
return toWireList(studentList);
```

---

## 12. Unit Testing Without Database

Unit tests in NestJS should never touch the real database. Use the pre-built mock provider:

```ts
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UsersService(asPrisma(prisma));
  });

  it('finds active user', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: '1', email: 'test@school.com', isActive: true });
    
    const user = await service.findById('1');
    expect(user?.email).toBe('test@school.com');
  });
});
```

---

## 13. Quick Reference Card

```bash
# ── Setup Fresh Machine ───────────────────────────────────────────────
npm install && cp .env.example .env
npm run db:migrate
npm run seed:auth
npm run seed:results

# ── Daily Schema Workflow (Reversible) ────────────────────────────────
# 1. Edit apps/api/prisma/schema.prisma
# 2. Author reversible migration pair (migration.sql + down.sql):
npm run db:migrate:new -- --name add_fee_collection_tables

# 3. Apply to local database:
npm run db:migrate

# ── Rollback Changes ──────────────────────────────────────────────────
npm run db:rollback -- --dry-run          # Preview target and statements
npm run db:rollback                       # Roll back 1 migration step
npm run db:rollback -- --steps=2          # Roll back 2 migration steps
git checkout -- prisma/schema.prisma      # Reconcile schema.prisma

# ── Status & Diagnostics ──────────────────────────────────────────────
npm run db:migrate:status                 # Reversible migration status table
npm run prisma:status                     # Native Prisma status check
npm run prisma:smoke                      # Database ping & driver health

# ── Repair Stuck Migrations ───────────────────────────────────────────
npm run db:migrate:repair -- <name> --applied      # If SQL already ran in DB
npm run db:migrate:repair -- <name> --rolled-back  # If retrying from scratch
```
