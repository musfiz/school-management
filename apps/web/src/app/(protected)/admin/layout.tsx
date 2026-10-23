import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchMyMenuFlags } from "@/lib/my-menus";
import DashboardShell from "@/components/dashboard/DashboardShell";

// Protected area: never prerender. The auth check is per-request, so a fresh
// session lookup runs on every navigation. Required for correct gating once
// login lands users here.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Session and per-user menu permissions resolve in parallel; the flags
  // render before first paint (no client waterfall / sidebar flash).
  const [session, menuPermissions] = await Promise.all([
    getSession(),
    fetchMyMenuFlags(),
  ]);
  if (!session) {
    // Layout-level fallback. Each leaf page also re-checks so the returnTo
    // matches the URL the visitor actually requested.
    redirect("/login?returnTo=/admin");
  }
  return (
    <DashboardShell
      session={session}
      menuPermissions={
        session.isSuperAdmin
          ? { canView: {}, bypassAll: true }
          : menuPermissions
      }
      className="dashboard-font"
    >
      {children}
    </DashboardShell>
  );
}
