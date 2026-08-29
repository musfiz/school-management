# Contributing to School Management

Thanks for your interest in contributing! This guide covers the workflow, conventions,
and quality bar for changes in this monorepo.

## Code of Conduct

Be respectful, inclusive, and constructive. We follow the
[Contributor Covenant](https://www.contributor-covenant.org/).

## Development Setup

1. Install [Node.js 20+](https://nodejs.org/) and [pnpm 11+](https://pnpm.io/installation).
2. Clone the repository and install dependencies from the root:
   ```sh
   pnpm install
   ```
3. Copy the environment template and fill in any values you need:
   ```sh
   cp .env.example .env
   ```
4. Verify everything builds:
   ```sh
   pnpm build
   ```

## Monorepo Layout

```
.
├── apps/
│   ├── web/      # Next.js 16 frontend (port 3000)
│   └── api/      # NestJS 11 backend (port 4000)
├── packages/
│   └── shared-types/   # Shared TypeScript types (consumed by web + api)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

Each app/package is a self-contained workspace. Use the workspace name when filtering
Turbo tasks, e.g. `pnpm --filter web dev` or `pnpm --filter api build`.

## Branching Strategy

- `main` — always deployable; protected.
- `feature/<short-description>` — new features.
- `fix/<short-description>` — bug fixes.
- `chore/<short-description>` — tooling, deps, docs.
- `release/<version>` — release prep.

Keep branches short-lived and focused.

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<body — explain the "why", not the "what">

<footer — references and breaking changes>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`.
Scope examples: `web`, `api`, `shared-types`, `tooling`.

Examples:
- `feat(web): add notice ticker to homepage`
- `fix(api): handle null student on results endpoint`
- `chore(deps): bump next to 16.3.3`

## Pull Request Process

1. Fork or branch from `main`.
2. Make your changes in a focused branch.
3. Run quality checks before opening the PR:
   ```sh
   pnpm lint
   pnpm build
   ```
4. Open a PR using the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
5. Link the related issue (`Closes #123`).
6. Request a review from a [CODEOWNER](.github/CODEOWNERS) of the area you touched.
7. Address review feedback by pushing new commits (do not force-push during review).
8. Squash-merge once approved and CI is green.

## Code Style

- **TypeScript** everywhere. No `any` unless justified with a comment.
- Use the shared ESLint / Prettier configs.
- Match the existing code's style — read the surrounding file before editing.
- Keep functions small and side effects explicit.
- Frontend (Next.js): prefer server components, use `'use client'` only when needed.
- Backend (NestJS): keep modules cohesive, one responsibility per service.

## Testing

- Add or update unit tests for any behavior change.
- Place tests next to source files (`*.spec.ts` / `*.test.tsx`).
- Aim for coverage on the public API of each module.

## Working Across Apps

When a change touches both `apps/web` and `apps/api`:

1. Update the shared types in `packages/shared-types` first.
2. Build the shared package: `pnpm --filter shared-types build`.
3. Then implement the change in `apps/api`.
4. Then consume the change in `apps/web`.

Turbo's `^build` dependency ensures shared-types is built before dependents.

## Reporting Issues

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:
steps to reproduce, expected vs actual behavior, environment details, and logs.

## Security

If you discover a security vulnerability, **do not open a public issue**. Email
the maintainer directly (see the repository's `SECURITY.md` if present, or contact
a maintainer) so it can be patched before disclosure.
