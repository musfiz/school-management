"use client";

import { RoleProvider } from "./RoleProvider";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { Session } from "@/lib/auth";

/**
 * Dashboard chrome — sidebar + topbar + main slot.
 *
 * The session is read server-side by the protected layout and passed in.
 * RoleProvider hydrates client components (Sidebar / Topbar) with the same
 * session without needing a cookie read on first paint.
 */
export default function DashboardShell({
  session,
  children,
  className,
}: {
  session: Session;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RoleProvider initial={session}>
      <div className={`flex min-h-screen flex-col bg-ink-50 lg:flex-row ${className ?? ""}`}>
        <Sidebar role={session.role} name={session.name} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar name={session.name} email={session.email} role={session.role} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
