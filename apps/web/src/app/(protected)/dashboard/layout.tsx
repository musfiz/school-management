import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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
  const session = await getSession();
  if (!session) {
    // Layout-level fallback. Each leaf page also re-checks so the returnTo
    // matches the URL the visitor actually requested.
    redirect("/login?returnTo=/dashboard");
  }
  return (
    <DashboardShell session={session} className="dashboard-font">
      {children}
    </DashboardShell>
  );
}
