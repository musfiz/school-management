"use client";

import { RoleProvider } from "./RoleProvider";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CommandPalette from "./CommandPalette";
import type { Session } from "@/lib/auth";
import type { MenuPermissionFlags } from "@/lib/nav-config";

/**
 * Dashboard chrome — sidebar + topbar + main slot.
 *
 * The session is read server-side by the protected layout and passed in.
 * RoleProvider hydrates client components (Sidebar / Topbar) with the same
 * session without needing a cookie read on first paint.
 */
export default function DashboardShell({
  session,
  menuPermissions,
  children,
  className,
}: {
  session: Session;
  /** Per-user menu `canView` flags (null ⇒ fail-closed dashboard only). */
  menuPermissions?: MenuPermissionFlags | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RoleProvider initial={session}>
      <div className={`flex h-screen overflow-hidden flex-col bg-ink-50 lg:flex-row ${className ?? ""}`}>
        <Sidebar role={session.role} name={session.name} menuPermissions={menuPermissions} />
        <CommandPalette role={session.role} menuPermissions={menuPermissions} />
        <div className="flex h-screen flex-1 flex-col overflow-hidden min-w-0">
          <Topbar name={session.name} email={session.email} role={session.role} />
          <main className="scroll-slim flex-1 overflow-y-auto px-2 py-1 sm:px-3 lg:py-2">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
