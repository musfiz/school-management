# Prisma ORM — Project Guide (apps/api)

Everything needed to run, migrate, seed, and use Prisma in this repository.
All commands below are run from **`apps/api/`** (the NestJS backend workspace).

---

## 1. Overview

| Thing | Value |
|---|---|
| ORM | **Prisma 7** (no Rust query engine — driver-adapter architecture) |
| Database | **MySQL / MariaDB** via `@prisma/adapter-mariadb` |
| Schema | `apps/api/prisma/schema.prisma` |
| Generated client | `apps/api/src/generated/prisma/` (regenerated, do **not** hand-edit) |
| Migrations | `apps/api/prisma/migrations/` (SQL, committed) |
| Runtime client | `apps/api/src/prisma/prisma.service.ts` (`PrismaService`, injected NestJS provider) |
| Timezone pin | Every connection runs `SET time_zone = '+00:00'` (UTC session) — see `src/prisma/database-url.ts` |

### Client extensions built into `PrismaService`

Every query made through the injected service automatically passes through:

1. **`passwordHashingExtension`** — hashes `users.password` on
   `create` / `update` / `upsert` / the `$transaction` variants. **Never hash
   passwords at a call site**; pass plaintext (as the seeding scripts do) and
   let the extension handle it.
2. **`wireFormatExtension`** — restores the legacy TypeORM wire format:
   `Decimal` columns serialize as strings (`"800.00"`), `DATE` columns as
   `"YYYY-MM-DD"`, and camelCase rows get snake_case aliases via
   `toWire()` / `toWireList()` (`src/prisma/wire.ts`).

Because `$extends` returns a proxy, `PrismaService` *is* the extension chain —
call sites just use `this.prisma.<model>` normally.

---

## 2. Directory layout

```
apps/api/
├── prisma/
│   ├── README.md            ← this file
│   ├── schema.prisma        ← single source of truth for the DB
│   └── migrations/          ← timestamped SQL migrations (committed)
│       ├── 20261016000000_init
│       ├── …
│       └── migration_lock.toml
└── src/
    ├── generated/prisma/    ← generated client (never edit; not committed)
    └── prisma/
        ├── prisma.service.ts        ← NestJS provider (adapter + extensions)
        ├── prisma.module.ts         ← global module
        ├── database-url.ts          ← DB_* / DATABASE_URL resolution + UTC pin
        ├── password-hashing.extension.ts
        ├── wire.extension.ts / wire.ts
        └── …specs
```

---

## 3. Environment variables

Set these in `apps/api/.env` (see `.env.example`). The connection string is
derived from the `DB_*` variables unless `DATABASE_URL` is set
(`DATABASE_URL` wins when both exist):

| Variable | Purpose | Default |
|---|---|---|
| `DB_HOST` | DB hostname | `localhost` |
| `DB_PORT` | DB port | `3306` |
| `DB_USERNAME` | DB user | `root` |
| `DB_PASSWORD` | DB password | *(empty)* |
| `DB_DATABASE` | Schema name | `school` |
| `DATABASE_URL` | Full override, e.g. `mysql://user:pass@host:3306/school` | *(derived)* |
| `SHADOW_DATABASE_URL` | Shadow DB for `migrate dev`; defaults to `<DB_DATABASE>_shadow` on the same server | *(derived)* |

> If your DB user is not allowed to `CREATE DATABASE` (shared hosting), you
> **must** set `SHADOW_DATABASE_URL` to a database it can use.

---

## 4. Command reference

All npm scripts live in `apps/api/package.json`:

| Command | What it does |
|---|---|
| `npm run prisma:generate` | Regenerate the client into `src/generated/prisma`. Run this **after every schema change** and after pulling the repo. |
| `npm run prisma:migrate` | **Dev:** `prisma migrate dev` — creates a migration from schema changes, applies it, regenerates the client. Add a name: `npm run prisma:migrate -- --name add_foo_table`. |
| `npm run prisma:deploy` | **Prod/CI:** `prisma migrate deploy` — applies all unapplied committed migrations. Never prompts, never resets. |
| `npm run prisma:status` | `prisma migrate status` — which migrations are applied / pending. |
| `npm run prisma:studio` | `prisma studio` — browser GUI for browsing/editing rows. |
| `npm run prisma:pull` | `prisma db pull` — introspect an existing DB back into `schema.prisma`. **Careful:** overwrites the schema file. |
| `npm run prisma:smoke` | `tsx scripts/prisma-smoke.ts` — connectivity sanity check (connect, ping, disconnect). |
| `npm run build` | `prisma generate && nest build` — the build always regenerates the client first. |

Equivalent raw CLI (if you need flags not exposed by the scripts):

```bash
npx prisma generate
npx prisma migrate dev --name <migration_name>
npx prisma migrate deploy
npx prisma migrate status
npx prisma studio
npx prisma db pull
npx prisma migrate reset        # ⚠️ drops + recreates the schema, then applies migrations
```

> **Policy:** use `migrate` (SQL migrations committed to git) — never
> `npx prisma db push` in this repo. `db push` skips the migration history and
> will desync teammates/production.

---

## 5. First-time setup (fresh machine)

```bash
cd apps/api
npm install                       # install deps
cp .env.example .env              # then fill in DB_* values
npx prisma migrate deploy         # create schema from committed migrations
npm run prisma:generate           # (migrate dev/deploy regenerates already)
npm run prisma:smoke              # verify connectivity
```

Then seed (see §7):

```bash
npm run seed:results
npx ts-node -T -r tsconfig-paths/register scripts/seed-authorization.ts
```

---

## 6. Day-to-day schema change workflow

1. Edit `prisma/schema.prisma` (models are `PascalCase` and mapped to
   snake_case tables/columns with `@map` / `@@map` — follow that convention).
2. `npm run prisma:migrate -- --name <short_snake_case_name>`
   → Prisma generates `prisma/migrations/<ts>_<name>/migration.sql`, applies it,
   regenerates the client.
3. Review the generated SQL, adjust only when you know why, and
   **commit both** the migration folder and `schema.prisma`.
4. Other machines / environments: `git pull` → `npx prisma migrate deploy`.

Notes:

- `migrate dev` needs a **shadow database**; it will fail with
  *"shadow database creation requiresSuperuser / CREATE DATABASE privilege"*
  if the user lacks privileges — set `SHADOW_DATABASE_URL` (§3).
- `prisma migrate reset` is dev-only: it drops all data, re-applies every
  migration. Use it when your dev DB drifts (manual `db push`, reverted
  migrations) — then re-run the seed scripts.

---

## 7. Seeding

This project does **not** use `prisma/seed.ts` as the canonical seeder; seeds
live in `apps/api/scripts/` as standalone scripts. All seeds are **idempotent**
(safe to re-run; they no-op when rows already exist).

| Seed / script | Command |
|---|---|
| Authorization layer — 10 system menus, role default templates, 1 superadmin user | `npx ts-node -T -r tsconfig-paths/register scripts/seed-authorization.ts` |
| Superadmin credentials override (optional env) | `SUPERADMIN_EMAIL=… SUPERADMIN_PASSWORD=…` before the command |
| Academic results engine base data | `npm run seed:results` |
| Verify the result-engine data/boot path | `npm run verify:results` |

Generic pattern for any other script:

```bash
npx ts-node -T -r tsconfig-paths/register scripts/<script-name>.ts
```

---

## 8. Using Prisma in application code

### Injecting the service

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ThingsService {
  constructor(private readonly prisma: PrismaService) {}   // PrismaModule is global
}
```

`PrismaService` connects on app boot (`onModuleInit`) and disconnects on
shutdown — you never manage connections yourself.

### Standard usage

```ts
// Read
const rows = await this.prisma.users.findMany({
  where: { isActive: true },
  select: { id: true, name: true },     // select subsets to keep wire parity
});

// Write (password hashed automatically by the extension)
await this.prisma.users.create({
  data: { name: 'Jane', email: 'jane@school.com', password: 'plaintext-ok', role: 'teacher' },
});
```

### Transactions

```ts
// Interactive transaction (preferred — compose multiple steps atomically).
// The `tx` client carries the same extensions as `prisma`, so password
// hashing and wire formatting stay active inside the callback.
await this.prisma.$transaction(async (tx) => {
  const user = await tx.users.create({ data: { … } });       // password hashed
  await tx.menuUserPermission.createMany({ data: defaults.map(d => ({ userId: user.id, … })) });
  return user;
});

// Array form for a fixed list of writes (faster, no callback)
await this.prisma.$transaction([
  this.prisma.a.deleteMany({ where: { … } }),
  this.prisma.b.create({ data: { … } }),
]);
```

### Wire format

Return data through `toWire(user)` / `toWireList(rows)` from
`src/prisma/wire.ts` when the endpoint must keep the legacy snake_case JSON
shape (`created_at`, `is_active`, decimal strings, …). Controllers that were
migrated 1:1 from TypeORM rely on this — preserve it in new code or you will
break existing frontend consumers.

### Raw SQL (escape hatch)

```ts
const [rows] = await this.prisma.$queryRawUnsafe<unknown[]>(
  'SELECT * FROM vendors WHERE fund_id = ?', fundId,
);
```

Prefer model queries; use raw SQL only for reports / MySQL-only features, and
always parameterize.

---

## 9. Testing with Prisma (no database)

Unit tests never touch MySQL. Use the shared mock:

```ts
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const prisma: PrismaMock = createPrismaMock();     // jest.fn() model delegates
prisma.users.findUnique.mockResolvedValue(row);

const service = new UsersService(asPrisma(prisma) /* cast to PrismaService */);
```

- `$transaction` runs the callback with the same mock as the `tx` client, so
  interactive-transaction code is testable.
- `$connect` / lifecycle hooks are irrelevant in tests.
- Exported only through `apps/api/test/support/prisma-mock.ts`.

---

## 10. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `Property 'X' does not exist on type 'PrismaService'` after a schema change | Generated client is stale → `npm run prisma:generate` (or re-run `npx prisma migrate dev`, which regenerates). |
| Type errors on `prisma.menu*` / new models after `git pull` | A teammate added schema + migration — deploy first: `npx prisma migrate deploy`, then `npm run prisma:generate`. |
| `Migrations are not in sync` / drift warnings in dev | Someone used `db push` or hand-edited SQL → `npx prisma migrate reset` (dev data ⚠️ then re-seed) or resolve with `migrate resolve --rolled-back <name>` if you intentionally rolled back. |
| Timestamps 6 hours off (Asia/Dhaka vs UTC) | Must not happen — the adapter pins sessions to UTC (`database-url.ts`). If you see drift you bypassed `PrismaService`; route through it. |
| `CREATE DATABASE` denied during `migrate dev` | Shadow DB privileges → set `SHADOW_DATABASE_URL`. |
| Duplicate-key errors from seed scripts re-run | They are idempotent by design; a failure here means a slug/email changed format — fix the data, not the re-run loop. |
| Client output missing / wrong package type | `generator client` is pinned to `output = "../src/generated/prisma"`, `moduleFormat = "cjs"`, `runtime = "nodejs"` — keep those exact values; imports throughout `src` assume them (`from '../generated/prisma/client'`). |

---

## 11. Quick reference card

```bash
# ── Setup ──────────────────────────────────────────────
npm install && cp .env.example .env          # fill DB_*
npx prisma migrate deploy && npm run prisma:generate && npm run prisma:smoke

# ── Develop ────────────────────────────────────────────
npm run prisma:migrate -- --name my_change    # schema change → migration + client
npm run dev                                   # run API (node --watch)

# ── Deploy ─────────────────────────────────────────────
npx prisma migrate deploy                     # apply pending migrations (no reset)

# ── Tools ─────────────────────────────────────────────
npm run prisma:studio                         # DB GUI
npm run prisma:status                         # migration status
npm run prisma:smoke                          # connectivity check

# ── Seeds (idempotent) ─────────────────────────────────
npx ts-node -T -r tsconfig-paths/register scripts/seed-authorization.ts
npm run seed:results
```
