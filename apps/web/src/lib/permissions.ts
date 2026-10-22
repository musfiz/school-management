"use client";

/**
 * Permission catalog + user-assignment client.
 *
 * Thin wrappers over the same-origin `/permissions` API (proxied to NestJS,
 * JWT sent automatically by the browser cookie). Mirrors the patterns in
 * `@/lib/api.ts` and the other feature lib files (e.g. `@/lib/staff.ts`).
 */

import { apiFetch } from "./api";
import {
  dashboardTree,
  type DashTreeNode,
  ROLES,
} from "./dashboard-nav";

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

export type MenuAction = "canView" | "canCreate" | "canEdit" | "canDelete";

export const MENU_ACTIONS: MenuAction[] = ["canView", "canCreate", "canEdit", "canDelete"];

/** Human label for each menu action, shown as a column header. */
export const MENU_ACTION_LABELS: Record<MenuAction, string> = {
  canView: "View",
  canCreate: "Create",
  canEdit: "Edit",
  canDelete: "Delete",
};

/** One menu merged with a user's current action flags (from GET /api/permissions/user/:id).
 *  Backend returns one row per menu with the four action flags as booleans.
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
}

/** A single (menu, action) flag to send to PUT /api/permissions/user/:id. */
export interface MenuPermissionFlag {
  menuSlug: string;
  action: MenuAction;
  granted: boolean;
}

/** Fixed action verbs — one checkbox column each in the matrix. */
export const ACTION_VERBS = ["view", "add", "update", "delete", "pdf", "xlsx"] as const;
export type ActionVerb = (typeof ACTION_VERBS)[number];

/** A flattened page entry extracted from the nav tree for the matrix. */
export interface MatrixPage {
  /** Parent module label, e.g. "Website Management". */
  module: string;
  /** Page label, e.g. "About Us". */
  label: string;
  /** URL slug derived from href, e.g. "about-us". */
  slug: string;
  /** Full href, e.g. "/admin/website-management/about-us". */
  href: string;
}

/** Recursively extract every leaf page from the nav tree, tagged with its
 *  parent module (top-level group) label. Only includes leaves viewable by at
 *  least one role (which is all of them here). */
export function flattenTree(nodes: DashTreeNode[] = dashboardTree): MatrixPage[] {
  const out: MatrixPage[] = [];

  function walk(groupLabel: string, children: DashTreeNode[]) {
    for (const node of children) {
      if (node.kind === "leaf") {
        const slug = extractSlug(node.href);
        if (slug && node.href) {
          out.push({
            module: groupLabel,
            label: node.label,
            slug,
            href: node.href,
          });
        }
      } else {
        // Nested group — recurse, keeping the same top-level module label.
        walk(groupLabel, node.children ?? []);
      }
    }
  }

  for (const node of nodes) {
    if (node.kind === "group") {
      walk(node.label, node.children ?? []);
    }
    // Top-level leaves (like Dashboard) are not module-scoped, so we skip
    // them — or you could tag them with a generic module. Keeping simple.
  }

  return out;
}

/** Extract a slug from an href like "/admin/website-management/about-us". */
function extractSlug(href?: string): string {
  if (!href) return "";
  const parts = href.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] ?? "";
}

/** Build the permission name for a given verb + slug: "view-about-us". */
export function permissionName(verb: ActionVerb, slug: string): string {
  return `${verb}-${slug}`;
}

/** Unique module labels from the nav tree (for the module filter dropdown). */
export function moduleLabels(): string[] {
  return dashboardTree.filter((n) => n.kind === "group").map((n) => n.label);
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
