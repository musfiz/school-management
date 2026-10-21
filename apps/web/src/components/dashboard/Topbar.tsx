"use client";

import { FiSearch as Search } from "react-icons/fi";
import { roleLabels, type Role } from "@/lib/dashboard-nav";
import { openCommandPalette } from "./CommandPalette";
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
        <button
          type="button"
          onClick={openCommandPalette}
          title="Quick navigation (Ctrl+K)"
          className="hidden cursor-pointer items-center gap-2 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-400 transition-colors hover:border-brand-400 hover:text-ink-600 md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Jump to…</span>
          <kbd className="rounded-xs border border-ink-200 bg-ink-50 px-1 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </button>
      </div>
      <UserMenu name={name} email={email} role={role} />
    </header>
  );
}
