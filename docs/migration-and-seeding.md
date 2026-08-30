# Migration & Seeding Guideline

## Overview

This project uses **TypeORM v0.3** with **MySQL**. All database schema changes are managed through migration files. Seed data is inserted via a dedicated seed script.

**Data source:** `src/database/data-source.ts`
**Migrations dir:** `src/database/migrations/`
**Seed script:** `src/database/seed.ts`
**Migration service:** `src/database/database.service.ts`

---

## 1. Column Naming Convention

- **Entity property names:** camelCase (`isActive`, `lastLoginAt`)
- **Database column names:** snake_case (`is_active`, `last_login_at`)
- TypeORM maps between them via the `name` option on `@Column()`:

  ```ts
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
  ```

- The **`password`** column on the users table is the one exception — it keeps the same name in both entity and DB (no `name` override needed).

---

## 2. Entity Changes → Migration

Whenever you add, remove, or modify a column on an entity:

```bash
cd apps/api
npm run migration:generate -- src/database/migrations/DescriptiveName
```

This reads the entity definitions and generates a migration file in `src/database/migrations/` containing the SQL diff. Review the generated file, then apply it:

```bash
npm run migration:run
```

### Naming convention for migration files

`<timestamp>-<DescriptiveName>.ts`

Examples:
- `1701234567890-CreateUsersTable.ts`
- `1701234567900-AddPhoneToUsers.ts`

---

## 3. Running Migrations

### Option A — HTTP endpoint (recommended for local dev)

The server exposes two endpoints via `DatabaseService`:

```bash
# Apply all pending migrations (requires auth)
curl -X POST http://localhost:3031/migrate

# Revert the last migration (requires auth)
curl -X POST http://localhost:3031/migrate/revert
```

### Option B — CLI

Run these commands from the `apps/api` directory:

```bash
# Apply all pending migrations
pnpm migration:run

# Revert the last migration
pnpm migration:revert
```

### After renaming a column

If you rename a property and add `name: 'new_col'` to the `@Column`:

1. Update the **migration** manually — use `renameColumn` instead of `dropColumn` + `addColumn` so data is preserved:

   ```ts
   renameColumn(table, oldName, newName)
   ```

2. Then run `npm run migration:run`.

---

## 4. Seeding

Seed data is inserted by running (from `apps/api`):

```bash
pnpm seed
```

The seed script (`src/database/seed.ts`):
- Uses `userRepository.create()` which triggers the entity's `@BeforeInsert()` hooks (e.g., password hashing)
- Clears existing users with `userRepository.clear()` before inserting
- Passwords in the seed data are plain text — the entity's `hashPassword()` hook hashes them before insert

### Adding a new seed user

Edit `src/database/seed.ts`, add an entry to the `users` array, then run `pnpm seed`.

---

## 5. Full Reset (Drop & Recreate)

When you need a completely clean start, run from the `apps/api` directory:

```bash
# 1. Drop the users table
node -r ts-node/register -r tsconfig-paths/register ./node_modules/typeorm/cli.js query "DROP TABLE IF EXISTS users"

# 2. Clear the migrations log
node -r ts-node/register -r tsconfig-paths/register ./node_modules/typeorm/cli.js query "DELETE FROM migrations"

# 3. Run all migrations
pnpm migration:run

# 4. Seed the database
pnpm seed
```

Alternatively, steps 3 and 4 can be done via HTTP endpoints (requires auth):

```bash
curl -X POST http://localhost:3031/migrate
pnpm seed
```

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `No migrations were found` | The migration isn't recorded in the `migrations` table yet. Just run `npm run migration:run`. |
| `Column 'isActive' not found` | The DB column is `is_active`. Use the entity property name in code, but check the actual DB column name when debugging raw queries. |
| `Cannot drop column: needed by foreign key` | Drop or rename the referencing column first, then retry. |
| Seed passwords are plain text | Correct — the entity's `@BeforeInsert()` hook hashes them automatically. |
