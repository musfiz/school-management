"use client";

/**
 * Permission catalog + user-assignment client.
 *
 * Thin wrappers over the same-origin `/permissions` API (proxied to NestJS,
 * JWT sent automatically by the browser cookie). Mirrors the patterns in
 * `@/lib/api.ts` and the other feature lib files (e.g. `@/lib/staff.ts`).
 */

import { apiFetch } from "./api";
import type { MenuActionsConfig } from "./system-menus";

export interface Permission {
  id: string;
  name: string;
  description?: string | null;
  module_id?: string | null;
  /** Populated when the backend joins the module relation. */
  module?: { id: string; name: string } | null;
  created_at?: string;
}

export interface UserPermissionAssignment {
  user_id: string;
  permission_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type StandardMenuAction = "canView" | "canCreate" | "canEdit" | "canDelete";
export type MenuAction = StandardMenuAction | string;

export const MENU_ACTIONS: StandardMenuAction[] = ["canView", "canCreate", "canEdit", "canDelete"];

/** Human label for each menu action, shown as a column header. */
export const MENU_ACTION_LABELS: Record<StandardMenuAction, string> = {
  canView: "View",
  canCreate: "Create",
  canEdit: "Edit",
  canDelete: "Delete",
};

/** One menu merged with a user's current action flags (from GET /api/permissions/user/:id).
 *  Backend returns one row per menu with the standard action flags as booleans, plus
 *  custom actions array and actionsConfig.
 *  `slug` is the same field as `menuSlug` — kept in sync with the backend's
 *  `MyMenuEntry.slug` / `MenuPermissionWire.menuSlug`. */
export interface MenuPermissionEntry {
  slug: string;
  menuSlug: string;
  title: string;
  path?: string | null;
  role?: string;
  isSuperAdmin?: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  customActions?: string[];
  actionsConfig?: MenuActionsConfig | null;
}

/** A single (menu, action) flag to send to PUT /api/permissions/user/:id. */
export interface MenuPermissionFlag {
  menuSlug: string;
  action: MenuAction;
  granted: boolean;
}

// ---- Permission catalog ----

export function listPermissions(): Promise<Permission[]> {
  return apiFetch<Permission[]>("/api/permissions");
}

export function createPermission(input: {
  name: string;
  description?: string;
  module_id?: string | null;
}): Promise<Permission> {
  return apiFetch<Permission>("/api/permissions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePermission(
  id: string,
  input: {
    name?: string;
    description?: string;
    module_id?: string | null;
  },
): Promise<Permission> {
  return apiFetch<Permission>(`/api/permissions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePermission(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/permissions/${id}`, {
    method: "DELETE",
  });
}

// ---- User assignments ----

export function listUsers(): Promise<UserSummary[]> {
  return apiFetch<UserSummary[]>("/api/users");
}

/** Menu-based API (GET /api/menus/my-menus) — hierarchical tree with action flags.
 *  The backend returns MyMenuEntry objects (slug, title, path, parentId,
 *  sortOrder, isActive, canView, canCreate, canEdit, canDelete, children).
 *  We map them to MenuPermissionEntry (dropping the tree shape). */
export function getMyMenus(): Promise<MenuPermissionEntry[]> {
  return apiFetch<MenuPermissionEntry[]>("/api/menus/my-menus");
}

/** Menu-based matrix (GET /api/permissions/user/:userId). Returns every menu
 *  merged with the target user's canView/canCreate/canEdit/canDelete flags.
 *  The backend returns a bare array of MenuPermissionEntry objects. */
export function getUserMenuPermissions(userId: string): Promise<MenuPermissionEntry[]> {
  return apiFetch<MenuPermissionEntry[]>(`/api/permissions/user/${userId}`);
}

/** Bulk upsert of a user's menu-level permissions (PUT /api/permissions/user/:userId).
 *  One entry per (menuSlug, action) to set. */
export function setUserMenuPermissions(
  userId: string,
  permissions: { menuSlug: string; action: MenuAction; granted: boolean }[],
): Promise<void> {
  return apiFetch<void>(`/api/permissions/user/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
}

/** Reset a user's menu permissions to their role-default template
 *  (POST /api/permissions/user/:userId/reset). Omit menuSlug to reset all. */
export function resetUserMenuPermissions(
  userId: string,
  menuSlug?: string,
): Promise<void> {
  return apiFetch<void>(`/api/permissions/user/${userId}/reset`, {
    method: "POST",
    body: JSON.stringify({ menuSlug }),
  });
}

export function getUserPermissions(userId: string): Promise<string[]> {
  return apiFetch<string[]>(`/api/permissions/users/${userId}`);
}

export function setUserPermissions(
  userId: string,
  permissions: string[],
): Promise<void> {
  return apiFetch<void>(`/api/permissions/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
}

export function assignPermission(
  userId: string,
  permission: string,
): Promise<UserPermissionAssignment> {
  return apiFetch<UserPermissionAssignment>(
    `/api/permissions/users/${userId}/assign`,
    {
      method: "POST",
      body: JSON.stringify({ permission }),
    },
  );
}

export function revokePermission(
  userId: string,
  permission: string,
): Promise<void> {
  return apiFetch<void>(`/api/permissions/users/${userId}/revoke`, {
    method: "POST",
    body: JSON.stringify({ permission }),
  });
}
