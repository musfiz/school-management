"use client";

import { RoleProvider, useRole } from "./RoleProvider";
import MockLogin from "./MockLogin";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

function Shell({ children }: { children: React.ReactNode }) {
  const { role, ready } = useRole();

  if (!ready) {
    // Avoid a flash of the login screen before the cookie is read.
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-navy-700" />
      </div>
    );
  }

  if (!role) return <MockLogin />;

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 lg:flex-row">
      <Sidebar role={role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar role={role} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleProvider>
      <Shell>{children}</Shell>
    </RoleProvider>
  );
}
