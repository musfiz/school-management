"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiSave,
  FiLoader,
  FiSearch,
  FiX,
  FiChevronDown,
  FiUsers,
  FiGrid,
  FiCheck,
} from "react-icons/fi";
import {
  listUsers,
  getMyMenus,
  getUserMenuPermissions,
  setUserMenuPermissions,
  resetUserMenuPermissions,
  type MenuPermissionEntry,
  type MenuAction,
} from "@/lib/permissions";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { toast } from "@/lib/swal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Display labels for menu actions. */
const MENU_ACTION_LABELS: Record<MenuAction, string> = {
  canView: "View",
  canCreate: "Create",
  canEdit: "Edit",
  canDelete: "Delete",
};

/** Set of (menuSlug, action) strings that are currently checked in the matrix. */
type Selection = Set<string>;

// ---------------------------------------------------------------------------
// Custom multi-select: searchable user picker with chip display
// ---------------------------------------------------------------------------

function UserMultiSelect({
  users,
  selected,
  onToggle,
  onClear,
}: {
  users: UserSummary[];
  selected: UserSummary[];
  onToggle: (user: UserSummary) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger / chip display */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10.5 w-full items-center gap-1.5 rounded-xs cursor-pointer border border-ink-200 bg-white px-3 py-1 text-left text-sm outline-none focus:border-brand-400"
      >
        <FiUsers className="h-4 w-4 shrink-0 text-ink-400" />
        {selected.length === 0 ? (
          <span className="text-ink-400">Search and select users…</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 rounded-xs bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"
              >
                {u.name}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(u);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      onToggle(u);
                    }
                  }}
                  className="ml-0.5 rounded-xs hover:bg-brand-100"
                >
                  <FiX className="h-3 w-3" />
                </span>
              </span>
            ))}
          </span>
        )}
        <FiChevronDown className="ml-auto h-4 w-4 shrink-0 text-ink-400" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xs border border-ink-200 bg-white shadow-lg">
          <div className="relative border-b border-ink-100 p-2">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, role…"
              className="w-full rounded-xs cursor-pointer border border-ink-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-400"
            />
          </div>
          {selected.length > 0 && (
            <div className="border-b border-ink-100 px-2 py-1.5">
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-semibold text-ink-500 hover:text-red-600"
              >
                Clear all
              </button>
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-400">
                No users match "{query}".
              </li>
            ) : (
              filtered.map((u) => {
                const isSel = selected.some((s) => s.id === u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(u)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${ isSel ? "bg-brand-50" : "hover:bg-ink-50" }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border ${ isSel ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300" }`}
                      >
                        {isSel && <FiCheck className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">
                          {u.name}
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          {u.email}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-xs bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600">
                        {u.role}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module filter dropdown
// ---------------------------------------------------------------------------

function ModuleSelect({
  value,
  onChange,
  allMenus,
}: {
  value: string;
  onChange: (v: string) => void;
  allMenus: MenuPermissionEntry[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Extract unique module labels from menu slugs
  const labels = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMenus) {
      // Extract module from slug (e.g., "accounts_vouchers" -> "accounts")
      const parts = m.slug.split("_");
      if (parts.length >= 2) {
        set.add(parts[0]);
      }
    }
    return ["all", ...Array.from(set)];
  }, [allMenus]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const displayLabel = value === "all" ? "All Modules" : value;

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10.5 w-full items-center gap-2 rounded-xs cursor-pointer border border-ink-200 bg-white px-3 text-left text-sm outline-none focus:border-brand-400"
      >
        <FiGrid className="h-4 w-4 shrink-0 text-ink-400" />
        <span className={value === "all" ? "text-ink-400" : "text-ink-900"}>
          {displayLabel}
        </span>
        <FiChevronDown className="ml-auto h-4 w-4 shrink-0 text-ink-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xs border border-ink-200 bg-white shadow-lg">
          <ul className="max-h-60 overflow-y-auto">
            {labels.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(label);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${ value === label ? "bg-brand-50 font-semibold" : "hover:bg-ink-50" }`}
                >
                  {label === "all" ? "All Modules" : label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function UserPermissionsView() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUsers, setSelectedUsers] = useState<UserSummary[]>([]);
  const [moduleFilter, setModuleFilter] = useState("all");

  /** Currently checked permission flags: "menuSlug:ACTION" strings. */
  const [checked, setChecked] = useState<Selection>(new Set());

  /** Permission flags each selected user already had (for diffing on save). */
  const [original, setOriginal] = useState<Map<string, Selection>>(new Map());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** All menus merged with their action flags (from GET /api/menus/my-menus). */
  const allMenus = useMemo<MenuPermissionEntry[]>(() => [], []);

  // Load users on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const usrs = await listUsers();
        setUsers(usrs);
      } catch {
        setError("Could not load users.");
        toast("Could not load users.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** After users are selected, load their current (menu, action) flags. */
  useEffect(() => {
    if (selectedUsers.length === 0) {
      setChecked(new Set());
      setOriginal(new Map());
      return;
    }

    (async () => {
      try {
        const flagMap = new Map<string, Selection>();
        const newChecked = new Set<string>();

        for (const user of selectedUsers) {
          const matrix = await getUserMenuPermissions(user.id);
          const userFlags = new Set<string>();

          for (const entry of matrix) {
            if (entry.canView) {
              userFlags.add(`${entry.menuSlug}:canView`);
              newChecked.add(`${entry.menuSlug}:canView`);
            }
            if (entry.canCreate) {
              userFlags.add(`${entry.menuSlug}:canCreate`);
              newChecked.add(`${entry.menuSlug}:canCreate`);
            }
            if (entry.canEdit) {
              userFlags.add(`${entry.menuSlug}:canEdit`);
              newChecked.add(`${entry.menuSlug}:canEdit`);
            }
            if (entry.canDelete) {
              userFlags.add(`${entry.menuSlug}:canDelete`);
              newChecked.add(`${entry.menuSlug}:canDelete`);
            }
          }
          flagMap.set(user.id, userFlags);
        }
        setOriginal(flagMap);
        setChecked(newChecked);
      } catch {
        toast("Could not load user permissions.", "error");
      }
    })();
  }, [selectedUsers]);

  // ---- selection helpers ----

  function isChecked(menuSlug: string, action: MenuAction): boolean {
    return checked.has(`${menuSlug}:${action}`);
  }

  function toggleOne(menuSlug: string, action: MenuAction) {
    setChecked((prev) => {
      const next = new Set(prev);
      const key = `${menuSlug}:${action}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllVisible() {
    const allFlags = new Set<string>();
    for (const m of allMenus) {
      for (const action of ["canView", "canCreate", "canEdit", "canDelete"] as MenuAction[]) {
        allFlags.add(`${m.menuSlug}:${action}`);
      }
    }
    const allChecked = Array.from(allFlags).every((f) => checked.has(f));
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        allFlags.forEach((f) => next.delete(f));
      } else {
        allFlags.forEach((f) => next.add(f));
      }
      return next;
    });
  }

  function allVisibleChecked(): boolean {
    for (const m of allMenus) {
      if (moduleFilter !== "all" && !m.slug.startsWith(moduleFilter)) continue;
      for (const action of ["canView", "canCreate", "canEdit", "canDelete"] as MenuAction[]) {
        if (!checked.has(`${m.menuSlug}:${action}`)) return false;
      }
    }
    return allMenus.length > 0;
  }

  // ---- user selection ----

  function toggleUser(user: UserSummary) {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      return exists ? prev.filter((u) => u.id !== user.id) : [...prev, user];
    });
  }

  // ---- save ----

  async function handleSave() {
    if (selectedUsers.length === 0) {
      toast("Select at least one user first.", "warning");
      return;
    }
    setSaving(true);
    setError(null);

    // Build the permission list from checked flags
    const flags: { menuSlug: string; action: MenuAction; granted: boolean }[] = [];
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (const key of Array.from(checked)) {
      const [menuSlug, action] = key.split(":");
      flags.push({ menuSlug, action: action as MenuAction, granted: true });
    }

    try {
      for (const user of selectedUsers) {
        await setUserMenuPermissions(user.id, flags);
      }
      toast(
        `Permissions saved for ${selectedUsers.length} user(s).`,
        "success",
      );
      // Reload user permissions after save
      const flagMap = new Map<string, Selection>();
      for (const user of selectedUsers) {
        const matrix = await getUserMenuPermissions(user.id);
        const userFlags = new Set<string>();
        for (const entry of matrix) {
          if (entry.canView) userFlags.add(`${entry.menuSlug}:canView`);
          if (entry.canCreate) userFlags.add(`${entry.menuSlug}:canCreate`);
          if (entry.canEdit) userFlags.add(`${entry.menuSlug}:canEdit`);
          if (entry.canDelete) userFlags.add(`${entry.menuSlug}:canDelete`);
        }
        flagMap.set(user.id, userFlags);
      }
      setOriginal(flagMap);
      setChecked(new Set(flags.map((f) => `${f.menuSlug}:${f.action}`)));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save permissions.";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ---- render ----

  // Filter menus by module
  const visibleMenus = useMemo(() => {
    if (moduleFilter === "all") return allMenus;
    return allMenus.filter((m) => m.slug.startsWith(moduleFilter));
  }, [allMenus, moduleFilter]);

  // Group menus by module (extracted from slug)
  const grouped = useMemo(() => {
    const map = new Map<string, MenuPermissionEntry[]>();
    for (const m of visibleMenus) {
      const module = moduleFilter === "all"
        ? m.slug.split("_")[0] || "general"
        : moduleFilter;
      const list = map.get(module) ?? [];
      list.push(m);
      map.set(module, list);
    }
    return Array.from(map.entries());
  }, [visibleMenus, moduleFilter]);

  // Need to load menus from API
  const [menuData, setMenuData] = useState<MenuPermissionEntry[]>([]);

  useEffect(() => {
    // Load menus on mount
    (async () => {
      try {
        const menus = await getMyMenus();
        setMenuData(menus);
      } catch {
        // Silently handle
      }
    })();
  }, []);

  return (
    <div className="p-4">
      <DashPageHeader title="User Permissions" />

      {error && (
        <div className="mb-4 rounded-xs border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <AdminPageLoader />
      ) : (
        <>
          {/* Section 1 — Selectors */}
          <DashCard>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-700">
                  Users
                </label>
                <UserMultiSelect
                  users={users}
                  selected={selectedUsers}
                  onToggle={toggleUser}
                  onClear={() => setSelectedUsers([])}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-700">
                  Module
                </label>
                <ModuleSelect
                  value={moduleFilter}
                  onChange={setModuleFilter}
                  allMenus={menuData}
                />
              </div>
            </div>
          </DashCard>

          {/* Section 2 — Matrix */}
          {selectedUsers.length === 0 ? (
            <DashCard className="mt-6">
              <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
                <FiUsers className="mb-3 h-10 w-10 text-ink-300" />
                <p className="text-sm text-ink-500">
                  Select one or more users above to manage their permissions.
                </p>
              </div>
            </DashCard>
          ) : (
            <div className="mt-6 space-y-6">
              {/* Action bar */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-500">
                  {menuData.length} pages across {grouped.length} module(s) · {checked.size} permission(s) selected
                </p>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xs bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <FiSave className="h-4 w-4" />
                  )}
                  Save Permissions
                </button>
              </div>

              {grouped.map(([module, pages]) => (
                <DashCard key={module} title={module.toUpperCase()}>
                  <div className="scroll-slim overflow-x-auto rounded-xs border border-ink-200">
                    <table className="w-full min-w-175 border-collapse text-sm">
                      <thead>
                        <tr className="bg-ink-50">
                          <th
                            className="border-b border-ink-200 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500"
                          >
                            Page
                          </th>
                          {(["canView", "canCreate", "canEdit", "canDelete"] as MenuAction[]).map((action) => (
                            <th
                              key={action}
                              className="border-b border-ink-200 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-ink-500"
                            >
                              {MENU_ACTION_LABELS[action]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {pages.map((page) => (
                          <tr
                            key={page.menuSlug}
                            className="transition-colors hover:bg-brand-50/30"
                          >
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-navy-900">
                                {page.title}
                              </span>
                              <span className="ml-2 font-mono text-xs text-ink-400">
                                {page.menuSlug}
                              </span>
                            </td>
                            {(["canView", "canCreate", "canEdit", "canDelete"] as MenuAction[]).map((action) => (
                              <td
                                key={action}
                                className="px-3 py-2.5 text-center"
                              >
                                <label className="inline-flex cursor-pointer items-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked(page.menuSlug, action)}
                                    onChange={() =>
                                      toggleOne(page.menuSlug, action)
                                    }
                                    className="h-4 w-4 rounded-xs border-ink-300 text-brand-600"
                                  />
                                </label>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DashCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}