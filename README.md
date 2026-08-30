# School Management

A monorepo for a school management platform — a **Next.js** web frontend, a
**NestJS** API, and a shared TypeScript types package — orchestrated with
**Turborepo** and **pnpm workspaces**.

> Status: **early development**. APIs, models, and UI are subject to change.

---

## 📑 Table of Contents

1. [Architecture](#-architecture)
2. [Tech Stack](#-tech-stack)
3. [Prerequisites](#-prerequisites)
4. [Getting Started](#-getting-started)
5. [Working with Individual Apps](#-working-with-individual-apps)
6. [Common Scripts](#-common-scripts)
7. [Project Structure](#-project-structure)
8. [Environment Variables](#-environment-variables)
9. [Team Workflow by Role](#-team-workflow-by-role)
10. [Shared Types — How `web` and `api` Stay in Sync](#-shared-types--how-web-and-api-stay-in-sync)
11. [CI / Build & Lint](#-ci--build--lint)
12. [Deployment Notes](#-deployment-notes)
13. [Documentation](#-documentation)
14. [License](#-license)

---

## 🏗️ Architecture

```
┌──────────────────────────┐        HTTP/JSON         ┌──────────────────────────┐
│   apps/web  (Next.js)    │ ───────────────────────▶ │   apps/api  (NestJS)     │
│   http://localhost:3000  │                          │   http://localhost:4000  │
└──────────────────────────┘                          └──────────────────────────┘
            │                                                      │
            └──────────────────────┬───────────────────────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │  packages/shared-types       │
                    │  (TypeScript types)          │
                    └──────────────────────────────┘
```

- **`apps/web`** — Public-facing site and dashboard. Next.js App Router, server-first.
- **`apps/api`** — Backend HTTP API. NestJS with CORS enabled, listening on `:4000`.
- **`packages/shared-types`** — Single source of truth for request/response shapes
  shared by both apps. Built to `dist/` and consumed via `package.json` `main`/`types`.

## 🧰 Tech Stack

| Layer        | Tooling                                                   |
| ------------ | --------------------------------------------------------- |
| Package mgr. | [pnpm](https://pnpm.io) 11+ with workspaces               |
| Monorepo     | [Turborepo](https://turborepo.dev)                        |
| Frontend     | [Next.js](https://nextjs.org) 16, React 19, Tailwind 4    |
| Backend      | [NestJS](https://nestjs.com) 11, TypeScript 6             |
| Shared       | TypeScript 6 (compiled to CommonJS + `.d.ts`)             |
| Lint/Format  | ESLint (Next config) + Prettier                           |

## ✅ Prerequisites

Install the following before cloning:

- **Node.js 20+** — [download](https://nodejs.org/)
- **pnpm 11+** — `npm install -g pnpm` or follow [pnpm installation](https://pnpm.io/installation)
- **Git** — for version control

Verify:

```sh
node -v    # v20.x or newer
pnpm -v    # 11.x or newer
git --version
```

## 🚀 Getting Started

### 1. Clone the repository

```sh
git clone https://github.com/<your-org>/school-management.git
cd school-management
```

### 2. Install dependencies (from the repo root)

```sh
pnpm install
```

This installs dependencies for every workspace (`apps/web`, `apps/api`,
`packages/shared-types`) in one pass.

### 3. Configure environment variables

```sh
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

Fill in any real values (DB URL, JWT secret, etc.) as needed. The defaults
already work for a local dev run with the bundled mocks.

### 4. Build the shared types (one-time, and after any type change)

```sh
pnpm --filter shared-types build
```

### 5. Start everything in dev mode

```sh
pnpm dev
```

This runs `turbo run dev`, which launches **all apps in parallel**:

| App          | URL                       |
| ------------ | ------------------------- |
| `apps/web`   | http://localhost:3000     |
| `apps/api`   | http://localhost:4000     |

You can also run them in **separate terminals** — useful for focused logs:

```sh
# terminal 1 — backend
pnpm --filter api dev

# terminal 2 — frontend
pnpm --filter web dev
```

## 👩‍💻 Working with Individual Apps

Use [pnpm filters](https://pnpm.io/filtering) to run a command against a single
workspace. This is the recommended way to work when a developer is responsible
for one app.

### Frontend developer — `apps/web`

```sh
# install (already done by root pnpm install)
pnpm --filter web install

# start dev server
pnpm --filter web dev

# build production bundle
pnpm --filter web build

# start production server (after build)
pnpm --filter web start

# lint
pnpm --filter web lint
```

You can also `cd apps/web` and use `pnpm` directly:

```sh
cd apps/web
pnpm dev
```

### Backend developer — `apps/api`

```sh
# install
pnpm --filter api install

# start dev server (NestJS on :4000)
pnpm --filter api dev

# build
pnpm --filter api build

# run compiled build
pnpm --filter api start

# lint
pnpm --filter api lint
```

Or:

```sh
cd apps/api
pnpm dev
```

### Shared types maintainer — `packages/shared-types`

```sh
# one-shot build
pnpm --filter shared-types build

# watch mode (rebuilds on save)
pnpm --filter shared-types dev

# clean
pnpm --filter shared-types clean
```

> The `api` and `web` apps depend on `shared-types` via Turbo's
> `^build` graph, so a `pnpm build` at the root always builds it first.

## 📜 Common Scripts

All scripts run from the repo root and are powered by Turborepo.

| Command          | What it does                                                   |
| ---------------- | -------------------------------------------------------------- |
| `pnpm dev`       | Runs `dev` in every workspace **in parallel** (watch mode)     |
| `pnpm build`     | Builds every workspace in dependency order, with caching       |
| `pnpm lint`      | Lints every workspace                                          |
| `pnpm clean`     | Removes build artifacts (delegated to each workspace)          |
| `pnpm typecheck` | Type-checks every workspace (if configured)                    |

Filter any of these with `--filter`:

```sh
pnpm dev --filter web
pnpm build --filter api
pnpm lint --filter shared-types
```

## 🗂️ Project Structure

```
school-management/
├── apps/
│   ├── web/                    # Next.js 16 — frontend
│   │   ├── src/
│   │   │   ├── app/            # App Router routes
│   │   │   ├── components/     # UI components
│   │   │   └── lib/            # Helpers, content, navigation
│   │   ├── public/
│   │   ├── .env.example
│   │   ├── next.config.*       # (when added)
│   │   └── package.json
│   │
│   └── api/                    # NestJS 11 — backend
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── app.controller.ts
│       │   ├── app.service.ts
│       │   └── main.ts
│       ├── .env.example
│       ├── nest-cli.json
│       └── package.json
│
├── packages/
│   └── shared-types/           # Shared TS types between web & api
│       ├── src/
│       ├── dist/               # build output (gitignored)
│       └── package.json
│
├── .github/
│   ├── CODEOWNERS
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── .vscode/                    # (optional) editor settings
├── .env.example                # root env template
├── .gitignore
├── .npmrc
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── SECURITY.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── turbo.json
```

## 🔐 Environment Variables

All apps follow Next.js / NestJS conventions. **Never commit real secrets** —
commit only the `.env.example` files.

| Scope       | File                    | Notes                                                              |
| ----------- | ----------------------- | ------------------------------------------------------------------ |
| Root        | `.env.example`          | Documents shared variables (template)                              |
| `apps/web`  | `apps/web/.env.example` | Vars prefixed with `NEXT_PUBLIC_` are exposed to the browser       |
| `apps/api`  | `apps/api/.env.example` | Server-only — CORS, DB, JWT, etc.                                  |

Local overrides go in `.env.local` (gitignored).

## 🤝 Team Workflow by Role

This monorepo is designed so **different developers can own different apps**
without stepping on each other.

### Frontend developer

- Owns `apps/web/`.
- Consumes shared types from `packages/shared-types`.
- Can mock API responses during UI work — no need to run the backend.
- Daily loop:
  ```sh
  pnpm --filter web dev
  pnpm --filter web lint
  pnpm --filter web build
  ```

### Backend developer

- Owns `apps/api/`.
- Defines and exports new shapes via `packages/shared-types`.
- Daily loop:
  ```sh
  pnpm --filter api dev
  pnpm --filter api lint
  pnpm --filter api build
  ```

### Cross-cutting / shared types owner

- Touches `packages/shared-types/` and Turbo config.
- Coordinates breaking changes with both teams.
- Daily loop:
  ```sh
  pnpm --filter shared-types dev   # watch mode
  pnpm build                      # verify dependent apps still build
  ```

### Tech lead / release manager

- Reviews PRs against [`.github/CODEOWNERS`](.github/CODEOWNERS).
- Owns `main` — only merges after CI and code-owner approvals.
- Cuts releases, updates [CHANGELOG.md](CHANGELOG.md).

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching, commit, and PR conventions.

## 🔄 Shared Types — How `web` and `api` Stay in Sync

1. **Define** a type in `packages/shared-types/src/index.ts` (or a new file).
2. **Build** the package:
   ```sh
   pnpm --filter shared-types build
   ```
3. **Consume** it from `apps/web` or `apps/api`:
   ```ts
   import type { School, Student } from 'shared-types';
   ```
   (Works because `shared-types` is a workspace package; the `main` / `types`
   fields in its `package.json` point at `dist/`.)

4. **Turbo** handles the build order — `web` and `api` always build
   `shared-types` first, thanks to `dependsOn: ["^build"]` in `turbo.json`.

> Tip: keep the shared package **types only** (interfaces, type aliases, enums,
> Zod schemas) — no runtime framework code. That keeps the dependency cheap.

## 🤖 CI / Build & Lint

Recommended GitHub Actions workflow (`.github/workflows/ci.yml`):

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm build
```

## 🚢 Deployment Notes

- **`apps/web`** — Best on [Vercel](https://vercel.com). Set `NEXT_PUBLIC_API_BASE_URL`
  to the deployed API URL. Turborepo + Vercel detect the Next.js app automatically.
- **`apps/api`** — Deploy to any Node host (Render, Fly.io, Railway, a VM, etc.).
  Build with `pnpm --filter api build`, run with `node apps/api/dist/main`.
- **Remote caching (optional)** — Run `pnpm exec turbo login && pnpm exec turbo link`
  to share Turborepo cache across CI and teammates.

## 📚 Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute, commit, and PR.
- [CHANGELOG.md](CHANGELOG.md) — release history.
- [SECURITY.md](SECURITY.md) — how to report vulnerabilities.
- [`.github/CODEOWNERS`](.github/CODEOWNERS) — who reviews what.
- [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/) — bug & feature request forms.
- [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) — PR checklist.

## 📄 License

[MIT](./LICENSE) © Contributors


netstat -ano | findstr "3030 3031 3032"

