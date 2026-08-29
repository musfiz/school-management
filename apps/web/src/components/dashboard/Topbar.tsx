"use client";

import Link from "next/link";
import { roleLabels, type Role } from "@/lib/dashboard-nav";
import { ArrowRightIcon } from "@/components/icons";
import { useRole } from "./RoleProvider";

export default function Topbar({ role }: { role: Role }) {
  const { clearRole } = useRole();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-800">
          <span className="h-2 w-2 rounded-full bg-gold-500" />
          {roleLabels[role]} area
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="hidden text-sm font-medium text-ink-500 hover:text-navy-700 sm:inline"
        >
          View site
        </Link>
        <button
          type="button"
          onClick={clearRole}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-100"
        >
          Log out
          <ArrowRightIcon className="h-4 w-4 rotate-180" />
        </button>
      </div>
    </header>
  );
}
