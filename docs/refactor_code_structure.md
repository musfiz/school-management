# Refactor Code Structure Plan

Goal: bring `apps/api` (NestJS) and `apps/web` (Next.js) to an industry-standard structure, with security fixed first, then tooling, then refactors protected by lint, typecheck and tests.

## 1. Review Summary

### apps/api

Strengths
- Feature modules (controller, service, DTO) for auth, users, menus, pages, sliders, staff, teachers and others.
- Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) and Swagger decorators on DTOs.
- Global JWT guard with `@Public()` opt-out, `@Roles` and `@Permissions` guards.
- TypeORM with `synchronize: false` and migrations; upload MIME and size limits.

Problems

| # | Issue | Severity |
|---|---|---|
| 1 | `POST /migrate` and `POST /migrate/revert` are `@Public()` in `apps/api/src/app.controller.ts` | Critical |
| 2 | `tsconfig.json` has `strictNullChecks`, `noImplicitAny`, `forceConsistentCasingInFileNames` disabled | High |
| 3 | No tests, no ESLint/Prettier config, no `test`/`lint` script | High |
| 4 | No global exception filter, no structured logger, no Helmet, no rate limiting | High |
| 5 | Config is a plain `config()` function, not `@nestjs/config` with validation | Medium |
| 6 | CRUD services (sliders, staff, teachers, ex-principals, governing-body) repeat the same code | Medium |
| 7 | Entities listed by hand in `database/data-source.ts` (runtime-only failure when one is forgotten) | Medium |
| 8 | `PermissionsService` and `MenusService` do too much; `seed.ts` has hardcoded passwords and no `NODE_ENV` guard | Medium |
| 9 | `UpdateUserDto.isActive` reportedly uses `@IsString()` on a boolean (unverified) | Low |
| 10 | `common/` has only decorators and guards; no filters, interceptors or utils | Low |

### apps/web

Strengths
- Route groups `(public)` and `(protected)` with `loading`, `error`, `not-found`.
- Strict TypeScript, cookie-based i18n with typed messages, SEO files (`robots`, `sitemap`, JSON-LD).
- JWT check in the proxy, HTML sanitiser, browser never calls the API directly.

Problems

| # | Issue | Severity |
|---|---|---|
| 1 | `API_BASE` copied into 32 files (21 `app/api/**/route.ts`, 9 `lib/*.ts`, plus others); routes repeat `authHeaders()` and fetch boilerplate | High |
| 2 | `lib/` is flat (about 24 files mixing API clients, auth, UI helpers, data) | High |
| 3 | `components/` is flat; `Header.tsx`, `PageEditor.tsx`, `Sidebar.tsx`, `lib/dashboard-nav.ts` (about 380 lines) are too large | Medium |
| 4 | No tests; no `typecheck` task in `turbo.json`; no lint/format config shared with the API | High |
| 5 | `lib/site.ts`, `lib/content/*` and footer links hold mock or hardcoded, duplicated data | Medium |
| 6 | No environment validation; `NEXT_PUBLIC_API_BASE_URL` used for server-side calls | Medium |
| 7 | Client-only modules (`lib/api.ts`, `lib/modules.ts`, `lib/permissions.ts`) sit beside server code | Medium |
| 8 | `RoleProvider` has a mock role setter; `NoticeTicker` duplicates its whole list to loop | Low |

### Monorepo
- `packages/shared-types` holds only `School` and `Student`, so web and API types can drift.
- `uploads/` exists at the repo root and in `apps/api/uploads/`.
- CI has no test or typecheck step; no pre-commit hook; no `.editorconfig`.

## 2. Plan

### Phase 0: Security (first, independent)
1. In `app.controller.ts`, remove `@Public()` from the migrate routes. Preferred: delete them and use the CLI migration scripts. Alternative: restrict to Admin.
2. Add a `NODE_ENV` guard to `database/seed.ts`.
3. Fix `UpdateUserDto.isActive` to use `@IsBoolean()`.

### Phase 1: Tooling (parallel with Phase 0)
4. Add a root ESLint flat config, Prettier config and `.editorconfig`; apply to both apps with `lint`, `format`, `typecheck` scripts.
5. Add a `typecheck` task to `turbo.json`.
6. Add Jest to the API and Vitest to the web app, plus a `test` task.
7. Update `.github/workflows/ci.yml` to run lint, typecheck and test before build.
8. Optional: husky and lint-staged.

### Phase 2: Web refactor (depends on step 4)
9. Create `lib/config/env.ts` that validates the environment with Zod and exports the server-only `API_BASE_URL` plus public values. Replace all `API_BASE` copies.
10. Create `lib/server/api-proxy.ts` with `authHeaders()` and `proxyToApi(path, req)`. Reduce the 21 route files to a few lines each.
11. Reorganise `lib/`:
    ```
    lib/
      api/        staff, teachers, sliders, menus, pages, site-settings, ...
      auth/       auth, session-cookie, login-variant, validations
      config/     env
      dashboard/  nav types, nav filters, nav tree, overview
      seo/        jsonld
      server/     api-proxy
      utils/      media, sanitize-html, swal
    ```
    Split `dashboard-nav.ts` into types, filters and the nav tree.
12. Reorganise `components/` by area:
    ```
    components/
      layout/     Header, Footer, NoticeTicker
      home/       Hero, HeroSlider, HomeSections
      dashboard/  existing dashboard components
      ui/         one file per primitive (split index.tsx)
      shared/     ContentRenderer, ContentNotFound, icons
    ```
    Split `Header` and `PageEditor` into subcomponents.
13. Move mock content (`lib/content`, `lib/site.ts`) to `src/data/` or replace it with `site-settings` data; remove duplicated footer links.
14. Remove the mock `setRole` from `RoleProvider`; make `NoticeTicker` use a CSS-only loop.
15. Mark client-only modules explicitly (`"use client"` or a `client` folder) and keep server code separate.

### Phase 3: API refactor (depends on step 4)
16. Switch to `@nestjs/config` with schema validation and a typed `ConfigService`; delete the `config()` function.
17. Add `common/filters/all-exceptions.filter.ts`, `common/interceptors/logging.interceptor.ts` and a Nest `Logger` or Pino. Add Helmet and `@nestjs/throttler` (stricter on login).
18. Replace the manual entity list with `autoLoadEntities` or a glob that works under both ts-node and `dist`. Keep the note in repo memory about entity registration in mind.
19. Add an abstract `BaseCrudService<T>` and use it in the repeated CRUD services.
20. Split `PermissionsService` into catalog and user-assignment services; move `MenusService.buildTree` into a utility.
21. Enable strict TypeScript in steps: `forceConsistentCasingInFileNames`, then `noImplicitAny`, then `strictNullChecks`, fixing errors module by module.
22. Centralise the uploads path in one config value; delete the root `uploads/` and keep a single location.

Target API layout:
```
apps/api/src/
  common/
    decorators/  filters/  guards/  interceptors/  utils/
  config/
  database/
    entities/  migrations/  seed/
  <feature>/     controller, service, dto/, tests
```

### Phase 4: Shared contracts (parallel with Phase 2)
23. Expand `packages/shared-types` with response shapes and enums (`UserRole`, `MenuLocation`, page, slider, staff, and so on) and use them in both apps.

### Phase 5: Tests (depends on step 6)
24. API: unit tests for `AuthService`, the guards and `MenusService.buildTree`; a supertest e2e for login and a protected route.
25. Web: tests for `verifyJwt`, `sanitize-html`, `filterNavForRole`, `resolveImageUrl` and `proxyToApi`.

## 3. Key Files
- `apps/api/src/app.controller.ts`, `config.ts`, `main.ts`, `tsconfig.json`, `database/data-source.ts`
- `apps/api/src/permissions/permissions.service.ts`, `menus/menus.service.ts`
- `apps/web/src/app/api/**/route.ts`, `apps/web/src/lib/*`, `apps/web/src/components/*`
- `turbo.json`, root `package.json`, `.github/workflows/ci.yml`, `packages/shared-types/src/index.ts`

## 4. Verification
1. After each phase run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` from the repo root.
2. `grep` for `localhost:3031` and `API_BASE =` in `apps/web/src`; it should match only `lib/config/env.ts`.
3. Manual check: log in, open each admin CMS page, save a slider, a staff member and a page, switch locale, upload an image.
4. `POST /migrate` must return 401 or 403 without an admin token (or 404 if removed).
5. Run the API with `node --watch -r ts-node/register -r tsconfig-paths/register src/main.ts`, not `tsx`.

## 5. Scope
- Included: structure, tooling, config, error handling, security, tests.
- Excluded: new features, database schema changes, soft deletes, URL-based i18n.

## 6. Decisions to Confirm
1. Migrate endpoints: remove them and use CLI scripts (recommended) or keep behind Admin only.
2. Web `components/` layout: group by area (recommended) or full feature folders.
3. API strict TypeScript: enable in steps (recommended) rather than all at once.
