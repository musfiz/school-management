import DashboardShell from "@/components/dashboard/DashboardShell";

// Protected area: never prerender; the mock gate (and later real auth) is
// per-request. This keeps /dashboard out of the public static export.
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
