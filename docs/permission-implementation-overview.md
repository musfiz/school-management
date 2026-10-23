# Hybrid Permission & RBAC Implementation Overview

This document explains the architecture, flow, and operational procedures for the School Management System's **Hybrid RBAC + User-Level Granular Permission** system.

---

## 1. Core Architecture Concepts

The system implements a single-source-of-truth, fail-closed authorization model combining role-based templates with per-user custom overrides:

```
┌────────────────────────────────────────────────────────┐
│                        User                            │
│  - role: RoleType (admin, teacher, accountant, etc.)   │
│  - isSuperAdmin: boolean                               │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    isSuperAdmin = true        Regular User
    (Full Unrestricted Bypass) (Evaluates MenuUserPermission)
                                         │
                                         ▼
                      ┌────────────────────────────────────┐
                      │        MenuUserPermission          │
                      │  Per (userId, menuId):             │
                      │  - canView:   boolean              │
                      │  - canCreate: boolean              │
                      │  - canEdit:   boolean              │
                      │  - canDelete: boolean              │
                      └────────────────────────────────────┘
```

### 1.1 Key Entities

1. **`Users`**: Holds base user identity, `role`, and `isSuperAdmin` boolean.
2. **`Menu`**: Represents a functional module or page identified by a unique `slug` (e.g. `accounting`, `fees`, `exam_setup`). Menus support a parent-child hierarchy.
3. **`RoleDefaultPermission`**: Default permission templates per role. Used when seeding or resetting user permissions.
4. **`MenuUserPermission`**: **Runtime single source of truth**. Every user has direct permission records storing four granular action booleans (`canView`, `canCreate`, `canEdit`, `canDelete`).

### 1.2 Action Capabilities & Page Capabilities

#### Standard Actions
| Action | Meaning | Primary Enforcement Point |
|---|---|---|
| `canView` | View the menu in sidebar, find in Command Palette (Ctrl+K), and access pages via URL | Frontend `filterNav`, segment `requireMenu(slug)`, backend `GET` routes |
| `canCreate` | Create new records within the module | Backend `@RequirePermission(slug, 'canCreate')` on `POST` routes |
| `canEdit` | Modify existing records or configurations | Backend `@RequirePermission(slug, 'canEdit')` on `PUT`/`PATCH` routes |
| `canDelete` | Delete or deactivate records | Backend `@RequirePermission(slug, 'canDelete')` on `DELETE` routes |

#### Dynamic Custom Actions & Page Capability Configuration (`actionsConfig`)
Not all pages support full CRUD (e.g., `dashboard` and `reports` are view-only; adding `Create`/`Edit`/`Delete` creates confusing "phantom checkboxes"). Furthermore, complex pages often need specialized capabilities like Excel export, PDF generation, or multi-step approval workflows.

1. **Page Capability Configuration (`Menu.actionsConfig`)**:
   Stored as a JSON object on the `Menu` model:
   ```json
   {
     "canView": true,
     "canCreate": false,
     "canEdit": false,
     "canDelete": false,
     "custom": [
       { "action": "excel", "label": "Excel Export" },
       { "action": "pdf", "label": "PDF Export" }
     ]
   }
   ```
   - When a standard action is `false` (or omitted for view-only pages), the User Permissions matrix renders a clean dash (`—`) instead of an inactive or phantom checkbox.
   - The `custom` array defines page-specific capabilities with an action identifier slug (`action`) and human-readable label (`label`).

2. **Granted Custom Actions (`customActions`)**:
   Stored as a JSON array of granted action strings (e.g. `["excel", "pdf"]`) on `RoleDefaultPermission` and `MenuUserPermission`.
   - SuperAdmin automatically bypasses all checks.
   - In the User Permissions matrix, granted custom actions render as interactive badge-checkboxes.

3. **Controller Protection with Custom Actions**:
   The `@RequirePermission` decorator accepts custom action slugs directly:
   ```ts
   @Get('export/excel')
   @RequirePermission('reports', 'excel')
   exportReportsExcel() { /* ... */ }

   @Get('export/pdf')
   @RequirePermission('student_registry', 'pdf')
   exportStudentPdf() { /* ... */ }
   ```

---

## 2. End-to-End Authorization Flow

### 2.1 Frontend Navigation & Page Access Flow

```
User visits /admin/...
   │
   ├─► Session check: Not logged in? ──► Redirect to /login
   │
   ├─► Superadmin (isSuperAdmin === true)? ──► Full access granted
   │
   ├─► Fetch User Permissions: GET /api/menus/my-menus
   │      │
   │      ├─► Sidebar & Command Palette (Ctrl+K):
   │      │   filterNav(navItems, flags) filters items by flags.canView[menuSlug]
   │      │
   │      └─► Direct URL Access:
   │          admin/<segment>/layout.tsx runs await requireMenu(slug)
   │             ├─► canView === true ──► Render page
   │             └─► canView === false ──► Redirect to /admin/forbidden
```

### 2.2 Backend API Request Flow

```
Incoming HTTP Request (e.g. POST /api/vouchers)
   │
   ├─► JwtAuthGuard: Validate JWT token & attach user to request
   │
   ├─► MenuPermissionsGuard:
   │      │
   │      ├─► @Public() route? ──► Allow
   │      ├─► No @RequirePermission? ──► Allow (authenticated)
   │      ├─► user.isSuperAdmin === true? ──► Allow (Superadmin bypass)
   │      └─► Check MenuUserPermission for (user.id, menu.slug):
   │             ├─► perm[action] === true ──► 200 OK (Execute controller)
   │             └─► perm[action] === false ──► 403 ForbiddenException
```

---

## 3. How Roles and Modules Work Together

1. **Role as Initial Template**: When a user is assigned a role (e.g. `accountant`), their initial permissions are populated from `RoleDefaultPermission` for that role.
2. **User-Level Customization**: An administrator can grant or revoke specific module permissions for individual users (e.g., granting an accountant access to `admission` without changing their role).
3. **Fail-Closed Security**:
   - If a menu slug is not explicitly granted with `canView: true`, the user cannot see it in the sidebar and cannot access it via direct URL.
   - If permission flags fail to load or return null, navigation displays only the dashboard leaf.
   - Unrecognized backend roles fall back to `guardian` (least privilege), never `admin`.

---

## 4. Instructions: How to Add, Edit, Update, and Delete Permissions

### A. How to Add a New Module / Menu Permission

Follow this checklist whenever adding a new feature module to the application:

#### Step 1: Register Menu Slug in Database Seed
In `apps/api/scripts/seed-authorization.ts`:
1. Add the menu definition to `MENUS`:
   ```ts
   { slug: 'inventory', title: 'Inventory Management', path: '/admin/inventory', icon: 'Box', sortOrder: 15 }
   ```
2. If it has children, specify `parentSlug`:
   ```ts
   { slug: 'inventory_items', title: 'Items', path: '/admin/inventory/items', parentSlug: 'inventory', sortOrder: 1 }
   ```
3. Add default role mappings in `ROLE_DEFAULTS`:
   ```ts
   // In superadmin, admin, management, etc.:
   { menuSlug: 'inventory', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] }
   ```

#### Step 2: Run Seed Script
Apply the seed changes to your database:
```bash
pnpm seed:authorization
# or: pnpm --filter api seed:authorization
```

#### Step 3: Register in Frontend Navigation Config
In `apps/web/src/lib/nav-config.ts`:
Add the new group or leaf referencing the same `menuSlug`:
```ts
{
  kind: "group",
  title: "Inventory",
  menuSlug: "inventory",
  icon: FiBox,
  children: [
    { label: "Items", href: "/admin/inventory/items", menuSlug: "inventory_items" },
  ],
}
```

#### Step 4: Protect Frontend Routes (Page Guard)
Create or update `layout.tsx` for the route segment:
`apps/web/src/app/(protected)/admin/inventory/layout.tsx`:
```tsx
import { requireMenu } from "@/lib/require-menu";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("inventory");
  return <>{children}</>;
}
```

#### Step 5: Protect Backend API Controllers
In your NestJS controller:
```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MenuPermissionsGuard } from '../common/guards/menu-permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, MenuPermissionsGuard)
export class InventoryController {
  @Get()
  @RequirePermission('inventory', 'canView')
  findAll() { /* ... */ }

  @Post()
  @RequirePermission('inventory', 'canCreate')
  create() { /* ... */ }

  @Put(':id')
  @RequirePermission('inventory', 'canEdit')
  update() { /* ... */ }

  @Delete(':id')
  @RequirePermission('inventory', 'canDelete')
  remove() { /* ... */ }
}
```

#### Step 6: Verify Drift Check
Run the drift check test to ensure zero discrepancy between frontend nav slugs and backend database seeds:
```bash
pnpm --filter api test apps/api/test/nav-menu-drift.spec.ts
```

---

### B. How to Edit / Update Existing User Permissions

#### Method 1: Using the Web UI (Admin Interface)
1. Go to **Permission Management** › **User Permissions** (`/admin/permission-management/user-permissions`).
2. Search and select the target user(s).
3. The interactive matrix displays all menus grouped by parent with checkboxes for `View`, `Create`, `Edit`, and `Delete`.
4. Check or uncheck the desired permissions.
5. Click **Save Permissions**. Changes take effect immediately.

#### Method 2: Resetting User Permissions to Role Defaults
To discard custom overrides and revert a user to their standard role template:
- **Via UI**: Click **Reset to Role Defaults** on the User Permissions page.
- **Via API**:
  ```http
  POST /api/permissions/user/:userId/reset
  Content-Type: application/json

  { "menuSlug": "accounting" }  // Omit menuSlug to reset all menus
  ```

#### Method 3: Via REST API
To programmatically update permissions for a user:
```http
PUT /api/permissions/user/:userId
Content-Type: application/json
Authorization: Bearer <token>

{
  "permissions": [
    { "menuSlug": "fees", "action": "canCreate", "granted": true },
    { "menuSlug": "fees", "action": "canDelete", "granted": false }
  ]
}
```

---

### C. How to Delete / Revoke Permissions

#### Revoking Access for a Specific User:
- In the **User Permissions** UI, uncheck the corresponding action box (`View`, `Create`, `Edit`, or `Delete`) and click **Save**.
- Or send `granted: false` via `PUT /api/permissions/user/:userId`.

#### Completely Removing a Module / Menu from the System:
1. **Remove Frontend Route Guard & Link**: Remove the entry from `apps/web/src/lib/nav-config.ts` and remove or delete the route directory under `apps/web/src/app/(protected)/admin/`.
2. **Remove Backend Controller Guard**: Remove `@RequirePermission(slug, ...)` decorators.
3. **Remove from Seed**: Delete the definition from `MENUS` and `ROLE_DEFAULTS` in `apps/api/scripts/seed-authorization.ts`.
4. **Delete from Database**: Execute a database deletion for the menu:
   ```sql
   DELETE FROM menus WHERE slug = 'target_slug';
   ```
   *(Related `role_default_permissions` and `menu_user_permissions` records will automatically cascade delete).*

---

### D. Managing Menus and Page Capabilities via the UI (System Menus Desk)

Administrators can directly add, update, and remove system menus visually without editing database records manually:

1. Navigate to **Permission Management** › **Menus** (`/admin/permission-management/menus`).
2. **View & Filter**: Search by title, slug, or path, and filter by hierarchy (Roots vs Children) or status (Active vs Inactive).
3. **Configure Page Capabilities & Custom Actions**:
   - In the **Add/Edit Menu** modal, configure the supported standard operations:
     - Check/uncheck `View`, `Create`, `Edit`, `Delete`. For instance, uncheck Create/Edit/Delete for `Dashboard` or `Reports` to eliminate phantom checkboxes in the user permissions matrix.
   - Add **Custom Actions**:
     - Quick preset chips: `+ Excel`, `+ PDF`, `+ Print`, `+ Approve`, `+ Verify`, `+ Reverse`.
     - Or define custom action slug (e.g., `receipt`) and human-readable label (`Print Receipt`).
4. **Edit Menu**: Click **Edit** on any row to adjust Title, Slug, Path, Hierarchy, Sort Order, Status, or capabilities.
5. **Delete Menu**: Click **Delete** with confirmation. Any child menus are automatically unlinked, and associated role/user permissions cascade delete.

---

## 5. Security & Development Guidelines

1. **Never Hardcode Role Checks in Components**:
   - ❌ Bad: `if (session.role === 'admin' || session.role === 'accountant')`
   - ✅ Good: Rely on `filterNav(navItems, menuPermissions)` and `requireMenu(slug)`.
2. **Keep SuperAdmin Centralized**:
   - `isSuperAdmin === true` bypasses checks centrally in `MenuPermissionsGuard` (backend) and `requireMenu` (frontend). Do not add bespoke superadmin checks inside individual route handlers.
3. **Development Bypass for Navigation**:
   - In non-production environments, set `NEXT_PUBLIC_NAV_BYPASS=1` in `apps/web/.env.local` to preview all sidebar items without seeding permissions. This is disabled automatically in production.
