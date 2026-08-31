"use client";

import { roleLabels, type Role } from "@/lib/dashboard-nav";
import UserMenu from "./UserMenu";

export default function Topbar({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: Role;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink-200 bg-white/80 px-4 shadow-soft backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-800">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
          {roleLabels[role]} area
        </span>
        {name && (
          <span className="hidden text-sm text-ink-400 sm:inline">
            · {name}
          </span>
        )}
      </div>
      <UserMenu name={name} email={email} role={role} />
    </header>
  );
}
