# School Management System (SMS) - Authorization & Permission Plan

## 1. System Overview & Objective
Design and implement a **Hybrid RBAC + User-Level Granular Permission System** in NestJS for a School Management Application.
- **User Categories (`RoleType`):** `SUPERADMIN`, `ADMIN`, `MANAGEMENT`, `TEACHER`, `ACCOUNTANT`, `GUARDIAN`.
- **Core Rule 1 (Superadmin Bypass):** A designated `SUPERADMIN` user (`isSuperAdmin: true`) gets automatic, unrestricted access to all menus, pages, and API actions without database permission checks.
- **Core Rule 2 (User-Wise Granular Control):** Every other user receives permissions per menu/module (`canView`, `canCreate`, `canEdit`, `canDelete`). While roles provide initial default templates upon user creation, permissions are evaluated and customized strictly per user.

---

## 2. Database Schema Design (Prisma)

```prisma
enum RoleType {
  SUPERADMIN
  ADMIN
  MANAGEMENT
  TEACHER
  ACCOUNTANT
  GUARDIAN
}

model User {
  id              Int              @id @default(autoincrement())
  name            String
  email           String           @unique
  password        String
  role            RoleType
  isSuperAdmin    Boolean          @default(false)
  userPermissions UserPermission[]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}

model Menu {
  id              Int                     @id @default(autoincrement())
  title           String                  // e.g., "Fee Management"
  slug            String                  @unique // e.g., "fee_management"
  path            String                  // e.g., "/dashboard/fees"
  icon            String?
  parentId        Int?
  sortOrder       Int                     @default(0)
  parent          Menu?                   @relation("MenuHierarchy", fields: [parentId], references: [id])
  children        Menu[]                  @relation("MenuHierarchy")
  userPermissions UserPermission[]
  roleDefaults    RoleDefaultPermission[]
}

model RoleDefaultPermission {
  id        Int      @id @default(autoincrement())
  role      RoleType
  menuId    Int
  canView   Boolean  @default(false)
  canCreate Boolean  @default(false)
  canEdit   Boolean  @default(false)
  canDelete Boolean  @default(false)

  menu Menu @relation(fields: [menuId], references: [id], onDelete: Cascade)

  @@unique([role, menuId])
}

model UserPermission {
  id        Int     @id @default(autoincrement())
  userId    Int
  menuId    Int
  canView   Boolean @default(false)
  canCreate Boolean @default(false)
  canEdit   Boolean @default(false)
  canDelete Boolean @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  menu Menu @relation(fields: [menuId], references: [id], onDelete: Cascade)

  @@unique([userId, menuId])
  @@index([userId])
}
```

---

## 3. Core Architecture Components

### 3.1 Custom Decorator (`@RequirePermission`)
Defines the required `menuSlug` and `action` (`canView` | `canCreate` | `canEdit` | `canDelete`) on any NestJS Controller route.

### 3.2 Dynamic Guard (`PermissionsGuard`)
1. Reads metadata from `@RequirePermission`. If none is present, allows access.
2. Extracts the authenticated `user` from `request.user` (populated by `JwtAuthGuard`).
3. **Superadmin Check:** If `user.isSuperAdmin === true` or `user.role === 'SUPERADMIN'`, immediately returns `true`.
4. **User Permission Check:** Queries `UserPermission` (or Redis cache) for `userId` and `menu.slug`. Verifies if the required `action` boolean is `true`. Throws `403 ForbiddenException` if false.

### 3.3 Auto-Assignment on User Creation
When a new user (e.g., `TEACHER`) is created, a database transaction automatically copies the matching rows from `RoleDefaultPermission` into `UserPermission` for that specific `userId`.

---

## 4. Required API Endpoints

| Method | Endpoint | Purpose | Guard / Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/menus/my-menus` | Returns hierarchical sidebar menus where `canView: true` (or all menus if Superadmin) along with action flags. | `JwtAuthGuard` |
| `GET` | `/api/permissions/user/:userId` | Returns all system menus merged with the specific user's current `canView`, `canCreate`, `canEdit`, `canDelete` status for the admin UI matrix. | `JwtAuthGuard`, `PermissionsGuard` (`permission_management`, `canView`) |
| `PUT` | `/api/permissions/user/:userId` | Bulk upserts/updates menu permissions for a specific user. | `JwtAuthGuard`, `PermissionsGuard` (`permission_management`, `canEdit`) |
| `POST` | `/api/permissions/user/:userId/reset` | Resets a user's permissions back to their `RoleDefaultPermission` template. | `JwtAuthGuard`, `PermissionsGuard` (`permission_management`, `canEdit`) |

---

## 5. Execution Checklist
- [ ] **Step 1:** Update `schema.prisma` and run Prisma migration.
- [ ] **Step 2:** Create `prisma/seed.ts` to seed default School Menus, Role Templates, and the single `SUPERADMIN` account.
- [ ] **Step 3:** Implement `@RequirePermission` decorator and `PermissionsGuard`.
- [ ] **Step 4:** Build `PermissionsModule` & `MenusModule` (Controllers, Services, DTOs).
- [ ] **Step 5:** Hook default permission copying into `UsersService.create()`.