# Dashboard Sidebar & RBAC Refactor — Implementation Plan

Status: DRAFT — awaiting review. No code has been changed yet.

## 1. Problem

Sidebar architecture (typed `nav-config.ts` → pure filters → server layout
fetches session + permissions in parallel → client Sidebar / CommandPalette)
is standard App Router practice and is KEPT. The permission layer is not
production-ready:

| # | Issue | Where |
|---|-------|-------|
| 1 | `DEV_BYPASS_ROLE_FILTER = true` hard-coded → every role sees everything, incl. production | `lib/nav-config.ts` |
| 2 | Three overlapping models: `roles` (unused), `legacyRoles` (active), `menuSlug` (DB) | `lib/nav-config.ts` |
| 3 | Only 13/81 leaves have `menuSlug`; unmapped items fail OPEN. Seeded `users`, `settings` unused | `nav-config.ts`, `api/scripts/seed-authorization.ts` |
| 4 | No page checks `canView` — any logged-in user opens any page by URL; `proxy.ts` only checks the cookie exists | `app/(protected)/admin/**` |
| 5 | Fail-open fallbacks: flags fetch failure → full nav; unknown role → `admin` | `lib/my-menus.ts`, `lib/auth.ts` |
| 6 | Duplicate tree `dashboardTree`; `flattenTree`/`moduleLabels` in permissions.ts have no callers | `lib/dashboard-nav.ts`, `lib/permissions.ts` |
| 7 | Two filters prune empty section dividers with different logic | `lib/nav-config.ts` |

## 2. Target design (decision)

- ONE gate: `menuSlug` → DB `menus` + `canView`. Role → default access lives in
  backend role templates (`ROLE_DEFAULTS`) + per-user overrides; frontend
  hard-codes no role arrays.
- Every group/leaf resolves to a slug (own, else group's). Missing slug = type error.
- Fail closed: missing flags / unknown role / failed fetch ⇒ only `dashboard`
  (superadmin keeps `bypassAll`).
- Pages guarded server-side with the same slug → sidebar, Ctrl+K and direct URL agree.
- Backend remains source of truth; UI gating is UX + defence-in-depth.

```
admin/layout.tsx (server)
  ├─ getSession() + fetchMyMenuFlags()   Promise.all (unchanged)
  ├─ DashboardShell → Sidebar / CommandPalette
  │     filterNav(navItems, flags)       ONE filter
  └─ segment layout.tsx
        await requireMenu("<slug>")      NEW → redirect /admin/forbidden
```

## 3. Proposed slug map (review point — rename freely before implementing)

Existing seeded slugs kept unchanged; new ones added to `MENUS` with `parentSlug`.

| Nav item | Slug | Status |
|---|---|---|
| Dashboard | `dashboard` | existing |
| Financial & Audit Reports | `reports` | existing |
| Audit Trail, Vouchers & GL, Chart of Accounts, Payables/Tax | `accounting` | existing |
| Quick Fee Collection, Student Billing & Waivers | `fees` | existing |
| MFS & Bank Reconciliation (group) | `bank_reconciliation` (parent `accounting`) | new |
| Payroll & MPO | `payroll` | existing |
| Exam section parent | `exams` | new |
| Exam Setup & Rules / Marks Entry Desk / Generate & Publish Result / Marksheets & Reports | `exam_setup`, `marks_entry`, `results`, `marksheets` (parent `exams`) | new |
| Academics (group) | `academics` | new |
| Students (group) / Teachers (leaf) | `students` / `teachers` | existing |
| Admission Desk / Student Registry / Enrollment Lifecycle / Admission Settings | `admission`, `student_registry`, `enrollment`, `admission_settings` (parent `admission`) | new |
| Website Management / Facilities / Others | `website`, `facilities`, `others` | new |
| Permission Management | `permission_management` | existing |
| `users`, `settings` | — | keep in seed, map when pages exist |

## 4. Steps

1. **Env-gated dev bypass** — `DEV_BYPASS_ROLE_FILTER` =
   `NEXT_PUBLIC_NAV_BYPASS === "1" && NODE_ENV !== "production"`; document in
   `apps/web/.env.example`.
2. **Fail-closed role mapping** — `auth.ts toLegacyRole()`: unknown → `guardian`
   (least privileged), keep `superadmin→admin`, `exam_controller→management`.
   `role` then only drives labels/overview stats.
3. **Single permission model** in `nav-config.ts`:
   - remove `roles`, `legacyRoles`, `UserRole`, `USER_ROLES`, `ALL`/`FINANCE_*`/... constants;
   - `menuSlug` required on groups + top-level leaves; children inherit;
   - replace `filterNavForRole` / `filterNavForUserRole` / `filterNavByMenuPermissions`
     with one `filterNav(items, flags)` (bypassAll → all; null → dashboard only;
     else `canView[slug] === true`, absent ⇒ hidden) + one `pruneEmptySections`;
   - `commandIndexForRole` → `commandIndex(filteredItems)`;
   - update `Sidebar.tsx`, `CommandPalette.tsx`, `DashboardShell.tsx`,
     `admin/layout.tsx` (pass `null` on fetch failure).
4. **Slug coverage + seed** — add §3 slugs to `MENUS` (parents first); extend
   `ROLE_DEFAULTS` so each role keeps ≈ today's `legacyRoles` access (accountant →
   bank_reconciliation, admission*; teacher → academics, marks_entry, marksheets,
   others; exam_controller → exams/*; …); re-run idempotent seed; add a
   drift check (script/test) that every nav slug exists in `MENUS`.
5. **Server page guard** — new `lib/require-menu.ts` (server-only)
   `requireMenu(slug)`: React `cache()`-wrapped session + flags, superadmin
   passes, else `canView[slug]` or `redirect("/admin/forbidden")`. New
   `admin/forbidden/page.tsx` (DashPageHeader + back link, UI rules). Call in
   each segment `layout.tsx` (one guard per slug subtree; create layouts where missing).
6. **Remove duplicate tree** — `dashboard-nav.ts` keeps only `Role`, `ROLES`,
   `roleLabels`, `roleDescriptions`; delete `dashboardTree` + tree helpers;
   delete dead `flattenTree`/`extractSlug`/`moduleLabels`/`MatrixPage` in
   `permissions.ts`; fix any leftover imports.
7. **Verify** — `tsc --noEmit` + `next lint` for apps/web; drift check; manual
   logins with bypass unset: superadmin (all), accountant (finance+admission;
   permission URLs → forbidden), teacher (academics/exam; finance → forbidden),
   API down → Dashboard only; Ctrl+K matches sidebar.

## 5. Out of scope / follow-ups
- Backend: `@RequirePermission` is used only in permission-assignment controller;
  module controllers should adopt the same slugs (separate plan).
- Action-level UI gating (canCreate/canEdit/canDelete buttons).
- Replace legacy `Role` vocabulary with backend `UsersRole`.

## 6. Risks
- Fail-closed may hide items whose role templates aren't extended → per-role
  mapping review + manual logins.
- Existing users with per-user overrides won't auto-get new slugs → may need a
  one-off "apply role defaults for new menus" run.
- Slug renames after rollout break stored permissions → finalise §3 first.

## 7. Review checklist
- Fail-closed (unmapped/failed ⇒ hidden)?
- Slug names in §3?
- Per-role default access (Step 4)?
- Forbidden = redirect to `/admin/forbidden` (vs 404)?
- Backend `@RequirePermission` rollout as separate plan?
