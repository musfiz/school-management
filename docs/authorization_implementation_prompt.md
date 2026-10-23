# Master Prompt for Implementing the NestJS User-Wise Permission System

Copy and paste the prompt below into your AI Coding Assistant (Cursor, Windsurf, Copilot, or Claude) to generate the complete, production-ready codebase:

---

```text
Act as a Senior Backend Architect and NestJS Expert. I need you to implement a complete, production-ready "Hybrid RBAC + User-Wise Granular Menu & Action Permission System" for my School Management System using NestJS and Prisma ORM.

### Business Requirements:
1. User Roles (`RoleType` enum): `SUPERADMIN`, `ADMIN`, `MANAGEMENT`, `TEACHER`, `ACCOUNTANT`, `GUARDIAN`.
2. Superadmin Bypass: Only a `SUPERADMIN` user (`isSuperAdmin: true` or `role === 'SUPERADMIN'`) has unrestricted access to all menus, pages, and API endpoints without checking the permission table.
3. User-Wise Permissions: All other users get permissions assigned per user, per menu (`canView`, `canCreate`, `canEdit`, `canDelete`).
4. Role Default Templates: When a new user is created with a role (e.g., `TEACHER`), copy default permissions from `RoleDefaultPermission` into `UserPermission` for that user inside a Prisma transaction so admins don't have to configure every new user from scratch, while still allowing user-by-user customization afterward.

### Tasks to Implement Step-by-Step (Generate Full Working Code, No Placeholders):

1. **Prisma Schema (`prisma/schema.prisma`)**:
   - Define `RoleType` enum (`SUPERADMIN`, `ADMIN`, `MANAGEMENT`, `TEACHER`, `ACCOUNTANT`, `GUARDIAN`).
   - Define models: `User`, `Menu` (supporting self-referencing `parentId` hierarchy and `sortOrder`), `RoleDefaultPermission`, and `UserPermission` (with `@@unique([userId, menuId])`).

2. **Database Seeder (`prisma/seed.ts`)**:
   - Seed core school menus: `dashboard`, `student_management`, `teacher_management`, `attendance`, `fee_management`, `exam_result`, `notice_board`, and `permission_management`.
   - Seed sensible `RoleDefaultPermission` entries for each role.
   - Seed 1 `SUPERADMIN` user (`isSuperAdmin: true`).

3. **Auth Decorator & Guard (`src/common/guards/` & `src/common/decorators/`)**:
   - Create `@RequirePermission(menuSlug: string, action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete')` decorator.
   - Create `PermissionsGuard` that:
     - Checks if route requires permission metadata.
     - Automatically returns `true` if `request.user.isSuperAdmin === true` or `request.user.role === 'SUPERADMIN'`.
     - Queries `prisma.userPermission` for the logged-in `userId` and `menuSlug`, verifying if the required action boolean is `true`. Throws `ForbiddenException` if unauthorized.

4. **Menus & Permissions Modules (`src/menus/` & `src/permissions/`)**:
   - `GET /menus/my-menus`: Returns a nested tree of menus where `canView: true` for the logged-in user (or all menus with all permissions set to `true` if `SUPERADMIN`), including the `permissions: { canView, canCreate, canEdit, canDelete }` object on each menu item for frontend button visibility control.
   - `GET /permissions/user/:userId`: Returns all system menus mapped with the target user's current permissions (defaulting to false if no row exists yet) so the frontend can render a checkbox matrix table.
   - `PUT /permissions/user/:userId`: Accepts a validated DTO array of `{ menuId, canView, canCreate, canEdit, canDelete }` and performs a bulk transaction upsert into `UserPermission` for that `userId`.
   - `POST /permissions/user/:userId/reset`: Resets a user's custom permissions back to their role's `RoleDefaultPermission`.

5. **User Creation Hook (`src/users/users.service.ts`)**:
   - Show the `createUser` method using `prisma.$transaction` that creates the user and automatically populates their initial `UserPermission` records from `RoleDefaultPermission`.

Provide clean, modular TypeScript code with `class-validator` DTOs and proper NestJS dependency injection.
```