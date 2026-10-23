"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch } from "react-icons/fi";
import { commandIndex, filterNav, navItems, searchNav, type MenuPermissionFlags } from "@/lib/nav-config";
import type { Role } from "@/lib/dashboard-nav";

export const COMMAND_PALETTE_EVENT = "open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
}

/** Global Ctrl+K / Cmd+K palette over the permission-filtered nav. */
export default function CommandPalette({
  role,
  menuPermissions,
}: {
  role?: Role;
  /** Per-user menu `canView` flags fetched server-side (hybrid RBAC overlay). */
  menuPermissions?: MenuPermissionFlags | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const index = useMemo(() => {
    const visible = filterNav(navItems, menuPermissions);
    return commandIndex(visible);
  }, [menuPermissions]);
  const results = useMemo(() => searchNav(index, query).slice(0, 12), [index, query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function onCustom() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onCustom);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open ]);

  useEffect(() => setCursor(0), [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && results[cursor]) {
      go(results[cursor].href);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-navy-900/50 p-4 pt-24"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xs bg-white"
        role="dialog"
        aria-modal="true"
        aria-label="Quick navigation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-ink-100 px-3">
          <FiSearch className="h-4 w-4 shrink-0 text-ink-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Jump to any screen… (Ctrl+K)"
            aria-label="Search screens"
            className="w-full cursor-pointer border-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-ink-400"
          />
          <kbd className="shrink-0 rounded-xs border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-500">
            ESC
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1.5">
          {results.map((r, i) => (
            <li key={r.href}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(r.href)}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  i === cursor ? "bg-ink-50 text-ink-900" : "text-ink-700"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {r.group && <span className="text-ink-400">{r.group} › </span>}
                  {r.label}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-ink-400">No screens match “{query}”.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
