"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Save, X, Loader2, Building2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/dashboard/DataTable";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { confirmDialog, toast } from "@/lib/swal";
import {
  listModules,
  createModule,
  updateModule,
  deleteModule,
  type Module,
} from "@/lib/modules";

interface FormState {
  id: number | null;
  name: string;
}

const EMPTY_FORM: FormState = { id: null, name: "" };

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listModules();
      setModules(Array.isArray(data) ? data : []);
    } catch {
      toast("Could not load modules.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAddForm() {
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(mod: Module) {
    setForm({ id: mod.id, name: mod.name });
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit() {
    const name = form.name.trim();
    if (!name) {
      setError("Module name is required.");
      return;
    }
    if (name.length < 2) {
      setError("Module name must be at least 2 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (form.id) {
        await updateModule(form.id, { name });
        toast(`Module "${name}" updated.`);
      } else {
        await createModule({ name });
        toast(`Module "${name}" created.`);
      }
      closeForm();
      await load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save module.";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mod: Module) {
    const confirmed = await confirmDialog({
      title: "Remove this module?",
      text: `"${mod.name}" will be removed. Permissions linked to it will be unassigned (set to none).`,
      confirmText: "Yes, remove",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteModule(mod.id);
      toast(`"${mod.name}" removed.`);
      if (form.id === mod.id) closeForm();
      await load();
    } catch {
      toast("Could not remove this module.", "error");
    }
  }

  const columns = useMemo<ColumnDef<Module>[]>(
    () => [
      {
        header: "Module",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-semibold text-navy-900">
            <Building2 className="h-4 w-4 text-brand-500" />
            {row.original.name}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => openEditForm(row.original)}
              className="rounded p-1.5 text-brand-600 hover:bg-brand-50"
              aria-label="Edit module"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(row.original)}
              className="rounded p-1.5 text-red-600 hover:bg-red-50"
              aria-label="Remove module"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="p-4">
      <DashPageHeader title="Modules" />

      {!formOpen && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Module
          </button>
        </div>
      )}

      {formOpen && (
        <DashCard className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-900">
              {form.id ? "Edit Module" : "Add Module"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="rounded p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-w-md">
            <label className="mb-1.5 block text-sm font-semibold text-ink-700">
              Module Name
            </label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Website Management"
              className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            {error && (
              <span className="mt-1 block text-xs text-red-600">{error}</span>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-ink-100 pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              Cancel
            </button>
          </div>
        </DashCard>
      )}

      {loading ? (
        <AdminPageLoader />
      ) : (
        <DataTable
          columns={columns}
          data={modules}
          emptyMessage="No modules defined yet. Click “Add Module” to create the first one."
          footer={`${modules.length} module${modules.length === 1 ? "" : "s"}`}
        />
      )}
    </div>
  );
}
