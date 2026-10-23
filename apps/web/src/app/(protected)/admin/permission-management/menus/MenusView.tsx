"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiSearch,
  FiX,
  FiLoader,
  FiLayers,
  FiCornerDownRight,
} from "react-icons/fi";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import { confirmDialog, toast } from "@/lib/swal";
import {
  listSystemMenus,
  createSystemMenu,
  updateSystemMenu,
  deleteSystemMenu,
  type SystemMenu,
  type CreateSystemMenuInput,
  type UpdateSystemMenuInput,
  type MenuActionsConfig,
  type CustomActionDef,
} from "@/lib/system-menus";

const INPUT_BASE =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const PRESET_CUSTOM_ACTIONS: CustomActionDef[] = [
  { action: "excel", label: "Excel Export" },
  { action: "pdf", label: "PDF Export" },
  { action: "print", label: "Print" },
  { action: "approve", label: "Approve" },
  { action: "verify", label: "Verify" },
  { action: "reverse", label: "Reverse" },
];

interface MenuFormData {
  id: string | null;
  slug: string;
  title: string;
  path: string;
  icon: string;
  parentId: string;
  sortOrder: number;
  isActive: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  customActions: CustomActionDef[];
}

const EMPTY_FORM: MenuFormData = {
  id: null,
  slug: "",
  title: "",
  path: "",
  icon: "",
  parentId: "",
  sortOrder: 0,
  isActive: true,
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  customActions: [],
};

export default function MenusView() {
  const [menus, setMenus] = useState<SystemMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<MenuFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSystemMenus();
      setMenus(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load system menus";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Options for parent selector in modal and filter
  const parentOptions = useMemo(() => {
    const roots = menus.filter((m) => !m.parentId);
    return [
      { value: "", label: "None (Top-Level Root Menu)" },
      ...roots.map((m) => ({
        value: m.id,
        label: `${m.title} (${m.slug})`,
      })),
    ];
  }, [menus]);

  const filterParentOptions = useMemo(() => {
    return [
      { value: "", label: "All Menus (Roots & Children)" },
      { value: "ROOTS_ONLY", label: "Top-Level Roots Only" },
      { value: "CHILDREN_ONLY", label: "Sub-Menus Only" },
    ];
  }, []);

  const statusOptions = useMemo(() => {
    return [
      { value: "", label: "All Statuses" },
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ];
  }, []);

  // Filtered list
  const filteredMenus = useMemo(() => {
    return menus.filter((m) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesSlug = m.slug.toLowerCase().includes(q);
        const matchesPath = (m.path ?? "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesSlug && !matchesPath) return false;
      }

      if (parentFilter === "ROOTS_ONLY" && m.parentId) return false;
      if (parentFilter === "CHILDREN_ONLY" && !m.parentId) return false;

      if (statusFilter === "active" && !m.isActive) return false;
      if (statusFilter === "inactive" && m.isActive) return false;

      return true;
    });
  }, [menus, search, parentFilter, statusFilter]);

  const [newCustomKey, setNewCustomKey] = useState("");
  const [newCustomLabel, setNewCustomLabel] = useState("");

  function openCreateModal(defaultParentId?: string) {
    setForm({
      ...EMPTY_FORM,
      parentId: defaultParentId ?? "",
    });
    setNewCustomKey("");
    setNewCustomLabel("");
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(menu: SystemMenu) {
    const cfg = menu.actionsConfig;
    setForm({
      id: menu.id,
      slug: menu.slug,
      title: menu.title,
      path: menu.path ?? "",
      icon: menu.icon ?? "",
      parentId: menu.parentId ?? "",
      sortOrder: menu.sortOrder ?? 0,
      isActive: menu.isActive,
      canView: cfg?.canView ?? true,
      canCreate: cfg?.canCreate ?? true,
      canEdit: cfg?.canEdit ?? true,
      canDelete: cfg?.canDelete ?? true,
      customActions: Array.isArray(cfg?.custom) ? [...cfg.custom] : [],
    });
    setNewCustomKey("");
    setNewCustomLabel("");
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setNewCustomKey("");
    setNewCustomLabel("");
    setFormError(null);
  }

  function handleAddCustomAction(actionKey?: string, actionLabel?: string) {
    const rawKey = actionKey ?? newCustomKey;
    const rawLabel = actionLabel ?? newCustomLabel;
    const cleanKey = rawKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const cleanLabel = rawLabel.trim() || cleanKey;

    if (!cleanKey) {
      toast("Action key is required (e.g. excel, pdf, approve)", "warning");
      return;
    }

    if (form.customActions.some((c) => c.action === cleanKey)) {
      toast(`Action "${cleanKey}" is already added.`, "info");
      return;
    }

    setForm((prev) => ({
      ...prev,
      customActions: [...prev.customActions, { action: cleanKey, label: cleanLabel }],
    }));
    setNewCustomKey("");
    setNewCustomLabel("");
  }

  function handleRemoveCustomAction(actionKey: string) {
    setForm((prev) => ({
      ...prev,
      customActions: prev.customActions.filter((c) => c.action !== actionKey),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const slug = form.slug.trim().toLowerCase();
    const title = form.title.trim();

    if (!slug) {
      setFormError("Slug is required.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(slug)) {
      setFormError("Slug must contain only lowercase letters, numbers, and underscores.");
      return;
    }
    if (!title) {
      setFormError("Title is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const actionsConfig: MenuActionsConfig = {
      canView: form.canView,
      canCreate: form.canCreate,
      canEdit: form.canEdit,
      canDelete: form.canDelete,
      custom: form.customActions,
    };

    try {
      if (form.id) {
        const payload: UpdateSystemMenuInput = {
          slug,
          title,
          path: form.path.trim() || null,
          icon: form.icon.trim() || null,
          parentId: form.parentId || null,
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive,
          actionsConfig,
        };
        await updateSystemMenu(form.id, payload);
        toast(`Menu "${title}" updated successfully.`);
      } else {
        const payload: CreateSystemMenuInput = {
          slug,
          title,
          path: form.path.trim() || null,
          icon: form.icon.trim() || null,
          parentId: form.parentId || null,
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive,
          actionsConfig,
        };
        await createSystemMenu(payload);
        toast(`Menu "${title}" created successfully.`);
      }

      closeModal();
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save menu";
      setFormError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(menu: SystemMenu) {
    const confirmed = await confirmDialog({
      title: `Delete Menu "${menu.title}"?`,
      text: `Are you sure you want to delete "${menu.slug}"? Role and user permissions associated with this menu will be removed.`,
      confirmText: "Delete Menu",
      danger: true,
    });

    if (!confirmed) return;

    try {
      await deleteSystemMenu(menu.id);
      toast(`Menu "${menu.title}" deleted.`);
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete menu";
      toast(msg, "error");
    }
  }

  if (loading) {
    return <AdminPageLoader />;
  }

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="System Menus"
        description="Configure system menus, slugs, paths, hierarchy, and ordering for hybrid RBAC navigation."
        actions={
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="flex items-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-xs font-semibold text-white cursor-pointer hover:bg-brand-700 transition-colors"
          >
            <FiPlus className="h-3.5 w-3.5" />
            <span>Add Menu</span>
          </button>
        }
      />

      {/* Filter bar */}
      <DashCard title="Filter & Search Menus">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0 sm:col-span-2 2xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-700">Search</label>
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
              <input
                type="text"
                placeholder="Search by title, slug, or path…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${INPUT_BASE} pl-8`}
              />
            </div>
          </div>

          <div className="min-w-0 sm:col-span-1 2xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-700">Hierarchy</label>
            <SearchSelect
              options={filterParentOptions}
              value={parentFilter}
              onChange={setParentFilter}
              placeholder="All Menus"
              isClearable
            />
          </div>

          <div className="min-w-0 sm:col-span-1 2xl:col-span-1">
            <label className="mb-1 block text-xs font-medium text-ink-700">Status</label>
            <SearchSelect
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Statuses"
              isClearable
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2 2xl:col-span-1">
            {(search || parentFilter || statusFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setParentFilter("");
                  setStatusFilter("");
                }}
                className="w-full rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </DashCard>

      {/* Table */}
      <DashCard
        title={`Menu Registry (${filteredMenus.length} of ${menus.length})`}
        action={
          <span className="text-xs text-ink-500">
            Ordered by sortOrder
          </span>
        }
      >
        <div className="overflow-x-auto rounded-xs border border-ink-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-50 text-ink-700">
              <tr>
                <th className="px-2.5 py-1.5 font-semibold">Title & Hierarchy</th>
                <th className="px-2.5 py-1.5 font-semibold">Slug (RBAC Gate)</th>
                <th className="px-2.5 py-1.5 font-semibold">Path</th>
                <th className="px-2.5 py-1.5 font-semibold">Capabilities & Actions</th>
                <th className="px-2.5 py-1.5 font-semibold">Icon</th>
                <th className="px-2.5 py-1.5 font-semibold text-center">Sort Order</th>
                <th className="px-2.5 py-1.5 font-semibold text-center">Status</th>
                <th className="px-2.5 py-1.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 bg-white">
              {filteredMenus.map((m) => {
                const isChild = !!m.parentId;
                return (
                  <tr key={m.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        {isChild ? (
                          <>
                            <span className="text-ink-400 pl-2">
                              <FiCornerDownRight className="h-3.5 w-3.5 inline" />
                            </span>
                            <span className="font-medium text-ink-900">{m.title}</span>
                            {m.parent && (
                              <span className="rounded-xs bg-ink-100 px-1 py-0.2 text-[10px] text-ink-600">
                                of {m.parent.title}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <FiLayers className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                            <span className="font-semibold text-ink-900">{m.title}</span>
                            <span className="rounded-xs bg-brand-50 px-1.5 py-0.2 text-[10px] font-medium text-brand-700">
                              Root
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-ink-600 font-semibold">
                      {m.slug}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-ink-500 truncate max-w-xs">
                      {m.path || <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {m.actionsConfig &&
                        !m.actionsConfig.canCreate &&
                        !m.actionsConfig.canEdit &&
                        !m.actionsConfig.canDelete ? (
                          <span className="rounded-xs bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800">
                            View only
                          </span>
                        ) : (
                          <span className="rounded-xs bg-ink-100 border border-ink-200 px-1.5 py-0.2 text-[10px] font-medium text-ink-700">
                            {m.actionsConfig
                              ? [
                                  m.actionsConfig.canView !== false && "View",
                                  m.actionsConfig.canCreate !== false && "Create",
                                  m.actionsConfig.canEdit !== false && "Edit",
                                  m.actionsConfig.canDelete !== false && "Delete",
                                ]
                                  .filter(Boolean)
                                  .join("/")
                              : "CRUD"}
                          </span>
                        )}
                        {Array.isArray(m.actionsConfig?.custom) &&
                          m.actionsConfig.custom.map((c) => (
                            <span
                              key={c.action}
                              className="rounded-xs bg-brand-50 border border-brand-200 px-1.5 py-0.2 text-[10px] font-semibold text-brand-700"
                              title={`Action: ${c.action}`}
                            >
                              +{c.label}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-ink-500">
                      {m.icon || <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-center text-ink-700">
                      {m.sortOrder}
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      {m.isActive ? (
                        <span className="rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isChild && (
                          <button
                            type="button"
                            onClick={() => openCreateModal(m.id)}
                            className="flex items-center gap-1 rounded-xs border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 cursor-pointer"
                            title={`Add child navigation menu under ${m.title}`}
                          >
                            <FiPlus className="h-3 w-3" />
                            <span>Submenu</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          className="flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50 cursor-pointer"
                        >
                          <FiEdit className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m)}
                          className="flex items-center gap-1 rounded-xs border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                        >
                          <FiTrash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredMenus.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-400">
                    <p className="mb-2">No system menus match your filters.</p>
                    <button
                      type="button"
                      onClick={() => openCreateModal()}
                      className="inline-flex items-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-xs font-semibold text-white cursor-pointer hover:bg-brand-700 transition-colors"
                    >
                      <FiPlus className="h-3.5 w-3.5" />
                      <span>Add Menu</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashCard>

      {/* Modal for Add / Edit */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xs bg-white p-5"
            role="dialog"
            aria-modal="true"
            aria-label={form.id ? "Edit System Menu" : "Add System Menu"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <h3 className="text-base font-semibold text-ink-900">
                {form.id ? `Edit Menu: ${form.title}` : "Add New System Menu"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xs p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 cursor-pointer"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-xs border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fee Management"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={INPUT_BASE}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">
                  Slug (RBAC Gate) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. fee_management"
                  value={form.slug}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    })
                  }
                  className={`${INPUT_BASE} font-mono`}
                />
                <p className="mt-1 text-[11px] text-ink-400">
                  Unique identifier used in `@RequirePermission` and `requireMenu(slug)`.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">
                  Path (Route URL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. /admin/accounting/collection"
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                  className={`${INPUT_BASE} font-mono`}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">
                  Parent Menu (Hierarchy)
                </label>
                <SearchSelect
                  options={parentOptions.filter((opt) => opt.value !== form.id)}
                  value={form.parentId}
                  onChange={(val) => setForm({ ...form, parentId: val })}
                  placeholder="None (Top-Level Root Menu)"
                  isClearable
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">
                    Icon Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Zap, Banknote"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className={INPUT_BASE}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })
                    }
                    className={INPUT_BASE}
                  />
                </div>
              </div>

              {/* Page Capabilities & Custom Dynamic Actions */}
              <div className="rounded-xs border border-ink-200 bg-ink-50/50 p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-ink-200/60 pb-1.5">
                  <span className="text-xs font-bold text-navy-900">
                    Capabilities & Custom Actions
                  </span>
                  <span className="text-[11px] text-ink-500">
                    Controls matrix checkboxes in User Permissions
                  </span>
                </div>

                {/* Standard CRUD capabilities */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase text-ink-500">
                    Applicable Standard Actions
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-1.5 text-xs text-ink-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.canView}
                        onChange={(e) => setForm({ ...form, canView: e.target.checked })}
                        className="rounded-xs border-ink-300 text-brand-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                      />
                      <span>View</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-ink-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.canCreate}
                        onChange={(e) => setForm({ ...form, canCreate: e.target.checked })}
                        className="rounded-xs border-ink-300 text-brand-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                      />
                      <span>Create</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-ink-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.canEdit}
                        onChange={(e) => setForm({ ...form, canEdit: e.target.checked })}
                        className="rounded-xs border-ink-300 text-brand-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                      />
                      <span>Edit</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-ink-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.canDelete}
                        onChange={(e) => setForm({ ...form, canDelete: e.target.checked })}
                        className="rounded-xs border-ink-300 text-brand-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                      />
                      <span>Delete</span>
                    </label>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-400">
                    Uncheck Create, Edit, or Delete for read-only pages (e.g. Dashboard, Reports, Audit).
                  </p>
                </div>

                {/* Custom Dynamic Actions */}
                <div className="border-t border-ink-200/60 pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold uppercase text-ink-500">
                      Custom Actions (e.g. Export, Print, Approve)
                    </label>
                  </div>

                  {/* Preset Quick Add Buttons */}
                  <div className="mb-2 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-ink-400 mr-1">Presets:</span>
                    {PRESET_CUSTOM_ACTIONS.map((preset) => {
                      const alreadyAdded = form.customActions.some((c) => c.action === preset.action);
                      return (
                        <button
                          key={preset.action}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => handleAddCustomAction(preset.action, preset.label)}
                          className={`rounded-xs border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            alreadyAdded
                              ? "border-ink-200 bg-ink-100 text-ink-400 cursor-not-allowed"
                              : "border-brand-300 bg-white text-brand-700 hover:bg-brand-50 cursor-pointer"
                          }`}
                        >
                          + {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Configured Custom Actions Badges */}
                  {form.customActions.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {form.customActions.map((c) => (
                        <span
                          key={c.action}
                          className="inline-flex items-center gap-1 rounded-xs border border-brand-300 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800"
                        >
                          <span>{c.label}</span>
                          <span className="font-mono text-[10px] text-brand-600">({c.action})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomAction(c.action)}
                            className="text-brand-500 hover:text-brand-900 cursor-pointer ml-0.5"
                            title="Remove action"
                          >
                            <FiX className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-2 text-[11px] text-ink-400 italic">
                      No custom actions configured. Standard permissions will apply.
                    </p>
                  )}

                  {/* Add New Custom Action Inputs */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Action key (e.g. excel)"
                      value={newCustomKey}
                      onChange={(e) =>
                        setNewCustomKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                      }
                      className={`${INPUT_BASE} font-mono text-xs`}
                    />
                    <input
                      type="text"
                      placeholder="Label (e.g. Excel Export)"
                      value={newCustomLabel}
                      onChange={(e) => setNewCustomLabel(e.target.value)}
                      className={`${INPUT_BASE} text-xs`}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomAction()}
                      className="shrink-0 rounded-xs border border-brand-600 bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded-xs border-ink-300 text-brand-600 focus:ring-0 cursor-pointer h-4 w-4"
                />
                <label htmlFor="isActive" className="text-xs font-medium text-ink-700 cursor-pointer">
                  Active (visible in system menus & permission assignment)
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-ink-100 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xs border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 cursor-pointer disabled:opacity-50"
                >
                  {saving && <FiLoader className="h-4 w-4 animate-spin" />}
                  <span>{form.id ? "Save Changes" : "Create Menu"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
