"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  Loader2,
  Search,
  X,
  ShieldCheck,
  ChevronDown,
  Users,
  LayoutGrid,
  Check,
} from "lucide-react";
import type { UserSummary } from "@/lib/permissions";
import {
  listPermissions,
  listUsers,
  getUserPermissions,
  setUserPermissions,
  flattenTree,
  moduleLabels,
  permissionName,
  ACTION_VERBS,
  type ActionVerb,
  type MatrixPage,
} from "@/lib/permissions";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { toast } from "@/lib/swal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Set of "verb-slug" strings that are currently checked in the matrix. */
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

  // Close on outside click
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
        className="flex min-h-10.5 w-full items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-2 text-left text-sm shadow-sm outline-none focus:border-brand-400"
      >
        <Users className="h-4 w-4 shrink-0 text-ink-400" />
        {selected.length === 0 ? (
          <span className="text-ink-400">Search and select users…</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"
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
                  className="ml-0.5 rounded hover:bg-brand-100"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-ink-400" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-ink-200 bg-white shadow-lg">
          <div className="relative border-b border-ink-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, role…"
              className="w-full rounded border border-ink-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-400"
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
                No users match “{query}”.
              </li>
            ) : (
              filtered.map((u) => {
                const isSel = selected.some((s) => s.id === u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(u)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                        isSel ? "bg-brand-50" : "hover:bg-ink-50"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSel
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-ink-300"
                        }`}
                      >
                        {isSel && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">
                          {u.name}
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          {u.email}
                        </span>
                      </span>
                      <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600">
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
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const labels = useMemo(() => moduleLabels(), []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10.5 w-full items-center gap-2 rounded-md border border-ink-200 bg-white px-3 text-left text-sm shadow-sm outline-none focus:border-brand-400"
      >
        <LayoutGrid className="h-4 w-4 shrink-0 text-ink-400" />
        <span className={value === "all" ? "text-ink-400" : "text-ink-900"}>
          {value === "all" ? "All Modules" : value}
        </span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-ink-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-ink-200 bg-white shadow-lg">
          <ul className="max-h-60 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange("all");
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  value === "all" ? "bg-brand-50 font-semibold" : "hover:bg-ink-50"
                }`}
              >
                All Modules
              </button>
            </li>
            {labels.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(label);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    value === label
                      ? "bg-brand-50 font-semibold"
                      : "hover:bg-ink-50"
                  }`}
                >
                  {label}
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
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUsers, setSelectedUsers] = useState<UserSummary[]>([]);
  const [moduleFilter, setModuleFilter] = useState("all");

  /** Currently checked permission names in the matrix. */
  const [checked, setChecked] = useState<Selection>(new Set());
  /** Permission names each selected user already had (for diffing on save). */
  const [original, setOriginal] = useState<Map<number, Set<string>>>(new Map());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allPages = useMemo(() => flattenTree(), []);

  // Filtered pages based on module selection
  const visiblePages = useMemo(() => {
    if (moduleFilter === "all") return allPages;
    return allPages.filter((p) => p.module === moduleFilter);
  }, [allPages, moduleFilter]);

  // Pages grouped by module for section rendering
  const grouped = useMemo((): [string, MatrixPage[]][] => {
    const map = new Map<string, MatrixPage[]>();
    for (const p of visiblePages) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries());
  }, [visiblePages]);

  // Load catalog + users on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [perms, usrs] = await Promise.all([
          listPermissions(),
          listUsers(),
        ]);
        setCatalog(perms.map((p) => p.name));
        setUsers(usrs);
      } catch {
        setError("Could not load data.");
        toast("Could not load data.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // When selected users change, load their current permissions into `checked`
  useEffect(() => {
    if (selectedUsers.length === 0) {
      setChecked(new Set());
      setOriginal(new Map());
      return;
    }
    (async () => {
      try {
        const entries = await Promise.all(
          selectedUsers.map(async (u) => {
            const perms = await getUserPermissions(u.id);
            return [u.id, perms] as [number, string[]];
          }),
        );
        const origMap = new Map<number, Set<string>>();
        const union = new Set<string>();
        for (const [id, perms] of entries) {
          origMap.set(id, new Set(perms));
          perms.forEach((p) => union.add(p));
        }
        setOriginal(origMap);
        setChecked(union);
      } catch {
        toast("Could not load user permissions.", "error");
      }
    })();
  }, [selectedUsers]);

  // ---- selection helpers ----

  function isChecked(verb: ActionVerb, slug: string): boolean {
    return checked.has(permissionName(verb, slug));
  }

  function toggleOne(verb: ActionVerb, slug: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      const name = permissionName(verb, slug);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAllVisible() {
    const allVisible = new Set<string>();
    for (const p of visiblePages) {
      for (const verb of ACTION_VERBS) {
        allVisible.add(permissionName(verb, p.slug));
      }
    }
    const allChecked = Array.from(allVisible).every((name) => checked.has(name));
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        // Uncheck all visible
        allVisible.forEach((name) => next.delete(name));
      } else {
        // Check all visible
        allVisible.forEach((name) => next.add(name));
      }
      return next;
    });
  }

  function allVisibleChecked(): boolean {
    for (const p of visiblePages) {
      for (const verb of ACTION_VERBS) {
        if (!checked.has(permissionName(verb, p.slug))) return false;
      }
    }
    return visiblePages.length > 0;
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

    // Only persist permission names that exist in the catalog.
    const validNames = Array.from(checked).filter((name) => catalog.includes(name));

    try {
      for (const user of selectedUsers) {
        await setUserPermissions(user.id, validNames);
      }
      toast(
        `Permissions saved for ${selectedUsers.length} user(s).`,
        "success",
      );
      // Refresh originals
      const newOrig = new Map<number, Set<string>>();
      for (const u of selectedUsers) newOrig.set(u.id, new Set(validNames));
      setOriginal(newOrig);
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

  return (
    <div className="p-4">
      <DashPageHeader title="User Permissions" />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                <ModuleSelect value={moduleFilter} onChange={setModuleFilter} />
              </div>
            </div>
          </DashCard>

          {/* Section 2 — Matrix */}
          {selectedUsers.length === 0 ? (
            <DashCard className="mt-6">
              <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
                <Users className="mb-3 h-10 w-10 text-ink-300" />
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
                  {visiblePages.length} page(s) across{" "}
                  {grouped.length} module(s) · {checked.size} permission(s)
                  selected
                </p>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Permissions
                </button>
              </div>

              {grouped.map(([module, pages]) => (
                <DashCard key={module} title={module}>
                  <div className="overflow-x-auto rounded-lg border border-ink-200">
                    <table className="w-full min-w-175 border-collapse text-sm">
                      <thead>
                        <tr className="bg-ink-50">
                          <th className="border-b border-ink-200 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                            Page
                          </th>
                          {ACTION_VERBS.map((verb) => (
                            <th
                              key={verb}
                              className="border-b border-ink-200 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-ink-500"
                            >
                              {verb}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {pages.map((page) => {
                          // A page row is enabled only when the catalog has at
                          // least one "add" or "update" verb for that page.
                          const rowEnabled =
                            catalog.includes(
                              permissionName("add", page.slug),
                            ) ||
                            catalog.includes(
                              permissionName("update", page.slug),
                            );
                          return (
                            <tr
                              key={`${module}-${page.slug}`}
                              className="transition-colors hover:bg-brand-50/30"
                            >
                              <td className="px-4 py-2.5">
                                <span className="font-medium text-navy-900">
                                  {page.label}
                                </span>
                                <span className="ml-2 font-mono text-xs text-ink-400">
                                  {page.slug}
                                </span>
                              </td>
                              {ACTION_VERBS.map((verb) => {
                                const name = permissionName(verb, page.slug);
                                const exists = catalog.includes(name);
                                const isSel = isChecked(verb, page.slug);
                                const disabled = !rowEnabled || !exists;
                                return (
                                  <td
                                    key={verb}
                                    className="px-3 py-2.5 text-center"
                                  >
                                    <label className="inline-flex cursor-pointer items-center">
                                      <input
                                        type="checkbox"
                                        checked={isSel}
                                        disabled={disabled}
                                        onChange={() =>
                                          toggleOne(verb, page.slug)
                                        }
                                        className={`h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 ${
                                          disabled
                                            ? "cursor-not-allowed opacity-40"
                                            : ""
                                        }`}
                                      />
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </DashCard>
              ))}

              {grouped.length === 0 && (
                <p className="py-8 text-center text-sm text-ink-400">
                  No pages found for this module.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
