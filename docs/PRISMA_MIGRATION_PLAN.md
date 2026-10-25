# API Migration Plan — TypeORM → Prisma ORM

> **Author role:** System Architect (`.opencode/agents/system-architect.md`)
> **Scope:** `apps/api` (NestJS 11, TypeScript, MariaDB 11.7 / MySQL 8) + `apps/web`
> **Date:** 2026-10-16
> **Status:** 🟢 **Wave 0 complete** (tooling, schema, baseline, Prisma coexisting) — see §14. Waves 1–6 pending.
> **Path:** `docs/PRISMA_MIGRATION_PLAN.md`
> **Relationship to other work:** This migration **precedes** `docs/RESULT_ENGINE_EXECUTION_PLAN.md`. The Result Engine must be built **Prisma-native** (see §11), not on TypeORM.
> **⚠️ Version correction (2026-10-25):** This document was authored while the
> repo ran **Prisma 7**. The ORM tooling was subsequently rolled back to
> **Prisma 6** (`6.19.3`) — see `docs/prisma_migration_v6.md`. Every decision
> below about *using* Prisma (AD-P1–P13, the strangler-migration approach, the
> driver-adapter architecture) is still current; only the **version-specific**
> details called out inline (config file, generator defaults, `migrate diff`
> flags, pinned version numbers) are superseded.

---

## 1. Executive summary

The API has **~22,100 LOC across 213 files**, **49 TypeORM entities**, **16 active
migrations**, and TypeORM usage spread through **138 files** (`@nestjs/typeorm`
in 49). Migrating in one big-bang rewrite is the single highest-risk change we
could make to a working accounting/admissions system.

**Recommendation: a strangler migration.** Add Prisma *alongside* TypeORM, point
both at the **same database**, migrate **one module wave at a time** with
behavioural parity checks, and delete TypeORM only after the last module is
migrated. No schema rewrite, no big-bang, per-wave rollback.

The database schema is **not** rewritten: it is introspected into
`schema.prisma`, normalised to match the migrations exactly, then baselined with
Prisma Migrate. All future schema work (including the Result Engine) is authored
in Prisma.

---

## 2. Ground truth — the actual conversion surface

Measured with `grep` against `apps/api/src` (not estimated):

| Metric | Count |
| --- | --- |
| Files importing `typeorm` or `@nestjs/typeorm` | **138** |
| Files importing `@nestjs/typeorm` | 49 |
| Modules with `TypeOrmModule.forFeature([...])` | **16** |
| Files injecting repositories (`@InjectRepository`) | 32 (85 occurrences) |
| Files injecting `DataSource` / `EntityManager` | **22** |
| Files using `createQueryBuilder` | 18 |
| `getRawMany` / `getRawOne` calls | 18 / 5 |
| Files using `dataSource.transaction(...)` | 9 |
| Pessimistic locks (`setLock('pessimistic_write')` / `FOR UPDATE`) | 5 sites |
| Relations | 59 `@ManyToOne` + 7 `@OneToMany` (59 `@JoinColumn`) |
| `@Unique` decorators | 6 |
| Column types | 221 varchar, 97 char(36), 62 decimal, 60 timestamp, 20 date, 14 text, 1 enum |
| Entities exporting non-entity consts/types | ~40 symbols across ~25 files |
| Raw SQL in business logic | **none** (raw SQL only in migrations + `DatabaseService`) |

**Two facts that de-risk this enormously:**

1. **No service executes hand-written SQL.** Every raw `queryRunner.query()` is in
   a migration file or `database.service.ts`. Business logic is repositories +
   query builders only — both have direct Prisma equivalents.
2. **`decimal.js` is already the money/mark type.** Prisma's `Decimal` **is**
   `decimal.js` under the hood, so `new Decimal(prismaValue)` in the existing
   services keeps working unchanged.

**The genuinely hard parts** (and where the effort concentrates):

- 18 query-builder files, mostly **accounting reports** (`financial-reports`,
  `audit`, `student-billing`, `payroll`, `vendor-bill`) using joins +
  `addSelect('SUM(CAST(...))')` + `groupBy` + `getRawMany`.
- 5 **pessimistic-lock** sites (voucher/roll sequences and invoice status flips).
- 9 **interactive transactions**.
- **Entity-exported constants/types** (~40) that services import — these must be
  relocated or everything breaks at compile time.
- **`User` entity hooks** (`@BeforeInsert` password hashing, `comparePassword`) —
  Prisma has no entity hooks.

---

## 3. Options considered

| Option | Verdict |
| --- | --- |
| **A. Big-bang rewrite** — delete TypeORM, rewrite all 138 files at once | ❌ Rejected. Long freeze, unreviewable diff, no rollback, touches live accounting |
| **B. Strangler / dual-ORM** — run Prisma beside TypeORM on the same DB, migrate wave by wave | ✅ **Recommended**. No schema rewrite; per-wave rollback; parity-testable |
| **C. Greenfield** — rebuild schema + code in Prisma from scratch | ❌ Rejected. Data-loss risk, discards 16 migrations of hard-won DDL |

Prisma and TypeORM can safely coexist because **Prisma owns only the client**,
not the connection pool isolation: both talk to the same MySQL database; the
schema does not change during the migration. The only rule is **one writer for
schema changes at a time** — and no new tables are added until the migration
completes (the Result Engine waits, §11).

---

## 4. Architecture decisions (AD-Pn)

> **AD-P2, AD-P3, AD-P5, AD-P6, AD-P8** need sign-off (§12).

**AD-P1 — Strangler, wave-based, DB unchanged.**
Add `@prisma/client` + `prisma` and a `PrismaService`; TypeORM keeps running.
Migrate modules in waves (§8). TypeORM is removed only in the final wave.

**AD-P2 — `schema.prisma` is authored from the live DB, then normalised to match migrations exactly.**
`prisma db pull` → hand-normalise (`@@map`, `@map`, `@db.*`, relations,
indexes/uniques, `onDelete`) → assert zero drift with
`prisma migrate diff --from-schema-datasource … --to-schema-datamodel …` → baseline.
We do **not** hand-write 49 models from scratch.

**AD-P3 — Preserve DB-level UUID defaults.**
Existing PKs use default `(UUID())`. Model them as
`@id @default(dbgenerated("(UUID())")) @db.Char(36)` so DB behaviour is identical
during coexistence and for raw inserts. (App-generated `@default(uuid())` is
rejected for this migration to avoid changing who creates IDs; revisit as the
separate Postgres-portability task.)
*Prisma-value caveat:* `dbgenerated("(UUID())")` is MySQL-specific — acceptable
here because the DB is MySQL, and it is consistent with the existing migrations.

**AD-P4 — Prisma is the only schema writer after baseline; TypeORM migrations freeze.**
After Wave 0, **no new TypeORM migrations**. Any emergency DDL during the
migration is applied as raw SQL through Prisma Migrate. This prevents
`_prisma_migrations` and `migrations` tables from drifting.

**AD-P5 — TypeORM `Repository`/`EntityManager` → `PrismaService` / `Prisma.TransactionClient`.**
No repository-wrapper layer is introduced (it would leak TypeORM-shaped APIs and
double the work). Services hold `private readonly prisma: PrismaService` and call
`this.prisma.<model>`. Transaction helpers receive `tx: Prisma.TransactionClient`.

**AD-P6 — Analytical query-builder code becomes typed `$queryRaw`, not `groupBy`.**
The accounting reports (trial balance, GL, aging, grade/pass analytics) rely on
`SUM(CAST(... AS DECIMAL(15,2)))`, joins and `groupBy`. Reproducing these with
`prisma.groupBy` risks decimal/edge drift. Use **tagged-template `$queryRaw`**
(parameterised, injection-safe) so the SQL and results stay byte-identical;
convert simple list/filter query builders to Prisma `where`/`include`.
Rule of thumb: **joins + aggregates + GROUP BY → `$queryRaw`; everything else →
Prisma Client.**

**AD-P7 — Pessimistic locks keep their semantics via a transaction-scoped raw lock helper.**
Prisma has no `setLock`. Add
`lockRow(tx, table, whereSql) → tx.$queryRaw\`SELECT id FROM ... FOR UPDATE\`` and
call it inside `prisma.$transaction`. The existing sequence services keep their
signatures, only swapping `EntityManager` for `Prisma.TransactionClient`.

**AD-P8 — Replace entity hooks with a Prisma Client extension + helper functions.**
`User.hashPassword` (`@BeforeInsert`/`@BeforeUpdate`) becomes a
`prisma.$extends` query extension on `user.create`/`user.update`, **or** an
explicit `hashPassword()` call in `AuthService`/`UsersService`. `comparePassword`
becomes `comparePassword(user, plain)` in `src/users/user.util.ts` (bcrypt).
*Decision needed:* central extension (invariant survives all call sites) vs.
explicit calls (simpler, easier to reason about).

**AD-P9 — Entity constants/types move to sibling `*.constants.ts` files.**
Every non-entity export in `src/database/entities/` (e.g. `VoucherType`,
`VOUCHER_PREFIX_BY_TYPE`, `UserRole`, `STUDENT_STATUSES`, `CLEARING_GL_BY_CHANNEL`)
moves to a plain module file **before** the entity is deleted, so imports keep
resolving. No behavioural change.

**AD-P10 — A single `DATABASE_URL` is derived; `.env` keys stay compatible.**
Prisma CLI reads one `DATABASE_URL`. Add it to `.env`/`.env.example` and compute
a fallback from the existing `DB_*` vars in a `prisma.config.ts` / bootstrap
helper, so local setup keeps working either way.

**AD-P11 — No test runner exists today; parity is proven by a golden-response harness.**
Add a lightweight parity runner (§9) rather than assuming Jest. It captures
TypeORM responses, swaps the module to Prisma, and diffs against the golden JSON
(Decimals compared as strings).

**AD-P12 — Prisma operations go through `PrismaService` only; generated client in `src/generated/prisma`.**
> Uses the output-based `prisma-client` generator (not `node_modules/@prisma/client`).
> `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy`
> and is registered by a `@Global()` `PrismaModule`. The client is generated to
> `src/generated/prisma` — **inside `rootDir`**, so `nest build` compiles it —
> with `moduleFormat = "cjs"` and `runtime = "nodejs"` so the ESM-by-default
> generator emits CommonJS (no `import.meta`, no `.ts` import extensions). The
> folder is git-ignored and regenerated by `prisma generate`, which is wired
> into the `build` script. A **driver adapter** (`@prisma/adapter-mariadb`)
> plus `engineType = "client"` on the generator run the app without the Rust
> query engine — GA in Prisma 6 since v6.16.0, the default in v7.
> **(Version note: on Prisma 6, `engineType = "client"` must be set explicitly;
> v7 makes it the only mode. See `docs/prisma_migration_v6.md`.)**

---

## 5. Target layout & tooling

```text
apps/api/
├── prisma/
│   ├── schema.prisma           # 49 models, normalised + mapped
│   └── migrations/             # baselined 20261016000000_init + migration_lock.toml
├── jest.config.js              # test net (Wave 0)
├── tsconfig.spec.json          # jest tsconfig (types: node, jest)
├── scripts/
│   ├── prisma-smoke.ts         # Prisma connectivity check
│   └── parity/                 # golden-response parity harness (§9)
│       ├── json-diff.ts · probes.ts · run.ts · golden/baseline.json
├── src/
│   ├── generated/prisma/       # GENERATED (git-ignored) — do not edit
│   ├── prisma/
│   │   ├── prisma.module.ts    # @Global()
│   │   ├── prisma.service.ts   # PrismaClient + mariadb adapter
│   │   └── database-url.ts     # DB_*/DATABASE_URL + shadow URL helpers
│   ├── accounting/             # migrated in Wave 5
│   ├── admissions/             # Wave 4
│   ├── ...                     # Waves 1–3
│   └── database/
│       ├── entities/           # TYPEORM — deleted at Wave 6
│       ├── migrations/         # TYPEORM — frozen at Wave 0, archived at Wave 6
│       ├── data-source.ts      # deleted Wave 6
│       └── seed-*.ts           # rewritten per wave
└── package.json                # + prisma, @prisma/client, @prisma/adapter-mariadb,
                                #   jest, ts-jest; − typeorm, @nestjs/typeorm (Wave 6)
```

Tooling (pinned during Wave 0; **rolled back to the Prisma 6 line on 2026-10-25,
see `docs/prisma_migration_v6.md`**): **`prisma@6.19.3`**, **`@prisma/client@6.19.3`**,
**`@prisma/adapter-mariadb@6.19.3`** (bundles `mariadb@3.5.4`),
**`jest@30.5.2`** + **`ts-jest@29.4.15`**.
> **Read the installed CLI's `--help` before relying on a flag** — Prisma
> renames flags between majors (e.g. v7 removed
> `migrate diff --from-schema-datasource` in favour of `--from-config-datasource`
> / `--to-schema`, and `db pull` now reads the URL from the config file). This
> repo runs v6, so `--from-schema-datasource` is the correct flag
> (`scripts/db-migrate.ts`).

---

## 6. Schema authoring & baseline — completed in Wave 0 (detail in §14)

1. **Introspect** the live DB → `prisma/schema.prisma` (`prisma db pull`; on
   Prisma 6 this reads the datasource URL straight from `schema.prisma`'s
   `env("DATABASE_URL")`, loaded from `.env` by the CLI's own auto-load).
2. **Normalise**: PascalCase models + `@@map("snake_table")`; camelCase fields +
   `@map("snake_col")`; `@db.Char(36)` / `@db.Decimal(p,s)` / `@db.VarChar(n)` /
   `@db.Timestamp(0)` to match; PK `@default(dbgenerated("(uuid())"))` (AD-P3);
   `@relation(fields, references, onDelete, onUpdate, map)` on each FK;
   `@@index` / `@@unique` carrying their original `map` names; and the single
   native enum as `enum UsersRole @@map("users_role")`.
   Applied by a deterministic transformation script; **`prisma validate` plus a
   zero-drift `migrate diff` prove the rename changed only names**.
3. **Zero-drift gate** (Prisma 6 flag — v7 renamed this to `--from-config-datasource`):
   `prisma migrate diff --from-schema-datasource --to-schema prisma/schema.prisma --exit-code`
   ⇒ `No difference detected`.
4. **Baseline** (never run against the existing DB): generate
   `prisma/migrations/20261016000000_init/migration.sql` (49 `CREATE TABLE`s) from
   `migrate diff --from-empty --to-schema … --script`, then
   `migrate resolve --applied 20261016000000_init`, and add
   `prisma/migrations/migration_lock.toml` (`provider = "mysql"`). Prisma now tracks
   state in `_prisma_migrations` alongside TypeORM's untouched `migrations` table.
5. **`prisma generate`** (wired into the `build` script) + a `@Global()`
   `PrismaModule` exporting `PrismaService`.
6. **Shadow database:** `school_shadow` created; `shadowDatabaseUrl` derived in
   `prisma7.config.ts`. Required by `migrate dev` and `migrate diff --from-migrations`.
   > **Version note (2026-10-25):** the config file is gone after the v6 rollback
   > (`docs/prisma_migration_v6.md`); `shadowDatabaseUrl` is now the literal
   > `env("SHADOW_DATABASE_URL")` in `schema.prisma` (same fix as Wave-0's
   > collation/`ON UPDATE` audit — the shadow DB itself is unchanged).

---

## 7. Conversion playbook (pattern-by-pattern)

The single most useful table for the build agent:

| TypeORM | Prisma | Notes |
| --- | --- | --- |
| `@Entity('x') class X` | `model X { … @@map("x") }` | keep service field names via `@map` |
| `@PrimaryGeneratedColumn('uuid') id` | `id String @id @default(dbgenerated("(UUID())")) @db.Char(36)` | AD-P3 |
| `@Column({name:'full_name_en',type:'varchar',length:120}) fullNameEn` | `fullNameEn String @map("full_name_en") @db.VarChar(120)` | |
| `decimal(6,2)` | `Decimal @db.Decimal(6,2)` | `new Decimal(v)` still works |
| `@ManyToOne(()=>Y,{onDelete:'RESTRICT'}) @JoinColumn({name:'y_id'}) y` | `y Y @relation(fields:[yId], references:[id], onDelete: Restrict)` + `yId String @map("y_id") @db.Char(36)` | 59 relations |
| `@OneToMany(()=>L,l=>l.entry) lines` | `lines L[]` | inverse side |
| `@Unique('uq',['a','b'])` | `@@unique([a,b], name:"uq")` | + migration-only uniques |
| migration `@Index` | `@@index([...], map:"IDX_…")` | introspect & verify |
| `@InjectRepository(X) repo: Repository<X>` | `private readonly prisma: PrismaService` → `prisma.x` | AD-P5 |
| `TypeOrmModule.forFeature([X,Y])` | *(delete)* | inject `PrismaService` |
| `repo.find({where,relations,order,take})` | `prisma.x.findMany({where,include,orderBy,take})` | |
| `repo.findOne({where,relations})` | `prisma.x.findUnique/findFirst({where,include})` | |
| `repo.count({where})` | `prisma.x.count({where})` | |
| `repo.create({...}); repo.save(e)` | `prisma.x.create({data})` | |
| `repo.save(e)` (update) | `prisma.x.update({where:{id},data})` | |
| `repo.update(crit,patch)` | `prisma.x.updateMany({where,data})` | |
| `repo.delete(crit)` | `prisma.x.deleteMany({where})` | 7 sites |
| `repo.upsert(...)` | `prisma.x.upsert({where,create,update})` | 3 sites |
| `qb.leftJoinAndSelect('e.lines','l')` | `include:{ lines:true }` | |
| dynamic `.andWhere(...)` filters | build a `where` object | 81 sites |
| `.getRawMany()` join+SUM+GROUP BY | `tx.$queryRaw\`…\`` tagged template | AD-P6; 18 sites |
| `dataSource.transaction('REPEATABLE READ', cb)` | `prisma.$transaction(cb,{ isolationLevel:'RepeatableRead' })` | 9 sites |
| `manager.getRepository(X)` | `tx.x` | `tx: Prisma.TransactionClient` |
| `manager` typed `EntityManager` | `Prisma.TransactionClient` | 22 files |
| `.setLock('pessimistic_write')` | `lockRow(tx,'x',…)` → `SELECT … FOR UPDATE` | 5 sites, AD-P7 |
| `@BeforeInsert` hash / `comparePassword` | Prisma `$extends` or service call / util fn | AD-P8 |
| entity-exported consts/types | `src/<mod>/*.constants.ts` | AD-P9, ~40 symbols |
| `dataSource.runMigrations()` (`DatabaseService`) | `prisma migrate deploy` (CLI/CI) | remove runtime migration |
| seeds using repositories/query builder | Prisma Client | 3 seed scripts |

---

## 8. Phased execution plan

Each wave: **correctness gate** = module has zero `typeorm`/`@nestjs/typeorm`
imports, parity harness green, `pnpm --filter api build` + `pnpm lint` pass, and
the module's endpoints smoke-tested against a seeded DB.

### Wave 0 — Tooling, schema, baseline (**no service changes**)
**Files:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/0_init/*`,
`apps/api/src/prisma/{prisma.module,prisma.service}.ts`, `apps/api/src/app.module.ts`,
`apps/api/prisma.config.ts`, `.env.example`, `apps/api/package.json`.
**Tasks:** AD-P2/P3/P10 + §6 baseline + global `PrismaModule`.
**Gate:** `prisma migrate diff` empty; `prisma migrate resolve --applied 0_init`
done; `prisma generate` succeeds; app still boots on TypeORM; parity harness
scaffolded (§9).

### Wave 1 — Simple CMS modules (no transactions)
`site-settings`, `pages`, `sliders`, `hero-section`, `governing-body`,
`ex-principals`, `staff`, `teachers`, `notices`, `modules`.
**Recognition:** repo CRUD, no txn, no joins beyond 0–1.
**Gate:** parity per module. Convert seeds for any of these.

### Wave 2 — Identity & access
`users`, `auth`, `permissions`, `menus`.
**Special:** AD-P8 password hook + `comparePassword`; `user_permissions` implicit
composite key → Prisma composite `@@id`; `menus` self-referential tree + transaction.
**Gate:** login/register/logout + permission assign/revoke + menu CRUD parity.

### Wave 3 — Documents & uploads
`documents`, `uploads` (any repository usage).
**Gate:** document list/fetch parity; PDF route smoke test.

### Wave 4 — Admissions (transactions + locks)
`admission-application`, `admission-dashboard`, `family-registry`,
`required-document-rule`, `student-documents`, `student-lifecycle`,
`student-onboarding`, `subject-enrollment`, `waiver-calculator`,
`common/sequence.service`.
**Special:** `sequence.service` pessimistic lock → AD-P7; onboarding
`EntityManager` threading → `Prisma.TransactionClient`; dashboard query-builder
aggregates → `where`/`_count` or `$queryRaw`.
**Gate:** direct-admission wizard E2E; roll generator under concurrency; parity on
dashboard aggregates.

### Wave 5 — Accounting (largest & riskiest)
`chart-of-accounts`, `vouchers`/`journal-posting`, `voucher-sequence`,
`billing`/`student-billing`, `collection`/`fee-collection`, `procurement`/
`vendor-bill`, `payroll`, `reports`/`financial-reports`, `audit`.
**Special:** 2 lock sites; `dataSource.transaction('REPEATABLE READ')`; 18-count
`getRawMany` analytical SQL → `$queryRaw` (AD-P6); Decimal sums must match to the
cent.
**Gate:** trial balance / GL / aging byte-identical to TypeORM goldens; voucher
posting + reversal + sequence under concurrency; fee collection + invoice status
flip transactional correctness.

### Wave 6 — Decommission TypeORM
**Files:** remove `typeorm`, `@nestjs/typeorm` (and `mysql2` if unused) from
`apps/api/package.json`; delete `src/database/entities/*`, `src/database/migrations/*`,
`src/database/data-source.ts`; remove `TypeOrmModule.forRoot/forFeature`
everywhere; retire `DatabaseService` migration endpoints; archive the old
migration tree under `docs/archive/` for reference.
**Gate:** `grep -r "typeorm" src` returns nothing; full-app E2E; `pnpm build`.
**Then:** run `docs/RESULT_ENGINE_EXECUTION_PLAN.md` **Prisma-native** (§11).

---

## 9. Parity & verification harness (AD-P11)

Implemented in Wave 0. Because there was no test runner:

1. **Schema-drift gate (every wave):**
   `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
   ⇒ must be empty. (Also `--from-migrations prisma/migrations --to-config-datasource`
   to replay history against the live DB.)
   > **Version note (2026-10-25):** the datasource-side flags shown here were the
   > Prisma 7 names; this repo now runs Prisma 6, and the correct flags are
   > `--from-schema-datasource` / `--to-schema-datasource` — see §13 for the
   > exact commands.
2. **Golden-response parity:** `scripts/parity/run.ts` (`tsx`) runs registered
   probes and either records a golden (`--record`) or diffs against it.
   `scripts/parity/json-diff.ts` normalises **Decimals → strings** (money/marks
   compared exactly), Dates → ISO, BigInt → string, and ignores object-key order.
   Wave 0 ships 4 DB-snapshot probes and `golden/baseline.json`; Wave 1+ adds
   probes that call the migrated module's service methods.
3. **Concurrency tests:** voucher/roll sequences — N parallel postings must yield
   N distinct numbers (proves AD-P7 lock parity).
4. **Money invariants:** Σdebit = Σcredit; trial balance balances; invoice
   paid/partial/paid transitions.
5. **Smoke:** app boots, Swagger loads, `/uploads` static serving unchanged.

**Jest added in Wave 0** (`jest.config.js`, `tsconfig.spec.json`): **13 tests**
covering the URL helpers and the parity diff engine. Run with
`pnpm --filter api run test`.

> **Lint caveat:** `apps/api` has a `lint` script but **no ESLint config and no
> `eslint` dependency anywhere in the repo** — `pnpm lint` is a pre-existing no-op.
> Treat `build` + `test` + parity + drift as the real gates until ESLint is set up
> (out of scope for this migration).

---

## 10. Risk register

| # | Risk | Likelihood | Mitigation |
| --- | --- | --- | --- |
| R1 | Schema drift between `schema.prisma` and DB | Med | AD-P2 zero-diff gate every wave |
| R2 | Decimal/rounding drift in reports | Med-High | AD-P6 `$queryRaw` + golden parity to the cent |
| R3 | Locking semantics change (duplicate voucher/roll numbers) | Med-High | AD-P7 + explicit concurrency tests |
| R4 | Lost entity constants/types break compile across 138 files | High if unmanaged | AD-P9 pre-move constants per wave |
| R5 | Transaction isolation mismatch | Med | Use explicit `isolationLevel` mapping; document REPEATABLE READ |
| R6 | `onDelete` FK semantics differ | Med | Verify each of 59 relations vs. migrations |
| R7 | Upsert behaviour differs | Med | Convert the 3 upsert sites with a unique-key test each |
| R8 | Two schema owners during coexistence | Med | AD-P4 freeze TypeORM migrations |
| R9 | Prisma deploy/build (generated client + engines) in CI/Docker | Med | Add `prisma generate` to build; note for Docker |
| R10 | `db pull` naming/`@map` mistakes | Med | Manual normalisation + drift gate |
| R11 | Shadow-DB privilege absent for `migrate dev` | Low | Document `shadowDatabaseUrl` / grant |
| R12 | pnpm hoisting / generated-client path | Low | **Resolved in Wave 0**: output inside `src/generated/prisma` + `moduleFormat = "cjs"` |

---

## 11. Impact on the Result Engine execution plan

Once this migration is approved and executed, `docs/RESULT_ENGINE_EXECUTION_PLAN.md`
must be re-expressed **Prisma-native**. Concrete deltas:

| Result Engine plan item | TypeORM now | Prisma after migration |
| --- | --- | --- |
| §1.1 entity registry in `data-source.ts` | register 11 entities | add 11 models to `schema.prisma` + one Prisma migration |
| AD-1 module wiring | `TypeOrmModule.forFeature([...])` | inject `PrismaService` |
| §4 "Create — 8 tables" | TypeORM entity classes | Prisma models with `@@map`/`@map`/`@db.Decimal` |
| CC-15 idempotent regeneration | `dataSource.transaction` | `prisma.$transaction` |
| AD-2 job runner / one-active-job lock | `setLock('pessimistic_write')` | `lockRow(tx, …)` `SELECT … FOR UPDATE` (AD-P7) |
| CC-06/CC-09 GPA math | `decimal.js` | unchanged (`Prisma.Decimal` **is** decimal.js) |
| Phase 6 tabulation aggregates | query builder + `getRawMany` | `$queryRaw` tagged template (AD-P6) |
| Phase 1 seeder | `seed-academic-results.ts` (repo) | Prisma Client seeder |
| Grade-range lookups (CC-01) | unaffected | unaffected |

**Recommended sequence:** finish TypeORM→Prisma (Waves 0–6) **first**, then build
the Result Engine directly in Prisma. Building the Result Engine on TypeORM and
porting it later would double the work and violate AD-P4 (one schema owner).

I will rewrite the Result Engine plan doc to Prisma once this plan is signed off.

---

## 12. Open questions (need sign-off)

| # | Question | Recommended default |
| --- | --- | --- |
| Q1 | Approve the strangler migration (AD-P1) as the strategy? | **Yes** — big-bang rejected |
| Q2 | Migrate all waves now, or pause after Wave 2 to reassess? | **All waves**, but Wave 5 (accounting) reviewed on its own |
| Q3 | UUID defaults: keep DB `dbgenerated("(UUID())")` (MySQL-specific) or switch to app-side `@default(uuid())`? | **Keep DB default** (AD-P3) to avoid changing ID ownership |
| Q4 | Password hashing: central Prisma `$extends` extension vs. explicit service calls? | **Central `$extends`** (invariant survives all call sites) |
| Q5 | Analytic reports: typed `$queryRaw` vs. reshape into `groupBy`? | **`$queryRaw`** (AD-P6) — preserves cent-exact output |
| Q6 | Add Jest now (real test net) or rely on the parity runner only? | **Add Jest in Wave 0** — the engine needs a regression net |
| Q7 | Archive or delete the old TypeORM migrations at Wave 6? | **Archive** under `docs/archive/` for DDL reference |
| Q8 | Keep `mysql2`/`dotenv` after Prisma lands? | Remove `mysql2` if unused; keep `dotenv` only if still loaded |
| Q9 | Rewrite the Result Engine plan to Prisma now, or after Wave 6? | **After Wave 6**, so it is accurate to the final schema |

---

## 13. Verification commands (Prisma 6 — correct flags)

> **Version note:** this section originally targeted Prisma 7; the flags below
> are the Prisma 6 equivalents (`docs/prisma_migration_v6.md`).

```bash
# Wave 0 (already executed)
pnpm --filter api exec prisma db pull
pnpm --filter api exec prisma validate
# empty (schema == live DB):
pnpm --filter api exec prisma migrate diff --from-schema-datasource --to-schema prisma/schema.prisma --exit-code
# empty (migrations replay == live DB):
pnpm --filter api exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datasource --exit-code
pnpm --filter api exec prisma migrate resolve --applied 20261016000000_init
pnpm --filter api exec prisma generate

# Every wave
pnpm --filter api build             # runs `prisma generate && nest build`
pnpm --filter api test              # jest (13+ tests)
pnpm --filter api run prisma:smoke  # Prisma connectivity
pnpm --filter api run parity        # golden-response parity vs scripts/parity/golden

# Wave 6
grep -r "typeorm" apps/api/src      # must be empty
pnpm --filter api build && pnpm --filter api run start
```

> `pnpm lint` is a pre-existing no-op (no ESLint config/dependency) — see §9.

---

## 14. Wave 0 completion log (Prisma 7.10.1)

> **⚠️ Superseded (2026-10-25):** this log records Wave 0 as originally executed
> on **Prisma 7.10.1**. The ORM was subsequently rolled back to **Prisma 6
> (`6.19.3`)** — see `docs/prisma_migration_v6.md` for the current config file
> (none — classic `schema.prisma` + `package.json`), generator block
> (`engineType = "client"` added explicitly), and CLI flags
> (`--from-schema-datasource`). The architectural decisions below (driver
> adapter, generated-client location, extensions) are unchanged by the rollback.

**Status: complete and verified.** Prisma now runs alongside TypeORM against the
same `school` database; no service, entity or module has been migrated yet
(that is Waves 1–6).

### What landed

| Area | Change |
| --- | --- |
| Deps | `+prisma@6.19.3`, `+@prisma/client@6.19.3`, `+@prisma/adapter-mariadb@6.19.3`; `+jest@30.5.2`, `+ts-jest@29.4.15`, `+@types/jest` (dev) |
| Prisma schema | `prisma/schema.prisma` — 49 models, normalised (PascalCase + `@@map`, camelCase + `@map`), `prisma-client` generator (`cjs`, output `src/generated/prisma`, `engineType = "client"`) |
| Config | *(none — classic setup)* `schema.prisma` has `url = env("DATABASE_URL")` + `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")`; `.env` auto-loaded by Prisma 6 CLI |
| Migrations | baselined `prisma/migrations/20261016000000_init` + `migration_lock.toml`, resolved-applied |
| Client | `src/prisma/{prisma.module,prisma.service,database-url}.ts`; `PrismaModule` is `@Global()` and wired into `AppModule` |
| Build | `build` = `prisma generate && nest build`; `tsconfig` excludes Prisma CLI files + specs and moves `tsBuildInfoFile` into `dist/` |
| Tests | Jest (`jest.config.js`, `tsconfig.spec.json`), 13 tests |
| Harness | `scripts/parity/{json-diff,probes,run}.ts` + `golden/baseline.json` (4 probes); `scripts/prisma-smoke.ts` |
| Ignore | `apps/api/src/generated/` git-ignored |
| Env | `DATABASE_URL` / `SHADOW_DATABASE_URL` documented (required) in `.env.example` |

### Deviations from the original plan text

1. **Config file is `prisma7.config.ts`**, not `prisma.config.ts` (Prisma 7's
   scaffolder emits this name; `db pull` reads it).
   **→ Rolled back**: Config file deleted after v6 rollback; `schema.prisma` now
   holds datasource URL + shadow DB URL directly (classic Prisma 6).
2. **Generated client lives in `src/generated/prisma`**, not
   `node_modules/@prisma/client` (AD-P12 superseded) — required by the output-based
   generator and by `rootDir: src`.
3. **A driver adapter is required** (`@prisma/adapter-mariadb`); Prisma 7 has no
   bundled query engine for MySQL/MariaDB.
   **→ Still true in v6**; `@prisma/adapter-mariadb` used with `engineType = "client"`.
4. **`required_document_rules.id` was normalised** from a MariaDB-native `uuid`
   (which Prisma reports as `Unsupported`) to `CHAR(36) NOT NULL DEFAULT (uuid())`,
   matching the other 48 tables. The table had **0 rows**, so the `ALTER` was
   lossless. The TypeORM entity is unaffected (it stores a string either way); the
   change is captured in the baseline migration.
5. **Jest added** (approved Q6) rather than the harness only.

### Verification evidence

- `prisma validate` → `schema is valid`.
- `migrate diff --from-schema-datasource --to-schema … --exit-code` → **No difference detected**.
- `migrate diff --from-migrations … --to-schema-datasource --exit-code` → **No difference detected**.
- `migrate status` → `1 migration found … Database schema is up to date!`.
- `pnpm --filter api build` → clean; `dist/main.js` emitted.
- `pnpm --filter api test` → **13 passed**.
- `prisma:smoke` → `connected to 11.7.1-MariaDB`, `users = 7`.
- `parity --record` then `parity` → `OK — 4 probe(s) match baseline.json`.
- App boot (ts-node path) → `[PrismaService] Prisma Client connected` + `Nest
  application successfully started` + Swagger `200`, with TypeORM still active.

### Baseline fidelity audit (post-Wave-0)

An audit of the baseline against production found two **silent divergences**,
both caused by Prisma's MySQL renderer and both invisible to `migrate diff`
(which ignores them):

1. **Collation.** Prisma hard-codes `COLLATE utf8mb4_unicode_ci` on every
   `CREATE TABLE` (confirmed in both the `--from-empty` and
   `--from-config-datasource` diff paths). Production is `utf8mb4_general_ci`
   (49/49 tables), so a fresh DB built from migrations did not match production.
2. **`ON UPDATE CURRENT_TIMESTAMP`.** Prisma never emits it — not even for
   `@updatedAt` fields (confirmed with a probe model). Production has it on 32
   of 33 `updated_at` columns; a fresh DB had none, so DB-level auto-touch was
   lost.

Fixes applied (Prisma migrations are plain SQL files that may be hand-edited):

- `prisma/migrations/20261016000000_init/migration.sql`: `COLLATE
  utf8mb4_unicode_ci` → `utf8mb4_general_ci` (49×); added `ON UPDATE
  CURRENT_TIMESTAMP(0)` to the 33 `updated_at` columns.
- `prisma/schema.prisma`: added `@updatedAt` to all 33 `updatedAt` fields so
  **Prisma Client** maintains them once services move off TypeORM. This does not
  change the generated DDL (Prisma keeps `@updatedAt` app-side).
- Re-recorded the already-applied baseline checksum (`migrate resolve
  --applied`) because the file changed after it was applied.

Deliberate deviations from a byte-exact reproduction (all harmless):

- `required_document_rules.updated_at` gains `ON UPDATE CURRENT_TIMESTAMP`
  (prod omitted it — an anomaly in the 0-row table already normalised above).
- Index **ordering** inside `CREATE TABLE` differs (Prisma sorts; TypeORM used
  declaration order). The index/FK **sets are identical** (251/251).
- `_prisma_migrations` and the TypeORM `migrations` `AUTO_INCREMENT` counter are
  bookkeeping state, not schema.

Re-verification after the fixes:

- Scratch DB rebuilt purely via `migrate deploy` → `mysqldump --no-data`
  compared with production: **49/49 tables, identical columns/types, identical
  251 index+FK set, identical charset/collation**; only the deltas above remain.
- `prisma validate` valid; both `migrate diff` directions → **No difference**;
  `migrate status` → up to date; build clean; **13** tests pass; smoke
  `users = 7`; parity `OK`.
- Fixed a latent build break: `scripts/` (tsx-run) is now excluded from
  `tsconfig.json`, so `nest build` no longer fails on files outside `rootDir`
  (`tsconfig.spec.json` still includes them for tests).

### Known pre-existing issues (not introduced here)

- `data-source.ts` sets `migrations: ['src/database/migrations/*.ts']`, so running
  the compiled `dist` directly makes TypeORM try to `require` TS migration files
  (noise + slow startup). Use the `dev` (ts-node) path, or fix the glob to
  `dist/database/migrations/*.js` for `start`. Resolved anyway at Wave 6.
- `pnpm lint` is a repo-wide no-op (no ESLint config/dependency).

### Next: Wave 1

Simple CMS modules — `site-settings`, `pages`, `sliders`, `hero-section`,
`governing-body`, `ex-principals`, `staff`, `teachers`, `notices`, `modules`.
Per module: **record parity first** (from the current TypeORM behaviour), then
swap `TypeOrmModule.forFeature` + `@InjectRepository` for `PrismaService`, then
**compare parity** and rebuild.

---

## 15. Wave 1 completion log — Simple CMS modules

**Status: complete and verified.** All 10 modules now run on `PrismaService`
with zero ORM imports; parity is green against the TypeORM golden.

### What landed

- **10 services** rewritten on `PrismaService`: `site-settings`, `pages`,
  `sliders`, `hero-section`, `governing-body`, `ex-principals`, `staff`,
  `teachers`, `notices`, `modules`.
- **10 module files** no longer import `TypeOrmModule`/entities (services get
  `PrismaService` from the `@Global()` `PrismaModule`).
- **`src/prisma/wire.ts`** — wire-format compatibility helpers (`toWire`,
  `toWireList`, `toDateValue`). Nine of the ten CMS entities exposed snake_case
  `created_at`/`updated_at`; the helpers rename Prisma's camelCase timestamps so
  the JSON stays byte-identical (the wire-format decision below). `Notices` is
  the exception (its entity was already camelCase) and returns rows directly.
- **Parity harness upgraded** (`scripts/parity/run.ts`): it now boots the Nest
  DI container (`NestFactory.createApplicationContext`) under `ts-node`, so
  probes call the *real* service methods — the same probe runs against the
  TypeORM-backed service before the wave and the Prisma-backed service after it.
  `parity` script moved from `tsx` → `ts-node -T -r tsconfig-paths/register`
  (esbuild cannot emit the decorator metadata Nest DI needs). 14 probes total
  (4 DB-snapshot + 10 Wave 1 service reads).
- **29 new Jest tests** (13 suites, **73** tests total): mocked-`PrismaService`
  specs pin each service's Prisma call args, wire mapping, ordering, defaults and
  `NotFoundException`/`ConflictException` behaviour; plus `wire` unit tests and
  `buildMariaDbConnectionConfig` tests.

### Findings & fixes

1. **Pre-existing `notices` bug (fixed).** The `Notice` entity declared camelCase
   properties (`titleBn`, `createdAt`, …) with **no `name:` mapping and no
   SnakeNamingStrategy**, so TypeORM emitted `notices.titleBn`/`notices.createdAt`
   and *every* query failed with `Unknown column 'notice.titleBn'` — the notices
   API was non-functional. `notice.entity.ts` now maps every column to its
   snake_case DB name (property names, and therefore the wire shape, unchanged).
   This was required to capture a real pre-migration golden.

2. **Timestamp timezone bug in the Prisma adapter (fixed).**
   `@prisma/adapter-mariadb` reads rows with `dateStrings: true` and then does
   `new Date(value + "Z")` for `TIMESTAMP`/`DATETIME` — i.e. it *assumes the
   server returns UTC*. With the server default session zone (`SYSTEM` =
   `Asia/Dhaka`, +06:00) every timestamp came back **6 h late**. Fix:
   `buildMariaDbConnectionConfig()` passes `initSql: SET time_zone = '+00:00'`
   to each Prisma connection (`src/prisma/database-url.ts`, `UTC_SESSION_SQL`),
   matching the driver's UTC assumption. `mapArg`'s write formatters are already
   UTC (`getUTC*`), so reads and writes are now consistent, and TIMESTAMP values
   match TypeORM exactly (parity green).

3. **`DATE` columns differ by the session offset (documented, unavoidable).**
   The adapter rewrites only `TIMESTAMP`/`DATETIME`, not `DATE`, so for `DATE`
   columns Prisma yields **UTC midnight** (`2026-01-05T00:00:00.000Z`) whereas
   mysql2/TypeORM yielded **local midnight** (`2026-01-04T18:00:00.000Z`) for the
   same stored `2026-01-05`. No driver/session setting aligns both. Prisma's
   value is the better date-only representation (slicing the ISO string yields
   the correct calendar date). Wave 1's `DATE` columns (`teachers.joint_date`,
   `notices.publish_date`) hold no rows, so parity is unaffected; **later-wave
   parity probes that touch `DATE` columns must project them to `YYYY-MM-DD`**
   rather than compare the instant.

### Verification evidence

- `prisma validate` valid; `prisma migrate status` → **up to date** (no schema or
  migration change in this wave).
- `pnpm build` clean (`prisma generate && nest build`).
- `pnpm test` → **73 passed / 13 suites**.
- `pnpm parity` → **OK — 14 probe(s) match baseline.json** (Prisma output equals
  the TypeORM golden).
- `pnpm prisma:smoke` → connected to `11.7.1-MariaDB`, `users = 7`.
- Nest DI graph boots (the parity run initialises `AppModule`, both the TypeORM
  DataSource and the Prisma client).
- Wave 1 gate: the 10 modules contain **zero** `typeorm`/`@nestjs/typeorm` usage;
  only `UserRole` (a plain enum) and one type-only `HeaderDisplayMode` import
  remain, both ORM-free.

### Deviations / notes

- **Wire format preserved** (user decision): the CMS endpoints keep snake_case
  `created_at`/`updated_at`. The parity harness therefore stays a strict equality
  check with no exceptions.
- `UpdateNoticeDto extends CreateNoticeDto`, so the notices `PATCH` still
  requires `title` (pre-existing DTO shape) — preserved, not changed.
- The `toWire`/`toDateValue` shims and the type-only `HeaderDisplayMode` import
  are transient: they disappear when entities are deleted at Wave 6.

### Next: Wave 2

Identity & access (`users`, `auth`, `permissions`, `menus`) — see §8. Per module:
record parity, swap to `PrismaService`, compare parity, rebuild. Watch for
password hashing (AD-P4 central `$extends`) and the `UserRole` enum.

---

## 16. Wave 2 completion log — Identity & access

**Status: complete + verified.** `users`, `auth`, `permissions`, `menus` now run
on `PrismaService`.

### What changed

- **Password hashing — central `$extends` (AD-P8 / Q4).** The
  `User.hashPassword` `@BeforeInsert`/`@BeforeUpdate` hook is gone.
  - `src/users/user.util.ts` — `hashPassword` (bcrypt `genSalt(10)` + `hash`,
    with the old `!startsWith('$2')` guard), `isPasswordHash`, and
    `comparePassword(user, plain)`.
  - `src/prisma/password-hashing.extension.ts` —
    `Prisma.defineExtension` query extension intercepting
    `users.create`/`createMany`/`update`/`upsert`, so the invariant holds at
    every call site.
  - `PrismaService`'s constructor returns
    `this.$extends(passwordHashingExtension) as unknown as PrismaService`, so the
    injected provider *is* the extended client. Nest still resolves
    `onModuleInit`/`onModuleDestroy` through the proxy (proven by the harness
    boot + smoke).
  - `AuthService` calls `comparePassword(user, dto.password)`.
- **`users`.** `UsersService` → `PrismaService`; results funnel through
  `toWire`/`toWireList` (snake_case `created_at`/`updated_at`, unchanged).
  - `findAll`/`findOne` keep the identical `select` subsets.
  - `update` keeps the old find-then-save flow (404 first) and selects the same
    partial field set — **no `password`** and `updated_at` present.
  - `updateLastLogin` writes only `lastLoginAt`.
  - `UserRecord = Wire<Users>` is exported for `AuthService.validateUser`.
- **`permissions`.** Explicit field mappers (Prisma base model types exclude
  relations, so spreading would leak `modules`/`userPermissions`):
  `moduleId`→`module_id`, `createdAt`→`created_at`, include `modules`→`module`;
  `UserPermissions` snake_cased (`userId`→`user_id`, …). Composite key
  `userId_permissionId`. `revokePermission` uses `deleteMany` so a missing grant
  is a silent no-op exactly like TypeORM's `delete` (avoids Prisma `P2025`).
- **`menus`.** `MenusService` → `PrismaService`; `replaceTree` wraps
  `prisma.$transaction` (delete then recursive create, `sort_order = index`).
  `MenuLocation` moved to `src/menus/menu-item.constants.ts` (AD-P9) so the
  service/controller no longer import the entity; `menus.module.ts` drops
  `TypeOrmModule.forFeature`.
- **Modules.** `users.module.ts`/`permissions.module.ts`/`menus.module.ts` drop
  `TypeOrmModule.forFeature`; `PrismaService` is injected from the `@Global()`
  `PrismaModule`. `auth.module.ts` unchanged (already ORM-free).

### Parity (gate)

Ten Wave 2 probes were added and the golden **recorded from the pre-wave TypeORM
services** (the four modules were temporarily restored from `HEAD` via
`git stash`, then re-applied). After the swap, **all 24 probes match
`baseline.json`**, including self-cleaning write probes that exercise the real
write paths:

- reads — `users.findAll`, `users.findByEmail`, `users.findOne`,
  `permissions.findAll`, `permissions.getUserPermissions`,
  `menus.publicTree`, `menus.fullTree`;
- writes (deterministic, self-cleaning) — `auth.register-login` (register →
  login → wrong password rejected → cleanup), `permissions.assign-revoke`
  (assign → list → revoke → list → cleanup), `menus.replace-tree` (round-trips
  a temp `parity-w2` location, ids stripped, then cleans up).

There is no logout endpoint (JWT is stateless), so the gate's "logout" is N/A.

### Tests

**+29 Jest specs** (`user.util` 3, `users.service` 10, `permissions.service` 13,
`menus.service` 3) → **102 passed / 17 suites**.
`test/support/prisma-mock.ts` gained `users`/`permissions`/`userPermissions`/
`menuItems` models, `createMany`/`deleteMany` methods, and a `$transaction` that
runs the callback with the mock as the tx client.

### Evidence

- `pnpm build` clean; `pnpm test` 102/102; `pnpm parity` →
  **OK — 24 probes match baseline.json**.
- `prisma validate` valid; `prisma migrate status` up to date;
  `pnpm prisma:smoke` `users = 7`.
- Zero `typeorm`/`@nestjs/typeorm` usage in the four modules; only the plain
  `UserRole` enum imports remain (ORM-free).
- Post-run DB check: no leftover `parity-wave2*` users / `parity-w2` menu rows;
  `users = 7`, `menu_items = 59`.

### Findings / deviations

1. **`users.create` / `auth.register` still return the bcrypt hash**
   (pre-existing: the old `save()` returned the full entity, and there is no
   `ClassSerializerInterceptor` despite the `@Exclude()` on `password`). Preserved
   for strict parity — a candidate follow-up hardening task, not a migration
   change.
2. The `permissions` relation is introspected as `modules` (a **singular**
   relation with a plural name); it maps to the entity's `module`. Prisma's
   `Prisma.*Model` types omit relations, so the wire helpers build explicit
   objects instead of spreading.
3. Live DB has only 2 permission rows (`update-navigation-menu`,
   `view-website-management`) and an empty `user_permissions`; probes reference
   those names/ids rather than the seed catalog.
4. `@BeforeUpdate` never re-hashed on `update` because the old `findOne` select
   excluded `password`; the extension preserves that (only hashes when a
   `password` is present in the write data).

### Next: Wave 3

Documents & uploads (`documents`, `uploads`) — see §8. Gate: document list/fetch
parity; PDF route smoke test.

## 17. Wave 3 completion log — Documents & uploads

**Status: complete + verified.** `documents` now runs on `PrismaService`;
`uploads` has **no repository usage at all** (disk-storage Multer controller only)
so there was nothing to migrate.

### What changed

- **`DocumentsService` → `PrismaService`.** The five injected repositories
  (`PaymentCollection`, `StudentInvoice`, `StudentInvoiceLine`, `SiteSetting`,
  `User`) became `prisma.paymentCollections` / `studentInvoices` /
  `studentInvoiceLines` / `siteSettings` / `users`. Logic, argument strings and
  every PDF field are byte-for-byte the same.
  - Entity relations → Prisma relations: `invoice`→`studentInvoices`,
    `cashGl`→`chartOfAccounts`, `feeHead`→`feeHeads`, `glAccount`→`chartOfAccounts`.
    (`student_invoices`/`student_invoice_lines`/`payment_collections`/`funds` are
    still owned by the TypeORM accounting modules until Wave 5 — reading them
    through Prisma now is the strangler pattern in action.)
  - `letterhead()` keeps TypeORM's `find({ take: 1 })` semantics with
    `siteSettings.findFirst()` (both emit `SELECT … LIMIT 1`).
  - `actorName()` → `users.findUnique({ where: { id } })`.
- **`moneyReceiptPdf`** reads `include: { studentInvoices, chartOfAccounts }`
  (`fund` was loaded by the old join but never read, so it is dropped — output
  neutral).
- **`studentInvoicePdf`** reads `studentInvoiceLines.findMany({ where: { invoiceId },
  include: { feeHeads, chartOfAccounts } })`.
- **`genericReportPdf`** is unchanged apart from the data source for `letterhead()`.
- The local `money()` helper widens its parameter to `unknown` (it already did
  `String(v)` first) so Prisma's `Decimal` values flow through unchanged —
  `new Decimal(String(v)).toFixed(2)` is the same normalisation as before.
- **`documents.module.ts`** drops `TypeOrmModule.forFeature`; `PrismaService` is
  injected from the `@Global()` `PrismaModule`.

### Parity (gate)

Four Wave 3 probes were added; the golden was **recorded from the pre-wave
TypeORM service** (the two `documents` files were temporarily restored from
`HEAD`, then re-applied). After the swap **all 28 probes match `baseline.json`**:

- `wave3.documents.money-receipt.not-found` → `404` (exercises the query +
  `NotFoundException` branch);
- `wave3.documents.student-invoice.not-found` → `404`;
- `wave3.documents.generic-report-pdf` → filename + visible text (exercises the
  full builder + `letterhead()`);
- `wave3.documents.fixture-pdfs` → renders **both** the money receipt and the
  student invoice from a self-cleaning fixture (invoice + 2 lines + collection,
  built through Prisma against the seeded `fiscal_periods`/`chart_of_accounts`/
  `fee_heads`/`funds`), so the relation includes are truly exercised.

### Finding — PDF bytes are not a parity signal

A byte-level `sha256` probe **failed**: pdf-lib stamps `/ModDate (D:…)` on every
`save()` (second granularity) and renames embedded fonts with a random suffix
(`/Helvetica-9742682568`), so two renders of identical input differ byte-for-byte.
The probes therefore compare the **visible text**, extracted from the (inflated)
content streams' `Tj` operands (`pdfTextLines`), with today's date normalised to
`<TODAY>` so the golden is date-stable. The fixture uses **fixed UUIDs** for the
invoice/line/collection rows so the two invoice lines keep a stable (PK) order.

### Tests

**+10 Jest specs** (`documents.service` 10 — broken/not-found paths, allocation
vs. fallback row, TDR total, collector fallback, invoice relation mapping +
balance-due arithmetic, generic-report slug/default signatures/letterhead) →
**112 passed / 18 suites**. `test/support/prisma-mock.ts` gained
`paymentCollections`/`studentInvoices`/`studentInvoiceLines`.

### Evidence

- `pnpm build` clean; `pnpm test` 112/112; `pnpm parity` →
  **OK — 28 probes match baseline.json**.
- `prisma validate` valid; `prisma migrate status` up to date;
  `pnpm prisma:smoke` `users = 7`.
- Zero `typeorm`/`@nestjs/typeorm` usage in `src/documents` + `src/uploads`.
- Post-run DB check: `payment_collections = 0`, `student_invoices = 0`,
  `student_invoice_lines = 0` (fixture fully cleaned; no `PARITY-W3%` rows).

### Findings / deviations

1. `uploads` was already ORM-free (Multer `diskStorage` + UUID filenames); the
   Wave 3 "any repository usage" clause is vacuous for it.
2. The PDF route "smoke test" is satisfied by the text-extraction probes above;
   the 404 probes cover the not-found branches of both document types.
3. `documents.service.ts` still declares its own `GenericReportPdfDto` interface
   while the controller imports the class from `documents.dto.ts` (pre-existing
   duplication; structurally compatible) — preserved.

### Next: Wave 4

Admissions (transactions + locks) — `admission-application`,
`admission-dashboard`, `family-registry`, `required-document-rule`,
`student-documents`, `student-lifecycle`, `student-onboarding`,
`subject-enrollment`, `waiver-calculator`, `common/sequence.service` — see §8.
Special: `sequence.service` pessimistic lock → AD-P7; onboarding `EntityManager`
threading → `Prisma.TransactionClient`; dashboard query-builder aggregates →
`where`/`_count` or `$queryRaw`. Gate: direct-admission wizard E2E; roll
generator under concurrency; parity on dashboard aggregates.

