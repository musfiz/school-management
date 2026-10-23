/**
 * Server-side fetch of the current user's menu-level permission flags
 * (GET /menus/my-menus on the NestJS API).
 *
 * Runs only inside Server Components (it reads the JWT session cookie via
 * `next/headers`) — do NOT import from client components; use
 * `@/app/api/menus/my-menus` proxy for client-side calls instead.
 *
 * The result gates the dashboard sidebar + command palette: slugs mapped in
 * `nav-config.ts` are hidden unless `canView` is granted, while slugs that
 * have no `Menu` row stay visible (backend still enforces every page's API).
 */
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session-cookie";
import type { MenuPermissionFlags } from "./nav-config";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

interface MyMenuApiNode {
  slug: string;
  canView: boolean;
  children?: MyMenuApiNode[];
}

/** Flatten the API tree into slug → canView. */
function collectFlags(nodes: MyMenuApiNode[], out: Record<string, boolean>): Record<string, boolean> {
  for (const node of nodes) {
    if (node?.slug) out[node.slug] = node.canView === true;
    if (node?.children?.length) collectFlags(node.children, out);
  }
  return out;
}

/**
 * Fetch the signed-in user's per-menu `canView` flags.
 *
 * Returns `null` on any failure (no cookie, API unreachable, non-200) so the
 * caller falls back to the unfiltered nav — the backend still 403s every
 * protected API the page hits, so this can never over-grant server-side.
 */
export async function fetchMyMenuFlags(): Promise<MenuPermissionFlags | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/menus/my-menus`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const tree = (await res.json()) as MyMenuApiNode[];
    if (!Array.isArray(tree)) return null;
    return { canView: collectFlags(tree, {}) };
  } catch {
    return null;
  }
}
