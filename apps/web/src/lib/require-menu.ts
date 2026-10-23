import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchMyMenuFlags } from "@/lib/my-menus";

/**
 * Request-scoped session + permissions loader.
 * React cache() de-duplicates calls within a single Server Component render tree
 * (e.g. root layout + nested segment layouts + leaf pages).
 */
export const getCachedAuth = cache(async () => {
  const [session, menuPermissions] = await Promise.all([
    getSession(),
    fetchMyMenuFlags(),
  ]);
  return { session, menuPermissions };
});

/**
 * Server-side menu-permission guard.
 *
 * Enforces access to a page or section by checking the menu `slug`:
 * 1. Unauthenticated sessions are redirected to `/login?returnTo=/admin`.
 * 2. Superadmins bypass all gates.
 * 3. Sessions with `canView[slug] === true` pass.
 * 4. Any other case redirects to `/admin/forbidden`.
 */
export async function requireMenu(slug: string): Promise<void> {
  const { session, menuPermissions } = await getCachedAuth();

  if (!session) {
    redirect("/login?returnTo=/admin");
  }

  if (session.isSuperAdmin) {
    return;
  }

  if (menuPermissions?.canView && menuPermissions.canView[slug] === true) {
    return;
  }

  redirect("/admin/forbidden");
}
