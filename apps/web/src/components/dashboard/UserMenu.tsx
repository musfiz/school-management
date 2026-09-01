"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ExternalLink,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { roleLabels, type Role } from "@/lib/dashboard-nav";

/** Two-letter initials: first letter of first + last name. Single-word names
 *  take the first two letters. Empty falls back to "??". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Top-right user dropdown.
 *
 * - Trigger: avatar (initials) + name + role mini-block + caret.
 * - Panel: header (name + email) → Profile, Settings, View site → Sign out.
 * - Open/close: click trigger toggles; click outside or `Esc` closes.
 *
 * Sign out calls POST /api/auth/logout, then `router.replace("/login")`.
 */
export default function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: Role;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Click-outside. Uses `mousedown` so a click inside the popover that
  // bubbles to the document doesn't trigger a close-then-handler race.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Esc to close + return focus to trigger.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const onSignOut = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        if (!res.ok) {
          setError("Could not log out. Please try again.");
          return;
        }
        router.replace("/login");
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }, [router]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-sm border border-ink-200 bg-white px-2 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-sm bg-navy-800 text-xs font-bold text-white"
        >
          {initialsOf(name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-navy-800">
            {name}
          </span>
          <span className="block text-[11px] text-ink-500">
            {roleLabels[role]}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-ink-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 z-40 mt-2 w-64 origin-top-right rounded-sm border border-ink-200 bg-white shadow-card"
        >
          <div className="border-b border-ink-200 px-4 py-3">
            <p className="text-sm font-semibold text-navy-800">{name}</p>
            <p className="truncate text-xs text-ink-500">{email}</p>
          </div>

          <ul className="py-1">
            <li>
              <Link
                role="menuitem"
                href="/admin/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-ink-100 hover:text-navy-800"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
            </li>
            <li>
              <Link
                role="menuitem"
                href="/admin/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-ink-100 hover:text-navy-800"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </li>
            <li>
              <Link
                role="menuitem"
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-ink-100 hover:text-navy-800"
              >
                <ExternalLink className="h-4 w-4" />
                View site
              </Link>
            </li>
          </ul>

          <div className="border-t border-ink-200 p-1">
            <button
              role="menuitem"
              type="button"
              onClick={onSignOut}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {isPending ? "Signing out…" : "Sign out"}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="border-t border-ink-200 px-4 py-2 text-xs text-red-600"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
