# Project Configuration Analysis & Maintenance Plan

> **Generated:** 2026-08-30 | **Scope:** Full monorepo audit  
> **Stack:** Turborepo · pnpm · Next.js 16 · NestJS 11 · TypeORM · MySQL · TypeScript 6

---

## 1. Project Structure & Setup — ✅ Solid Foundation

- Turborepo + pnpm workspaces properly configured (`apps/*`, `packages/*`)
- CI pipeline via GitHub Actions — lint + build on PR/push to `main`
- Conventional commits, branching strategy, PR process documented in `CONTRIBUTING.md`
- `.env.example` files present for root, api, and web
- `.gitignore` is comprehensive and well-organised

---

## 2. TypeScript Version Audit — ⚠️ Mixed Strictness

All three packages use **TypeScript ^6.0.3** with `ignoreDeprecations: "6.0"`.

| Package | Target | Module | moduleResolution | Strict |
|---------|--------|--------|------------------|--------|
| `apps/api` | ES2021 | commonjs | node | **❌ OFF** |
| `apps/web` | ES5 | esnext | bundler | ✅ ON |
| `packages/shared-types` | ES2021 | commonjs | — (default) | ✅ ON |

### Issues

| # | Finding | File |
|---|---------|------|
| 1 | API disables `strictNullChecks`, `noImplicitAny`, `strictBindCallApply`, and `forceConsistentCasingInFileNames` — contradicts CONTRIBUTING.md ("TypeScript everywhere, no `any` without justification") | `apps/api/tsconfig.json` |
| 2 | No root `tsconfig.base.json` — compiler options are duplicated across all 3 packages | — |
| 3 | API sets `useDefineForClassFields: false` to keep legacy class-field semantics for decorators — acceptable for NestJS but should be documented | `apps/api/tsconfig.json` |

---

## 3. Dependency Version Audit — ⚠️ Several Concerns

### Root

| Dependency | Version | Issue |
|------------|---------|-------|
| `turbo` | `latest` | **Unpinned** — any breaking release will break CI. Pin to e.g. `^2.5.0` |

### API (`apps/api`)

| Dependency | Version | Issue |
|------------|---------|-------|
| `@nestjs/*` | ^11.x | Core ecosystem aligned ✅ |
| `typescript` | ^6.0.3 | Matches web & shared-types ✅ |
| `@types/node` | `26.3.0` | Pinned **without caret** — won't receive patch-level type fixes |
| `dotenv` | ^17.4.2 | **Redundant** — `@nestjs/config` already loads `.env` via `dotenv` internally |
| `typeorm` | ^0.3.20 | Compatible with `mysql2` ^3.x ✅ |
| `bcryptjs` | ^2.4.3 | Stable, no issues ✅ |

### Web (`apps/web`)

| Dependency | Version | Issue |
|------------|---------|-------|
| `next` | ^16.3.3 | Latest major ✅ |
| `react` / `react-dom` | `19.2.8` | Pinned **without caret** — won't receive patch updates |
| `zod` | ^4.5.2 | Zod 4 is a recent major — verify no breaking changes from v3 |
| `tailwindcss` | `4.3.3` | Pinned without caret; TW v4 is a major rewrite — confirm all utilities are v4-compatible |
| `eslint` | `10.9.1` | Pinned without caret |

### Shared Types (`packages/shared-types`)

| Finding | Detail |
|---------|--------|
| Only 2 placeholder interfaces (`School`, `Student`) | Not consumed by either app yet |
| No runtime dependencies | Clean ✅ |

---

## 4. Build Pipeline — ⚠️ Issues Found

### Turbo Pipeline (`turbo.json`)

- `build` depends on `^build` (transitive) and caches `.next/**`, `dist/**` ✅
- `dev` is persistent, uncached ✅
- **No `test` task** defined
- **No `typecheck` task** defined

### API Build

| # | Finding | File | Severity |
|---|---------|------|----------|
| 1 | TypeORM entity glob `'src/database/entities/*.entity.{ts,js}'` resolves at **source** paths — will **fail** when running from `dist/` in production | `apps/api/src/database/data-source.ts` | 🔴 |
| 2 | `synchronize: true` — auto-syncs schema from entities, can silently drop columns/data in production | `apps/api/src/database/data-source.ts` | 🔴 |
| 3 | NestJS CLI `deleteOutDir: true` ✅ | `nest-cli.json` | — |

### Web Build

| # | Finding | File |
|---|---------|------|
| 1 | No `output: 'standalone'` — needed for optimised Docker images | `next.config.ts` |
| 2 | Standard `next build` otherwise ✅ | — |

### CI Pipeline (`.github/workflows/ci.yml`)

- pnpm v11 + Node 20, `--frozen-lockfile` ✅
- **No test step** — only lint + build
- No explicit caching strategy beyond pnpm's built-in

---

## 5. Security Audit — ⚠️ Items to Address

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | JWT fallback secret hardcoded: `'fallback-secret-change-in-production'` | 🔴 HIGH | `apps/api/src/config.ts` |
| 2 | `synchronize: true` bypasses migration safety | 🔴 HIGH | `apps/api/src/database/data-source.ts` |
| 3 | `app.enableCors()` with **no origin restriction** — any domain can call the API | 🟡 MEDIUM | `apps/api/src/main.ts` |
| 4 | Seed script logs user passwords to console | 🟡 MEDIUM | `apps/api/src/database/seed.ts` |
| 5 | No rate limiting on auth endpoints (login/register) | 🟡 MEDIUM | `apps/api/src/auth/auth.controller.ts` |
| 6 | No global exception filter — unhandled errors return raw 500 | 🟡 MEDIUM | `apps/api/src/main.ts` |
| 7 | `apps/api/.env.example` contains a real-looking JWT secret value | 🟡 MEDIUM | `apps/api/.env.example` |

---

## 6. Linting & Formatting — ⚠️ Inconsistent

| Tool | Root | API | Web |
|------|------|-----|-----|
| ESLint config | ❌ None | ❌ **None** (script exists, config missing) | ✅ `.eslintrc.json` |
| Prettier config | ❌ None | ❌ None | ✅ `.prettierrc.json` |
| EditorConfig | ❌ None | ❌ None | ❌ None |

- API `package.json` defines a lint script (`eslint "{src,apps,libs}/**/*.ts" --fix`) but **no ESLint config file exists** — this will either fail or use bare defaults.
- `CONTRIBUTING.md` references "ESLint/Prettier shared configs" — these do not exist at root level.

---

## 7. Missing Professional Standards

| Item | Status | Impact |
|------|--------|--------|
| Testing framework (Jest / Vitest) | ❌ Not configured | No test runner, no test scripts in any package |
| Pre-commit hooks (Husky + lint-staged) | ❌ Missing | No automated quality gates before commit |
| Docker / Containerisation | ❌ Missing | No `Dockerfile` or `docker-compose.yml` |
| Root `tsconfig.base.json` | ❌ Missing | Duplicated compiler options across 3 packages |
| Health check endpoint | ❌ Missing | No `/health` for load-balancer probes |
| API versioning (`/api/v1`) | ❌ Missing | No version prefix structure |
| Environment validation at startup | ❌ Missing | API starts even if `JWT_SECRET` is unset |
| Structured logging (pino / winston) | ❌ Missing | Uses `console.log` throughout |
| Error tracking (Sentry, etc.) | ❌ Missing | No production error monitoring |
| Database migration strategy | ⚠️ Incomplete | Migration files exist but `synchronize: true` bypasses them |

---

## Recommended Action Plan

### Phase 1 — Critical Fixes (Security & Data Safety)

1. **Disable `synchronize: true`** in `data-source.ts` — rely on migrations only
2. **Remove JWT fallback secret** from `config.ts` — throw at startup if `JWT_SECRET` is unset
3. **Add env validation** at API bootstrap (fail fast if `JWT_SECRET`, `DB_HOST`, `DB_DATABASE` are missing)
4. **Restrict CORS** origins to the known frontend URL via env var
5. **Replace** the real-looking JWT secret in `apps/api/.env.example` with `<replace-me>`

### Phase 2 — Build & Tooling Consistency

6. **Pin `turbo`** to a specific version (e.g. `^2.5.0`)
7. **Create `tsconfig.base.json`** at root and `extends` it in all 3 packages
8. **Add ESLint config** for API app + shared root ESLint config
9. **Add root-level Prettier config** + `.editorconfig`
10. **Fix TypeORM entity paths** for production — use class references (`entities: [User]`) instead of globs
11. **Remove redundant `dotenv`** from API dependencies

### Phase 3 — Quality Gates

12. **Set up testing** — Jest for API, Vitest for Web
13. **Add `test` task** to `turbo.json` and test step to CI workflow
14. **Install Husky + lint-staged** for pre-commit linting/formatting
15. **Enable TypeScript strict mode in API** — incremental adoption (`strictNullChecks` first, then `noImplicitAny`)

### Phase 4 — Production Readiness

16. **Add `Dockerfile`** + `docker-compose.yml` (API + MySQL + Web)
17. **Add health check endpoint** (`GET /health`) to API
18. **Add rate limiting** to auth endpoints (`@nestjs/throttler`)
19. **Add global exception filter** with structured error responses
20. **Integrate structured logging** (e.g. `nestjs-pino`)
21. **Add `output: 'standalone'`** to `next.config.ts` for Docker builds

### Phase 5 — Ongoing Maintenance

22. **Set up Dependabot or Renovate** for automated dependency updates
23. **Add error tracking** (Sentry or equivalent)
24. **Populate `shared-types`** with actual shared interfaces — API DTOs, response envelopes, role enums
25. **Document local setup** in root `README.md` (currently only in `CONTRIBUTING.md`)

---

## Verification Checklist

After implementing each phase, confirm:

- [ ] `pnpm build` succeeds across all packages
- [ ] `pnpm lint` passes with the new ESLint configs
- [ ] API starts and responds to requests without `synchronize: true`
- [ ] Migrations run cleanly (`pnpm --filter api migration:run`)
- [ ] Login / auth flow works end-to-end
- [ ] CI pipeline passes lint → build → test
- [ ] No secrets or fallback values remain in committed code

---

## Key Decisions (No Change Needed)

| Decision | Rationale |
|----------|-----------|
| TypeScript 6.0.3 + `ignoreDeprecations: "6.0"` | Acceptable for current TS 6.x lifecycle |
| CommonJS in API / ESM in Web | Standard for NestJS and Next.js respectively |
| MySQL | Established choice, well-supported by TypeORM |
| Separate validation libs (class-validator in API, Zod in Web) | Each framework's idiomatic choice |
