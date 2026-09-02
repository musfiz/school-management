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
  id: number;
  name: string;
  description?: string | null;
  module_id?: number | null;
  /** Populated when the backend joins the module relation. */
  module?: { id: number; name: string } | null;
  created_at?: string;
}

export interface UserPermissionAssignment {
  user_id: number;
  permission_id: number;
  assigned_by: number | null;
  assigned_at: string;
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: string;
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
  module_id?: number | null;
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

export function getUserPermissions(userId: number): Promise<string[]> {
  return apiFetch<string[]>(`/api/permissions/users/${userId}`);
}

export function setUserPermissions(
  userId: number,
  permissions: string[],
): Promise<void> {
  return apiFetch<void>(`/api/permissions/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
}

export function assignPermission(
  userId: number,
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
  userId: number,
  permission: string,
): Promise<void> {
  return apiFetch<void>(`/api/permissions/users/${userId}/revoke`, {
    method: "POST",
    body: JSON.stringify({ permission }),
  });
}
