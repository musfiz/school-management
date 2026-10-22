"use client";

import { FiExternalLink, FiSearch as Search } from "react-icons/fi";
import type { Role } from "@/lib/dashboard-nav";
import { openCommandPalette } from "./CommandPalette";
import UserMenu from "./UserMenu";

export default function Topbar({ name, email, role }: { name: string; email: string; role: Role }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-ink-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title="Open public site in a new tab"
          className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-xs px-2 py-1.5 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-brand-600 sm:flex"
        >
          <FiExternalLink className="h-3.5 w-3.5" />
          View public site
        </a>

        <button
          type="button"
          onClick={openCommandPalette}
          title="Search (Ctrl+K)"
          className="flex w-full max-w-sm cursor-pointer items-center gap-2 rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1 text-sm text-ink-400 transition-colors hover:border-brand-400 hover:text-ink-600"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Search…</span>
          <kbd className="ml-auto hidden shrink-0 rounded-xs border border-ink-200 bg-white px-1 font-mono text-[10px] sm:inline">
            Ctrl K
          </kbd>
        </button>
      </div>
      <UserMenu name={name} email={email} role={role} />
    </header>
  );
}
