"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiSave,
  FiLoader,
  FiSearch,
  FiX,
  FiUsers,
  FiRotateCcw,
  FiCheckSquare,
  FiSquare,
  FiShield,
} from "react-icons/fi";
import {
  listUsers,
  getUserMenuPermissions,
  setUserMenuPermissions,
  resetUserMenuPermissions,
  type StandardMenuAction,
  type MenuAction,
} from "@/lib/permissions";
import {
  listSystemMenus,
  type SystemMenu,
  type MenuActionsConfig,
} from "@/lib/system-menus";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import { confirmDialog, toast } from "@/lib/swal";

const INPUT_BASE =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

const MENU_ACTIONS: StandardMenuAction[] = ["canView", "canCreate", "canEdit", "canDelete"];

const ACTION_LABELS: Record<StandardMenuAction, { label: string; desc: string }> = {
  canView: { label: "View", desc: "Access page and view data" },
  canCreate: { label: "Create", desc: "Add new records" },
  canEdit: { label: "Edit", desc: "Modify existing records" },
  canDelete: { label: "Delete", desc: "Remove or deactivate records" },
};

interface MenuPage {
  id: string;
  slug: string;
  title: string;
  path: string | null;
  sortOrder: number;
  actionsConfig?: MenuActionsConfig | null;
}

interface ModuleGroup {
  slug: string;
  title: string;
  pages: MenuPage[];
}

export default function UserPermissionsView() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [systemMenus, setSystemMenus] = useState<SystemMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedUsers, setSelectedUsers] = useState<UserSummary[]>([]);
  const [userSelectValue, setUserSelectValue] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [search, setSearch] = useState("");

  /** Currently checked permission flags: Set of "${menuSlug}:${action}". */
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Load master data (users + system menus) on mount
  const loadMasterData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usrs, sysMenus] = await Promise.all([
        listUsers(),
        listSystemMenus(),
      ]);
      // SuperAdmin has full unrestricted access and cannot be restricted by permission boundaries
      const assignableUsers = (Array.isArray(usrs) ? usrs : []).filter(
        (u) => u.role?.toLowerCase() !== "superadmin",
      );
      setUsers(assignableUsers);
      setSystemMenus(Array.isArray(sysMenus) ? sysMenus : []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load permissions data.";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Group system menus by parent module
  const moduleGroups = useMemo<ModuleGroup[]>(() => {
    if (systemMenus.length === 0) return [];

    const roots = systemMenus.filter((m) => !m.parentId);
    const byParent = new Map<string, SystemMenu[]>();

    for (const m of systemMenus) {
      if (m.parentId) {
        const list = byParent.get(m.parentId) ?? [];
        list.push(m);
        byParent.set(m.parentId, list);
      }
    }

    const groups: ModuleGroup[] = [];

    for (const root of roots) {
      const children = byParent.get(root.id) ?? [];
      const pages: MenuPage[] = [];

      // Include root menu itself as a manageable page
      pages.push({
        id: root.id,
        slug: root.slug,
        title: children.length > 0 ? `${root.title} (Main)` : root.title,
        path: root.path,
        sortOrder: root.sortOrder,
        actionsConfig: root.actionsConfig ?? null,
      });

      // Include children under this module
      for (const child of children) {
        pages.push({
          id: child.id,
          slug: child.slug,
          title: child.title,
          path: child.path,
          sortOrder: child.sortOrder,
          actionsConfig: child.actionsConfig ?? null,
        });
      }

      pages.sort((a, b) => a.sortOrder - b.sortOrder);

      groups.push({
        slug: root.slug,
        title: root.title,
        pages,
      });
    }

    // Capture any orphaned children without a matching root
    const rootIds = new Set(roots.map((r) => r.id));
    const orphans = systemMenus.filter((m) => m.parentId && !rootIds.has(m.parentId));
    if (orphans.length > 0) {
      groups.push({
        slug: "others",
        title: "Other Pages",
        pages: orphans.map((o) => ({
          id: o.id,
          slug: o.slug,
          title: o.title,
          path: o.path,
          sortOrder: o.sortOrder,
          actionsConfig: o.actionsConfig ?? null,
        })),
      });
    }

    return groups;
  }, [systemMenus]);

  // Module filter options for SearchSelect
  const moduleOptions = useMemo(() => {
    return [
      { value: "all", label: "All Modules" },
      ...moduleGroups.map((g) => ({
        value: g.slug,
        label: `${g.title} (${g.pages.length})`,
      })),
    ];
  }, [moduleGroups]);

  // User picker options for SearchSelect
  const userPickerOptions = useMemo(() => {
    return users.map((u) => ({
      value: u.id,
      label: `${u.name} — ${u.email} [${u.role.toUpperCase()}]`,
    }));
  }, [users]);

  // Add a user to selectedUsers list
  function handleSelectUser(userId: string) {
    if (!userId) return;
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (!selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers((prev) => [...prev, user]);
    }
    setUserSelectValue("");
  }

  function handleRemoveUser(userId: string) {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  // Load permission flags for all currently selected users
  const reloadMatrix = useCallback(async (targetUsers: UserSummary[]) => {
    if (targetUsers.length === 0) {
      setChecked(new Set());
      return;
    }

    setMatrixLoading(true);
    try {
      const mergedChecked = new Set<string>();

      for (const u of targetUsers) {
        const matrix = await getUserMenuPermissions(u.id);
        for (const entry of matrix) {
          if (entry.canView) mergedChecked.add(`${entry.menuSlug}:canView`);
          if (entry.canCreate) mergedChecked.add(`${entry.menuSlug}:canCreate`);
          if (entry.canEdit) mergedChecked.add(`${entry.menuSlug}:canEdit`);
          if (entry.canDelete) mergedChecked.add(`${entry.menuSlug}:canDelete`);
          if (Array.isArray(entry.customActions)) {
            for (const ca of entry.customActions) {
              mergedChecked.add(`${entry.menuSlug}:${ca}`);
            }
          }
        }
      }

      setChecked(mergedChecked);
    } catch {
      toast("Could not load user permission matrix.", "error");
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadMatrix(selectedUsers);
  }, [selectedUsers, reloadMatrix]);

  function isActionSupported(page: MenuPage, action: StandardMenuAction): boolean {
    if (!page.actionsConfig) return true;
    return (page.actionsConfig as any)[action] !== false;
  }

  // Checkbox state helpers
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

  function toggleRow(page: MenuPage) {
    setChecked((prev) => {
      const next = new Set(prev);
      const validStandard = MENU_ACTIONS.filter((a) => isActionSupported(page, a));
      const customActions = Array.isArray(page.actionsConfig?.custom)
        ? page.actionsConfig.custom.map((c) => c.action)
        : [];
      const allApplicable = [...validStandard, ...customActions];
      const allActive = allApplicable.every((a) => next.has(`${page.slug}:${a}`));
      for (const a of allApplicable) {
        const key = `${page.slug}:${a}`;
        if (allActive) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  function toggleModuleAction(group: ModuleGroup, action: StandardMenuAction) {
    setChecked((prev) => {
      const next = new Set(prev);
      const applicablePages = group.pages.filter((p) => isActionSupported(p, action));
      if (applicablePages.length === 0) return prev;
      const allChecked = applicablePages.every((p) => next.has(`${p.slug}:${action}`));
      for (const p of applicablePages) {
        const key = `${p.slug}:${action}`;
        if (allChecked) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  function toggleModuleAll(group: ModuleGroup) {
    setChecked((prev) => {
      const next = new Set(prev);
      let allChecked = true;
      for (const p of group.pages) {
        const validStandard = MENU_ACTIONS.filter((a) => isActionSupported(p, a));
        const customActions = Array.isArray(p.actionsConfig?.custom)
          ? p.actionsConfig.custom.map((c) => c.action)
          : [];
        for (const a of [...validStandard, ...customActions]) {
          if (!next.has(`${p.slug}:${a}`)) {
            allChecked = false;
            break;
          }
        }
        if (!allChecked) break;
      }

      for (const p of group.pages) {
        const validStandard = MENU_ACTIONS.filter((a) => isActionSupported(p, a));
        const customActions = Array.isArray(p.actionsConfig?.custom)
          ? p.actionsConfig.custom.map((c) => c.action)
          : [];
        for (const a of [...validStandard, ...customActions]) {
          const key = `${p.slug}:${a}`;
          if (allChecked) next.delete(key);
          else next.add(key);
        }
      }
      return next;
    });
  }

  // Filter modules and pages according to moduleFilter and search
  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return moduleGroups
      .filter((g) => (moduleFilter === "all" ? true : g.slug === moduleFilter))
      .map((g) => {
        if (!q) return g;
        const matchingPages = g.pages.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q) ||
            g.title.toLowerCase().includes(q),
        );
        return { ...g, pages: matchingPages };
      })
      .filter((g) => g.pages.length > 0);
  }, [moduleGroups, moduleFilter, search]);

  // Save permissions
  async function handleSave() {
    if (selectedUsers.length === 0) {
      toast("Please select at least one user first.", "warning");
      return;
    }

    setSaving(true);
    try {
      const allPages = moduleGroups.flatMap((g) => g.pages);
      const permissions: { menuSlug: string; action: MenuAction; granted: boolean }[] = [];

      for (const page of allPages) {
        for (const action of MENU_ACTIONS) {
          if (isActionSupported(page, action)) {
            permissions.push({
              menuSlug: page.slug,
              action,
              granted: checked.has(`${page.slug}:${action}`),
            });
          }
        }
        if (Array.isArray(page.actionsConfig?.custom)) {
          for (const c of page.actionsConfig.custom) {
            permissions.push({
              menuSlug: page.slug,
              action: c.action,
              granted: checked.has(`${page.slug}:${c.action}`),
            });
          }
        }
      }

      for (const u of selectedUsers) {
        await setUserMenuPermissions(u.id, permissions);
      }

      toast(
        `Permissions successfully saved for ${selectedUsers.length} user(s).`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save permissions.";
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  // Reset permissions to role defaults
  async function handleReset() {
    if (selectedUsers.length === 0) return;

    const names = selectedUsers.map((u) => u.name).join(", ");
    const confirmed = await confirmDialog({
      title: "Reset to Role Defaults?",
      text: `All custom menu permission overrides for ${names} will be cleared and restored to their base role templates.`,
      confirmText: "Yes, reset to defaults",
      danger: true,
    });
    if (!confirmed) return;

    setResetting(true);
    try {
      for (const u of selectedUsers) {
        await resetUserMenuPermissions(u.id);
      }
      toast("Permissions reset to role defaults.");
      await reloadMatrix(selectedUsers);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reset permissions.";
      toast(msg, "error");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <DashPageHeader
        title="User Permissions"
        description="Configure granular menu access (View, Create, Edit, Delete) for individual users."
      />

      {error && (
        <div className="rounded-xs border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <AdminPageLoader />
      ) : (
        <>
          {/* Filter & Selector Card */}
          <DashCard title="Select Users & Filter Modules">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3 items-end">
              {/* User Selector */}
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-ink-700">
                    Select User(s)
                  </label>
                  <span className="text-[11px] text-ink-400">
                    SuperAdmin is exempt
                  </span>
                </div>
                <SearchSelect
                  options={userPickerOptions}
                  value={userSelectValue}
                  onChange={handleSelectUser}
                  placeholder="Search and pick a user..."
                  isClearable={false}
                  ariaLabel="Select user"
                />
              </div>

              {/* Module Filter */}
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">
                  Module Filter
                </label>
                <SearchSelect
                  options={moduleOptions}
                  value={moduleFilter}
                  onChange={(val) => setModuleFilter(val || "all")}
                  placeholder="Filter by module..."
                  isClearable={false}
                  ariaLabel="Filter by module"
                />
              </div>

              {/* Page Search */}
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">
                  Search Pages
                </label>
                <div className="relative">
                  <FiSearch className="absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by page title or slug..."
                    className="w-full rounded-xs cursor-pointer border border-ink-200 bg-white pl-8 pr-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-2 text-ink-400 hover:text-ink-600"
                    >
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Users Chips */}
            {selectedUsers.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3">
                <span className="text-xs font-semibold text-ink-500">
                  Selected ({selectedUsers.length}):
                </span>
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1.5 rounded-xs bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200"
                  >
                    <span>{u.name}</span>
                    <span className="rounded-xs bg-brand-200/60 px-1 text-[10px] uppercase font-bold text-brand-900">
                      {u.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(u.id)}
                      className="text-brand-500 hover:text-brand-900 cursor-pointer"
                      title="Remove user"
                    >
                      <FiX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedUsers([])}
                  className="ml-2 text-xs font-medium text-red-600 hover:underline cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            )}
          </DashCard>

          {/* Matrix Content */}
          {selectedUsers.length === 0 ? (
            <DashCard>
              <div className="flex min-h-[30vh] flex-col items-center justify-center text-center p-6">
                <FiUsers className="mb-3 h-10 w-10 text-ink-300" />
                <h3 className="text-sm font-semibold text-ink-800">No User Selected</h3>
                <p className="mt-1 text-xs text-ink-500 max-w-sm">
                  Select one or more users from the dropdown above to view and customize their granular menu permissions.
                </p>
              </div>
            </DashCard>
          ) : matrixLoading ? (
            <AdminPageLoader />
          ) : (
            <div className="space-y-4">
              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xs border border-ink-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-ink-600">
                  <FiShield className="h-4 w-4 text-brand-600" />
                  <span>
                    Showing <strong>{visibleGroups.reduce((acc, g) => acc + g.pages.length, 0)}</strong> page(s) across <strong>{visibleGroups.length}</strong> module(s).
                  </span>
                  <span className="text-ink-400">·</span>
                  <span className="font-mono text-brand-700 font-semibold">
                    {checked.size} permission flags active
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={resetting || saving}
                    onClick={handleReset}
                    className="flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60 cursor-pointer"
                    title="Reset to role default template"
                  >
                    {resetting ? (
                      <FiLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FiRotateCcw className="h-3.5 w-3.5 text-ink-500" />
                    )}
                    Reset to Defaults
                  </button>

                  <button
                    type="button"
                    disabled={saving || resetting}
                    onClick={handleSave}
                    className="flex items-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 cursor-pointer"
                  >
                    {saving ? (
                      <FiLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FiSave className="h-3.5 w-3.5" />
                    )}
                    Save Permissions
                  </button>
                </div>
              </div>

              {/* Module Cards */}
              {visibleGroups.length === 0 ? (
                <DashCard>
                  <div className="py-8 text-center text-xs text-ink-400">
                    No pages match the selected module or search keyword.
                  </div>
                </DashCard>
              ) : (
                visibleGroups.map((group) => {
                  const allGroupChecked = group.pages.every((p) =>
                    MENU_ACTIONS.every((a) => checked.has(`${p.slug}:${a}`)),
                  );

                  return (
                    <DashCard key={group.slug} className="overflow-hidden">
                      {/* Card Header with Module Title & Quick Actions */}
                      <div className="-mx-4 -mt-4 mb-3 flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-navy-900">
                            {group.title}
                          </span>
                          <span className="rounded-xs bg-ink-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">
                            {group.pages.length} page{group.pages.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleModuleAll(group)}
                            className="inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-700 hover:bg-ink-100 cursor-pointer"
                          >
                            {allGroupChecked ? (
                              <>
                                <FiSquare className="h-3 w-3 text-ink-500" />
                                Clear All
                              </>
                            ) : (
                              <>
                                <FiCheckSquare className="h-3 w-3 text-brand-600" />
                                Select All
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Permissions Table */}
                      <div className="overflow-x-auto rounded-xs border border-ink-100">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-ink-50 text-ink-700">
                            <tr>
                              <th className="px-3 py-1.5 font-semibold">Page / Resource</th>
                              {MENU_ACTIONS.map((action) => {
                                const actionAllChecked = group.pages.every((p) =>
                                  checked.has(`${p.slug}:${action}`),
                                );
                                return (
                                  <th
                                    key={action}
                                    className="px-2 py-1.5 text-center font-semibold w-20"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleModuleAction(group, action)}
                                      className="inline-flex items-center gap-1 text-ink-700 hover:text-brand-600 cursor-pointer"
                                      title={`Toggle ${ACTION_LABELS[action].label} for all applicable pages in ${group.title}`}
                                    >
                                      <span>{ACTION_LABELS[action].label}</span>
                                      {actionAllChecked ? (
                                        <FiCheckSquare className="h-3 w-3 text-brand-600" />
                                      ) : (
                                        <FiSquare className="h-3 w-3 text-ink-400" />
                                      )}
                                    </button>
                                  </th>
                                );
                              })}
                              <th className="px-3 py-1.5 font-semibold">Custom Actions</th>
                              <th className="px-2 py-1.5 text-center font-semibold w-16">
                                Row
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100 bg-white">
                            {group.pages.map((page) => {
                              const validStandard = MENU_ACTIONS.filter((a) =>
                                isActionSupported(page, a),
                              );
                              const customActions = Array.isArray(
                                page.actionsConfig?.custom,
                              )
                                ? page.actionsConfig.custom.map((c) => c.action)
                                : [];
                              const allApplicable = [
                                ...validStandard,
                                ...customActions,
                              ];
                              const rowAllChecked =
                                allApplicable.length > 0 &&
                                allApplicable.every((a) =>
                                  checked.has(`${page.slug}:${a}`),
                                );

                              return (
                                <tr
                                  key={page.slug}
                                  className="hover:bg-ink-50 transition-colors"
                                >
                                  <td className="px-3 py-1.5">
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-navy-900">
                                        {page.title}
                                      </span>
                                      <span className="font-mono text-[10px] text-ink-400">
                                        slug: {page.slug}
                                        {page.path && ` · ${page.path}`}
                                      </span>
                                    </div>
                                  </td>

                                  {MENU_ACTIONS.map((action) => {
                                    const supported = isActionSupported(
                                      page,
                                      action,
                                    );
                                    return (
                                      <td
                                        key={action}
                                        className="px-2 py-1.5 text-center align-middle"
                                      >
                                        {supported ? (
                                          <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                            <input
                                              type="checkbox"
                                              checked={isChecked(
                                                page.slug,
                                                action,
                                              )}
                                              onChange={() =>
                                                toggleOne(page.slug, action)
                                              }
                                              className="h-3.5 w-3.5 rounded-xs border-ink-300 text-brand-600 cursor-pointer focus:ring-0 focus:outline-none"
                                            />
                                          </label>
                                        ) : (
                                          <span
                                            className="font-mono text-ink-300 select-none text-xs"
                                            title="Not applicable for this page"
                                          >
                                            —
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}

                                  {/* Custom Actions column */}
                                  <td className="px-3 py-1.5 align-middle">
                                    {Array.isArray(page.actionsConfig?.custom) &&
                                    page.actionsConfig.custom.length > 0 ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {page.actionsConfig.custom.map((c) => {
                                          const active = isChecked(
                                            page.slug,
                                            c.action,
                                          );
                                          return (
                                            <label
                                              key={c.action}
                                              className={`inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-[11px] font-medium cursor-pointer transition-colors ${
                                                active
                                                  ? "border-brand-500 bg-brand-50 text-brand-800 font-semibold"
                                                  : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                                              }`}
                                              title={`Grant ${c.label} (${c.action})`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={active}
                                                onChange={() =>
                                                  toggleOne(page.slug, c.action)
                                                }
                                                className="h-3 w-3 rounded-xs border-ink-300 text-brand-600 cursor-pointer focus:ring-0"
                                              />
                                              <span>{c.label}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <span className="font-mono text-ink-300 select-none text-xs">
                                        —
                                      </span>
                                    )}
                                  </td>

                                  <td className="px-2 py-1.5 text-center align-middle">
                                    <button
                                      type="button"
                                      onClick={() => toggleRow(page)}
                                      className="rounded-xs border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-600 hover:bg-ink-100 cursor-pointer"
                                      title="Toggle all applicable actions for this page"
                                    >
                                      {rowAllChecked ? "Clear" : "All"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </DashCard>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
