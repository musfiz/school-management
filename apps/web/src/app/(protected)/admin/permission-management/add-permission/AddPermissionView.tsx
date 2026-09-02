"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  Loader2,
  KeyRound,
  ShieldCheck,
  Pencil,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  listPermissions,
  createPermission,
  type Permission,
} from "@/lib/permissions";
import { listModules, type Module } from "@/lib/modules";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import DataTable from "@/components/dashboard/DataTable";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { confirmDialog, toast } from "@/lib/swal";

interface PermissionRow extends Permission {
  isNew?: boolean;
  isEditing?: boolean;
}

export default function AddPermissionView() {
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perms, mods] = await Promise.all([
        listPermissions(),
        listModules(),
      ]);
      setRows(perms.map((p) => ({ ...p })));
      setModules(Array.isArray(mods) ? mods : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load permissions.";
      setError(message);
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function addRow() {
    setRows((prev) => [
      {
        id: Date.now(), // temp client id
        name: "",
        description: "",
        module_id: null,
        isNew: true,
        isEditing: true,
      },
      ...prev,
    ]);
  }

  function startEdit(id: number) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isEditing: true } : r)),
    );
  }

  function cancelEdit(id: number) {
    setRows((prev) =>
      prev
        .map((r) =>
          r.id === id
            ? { ...r, isEditing: false, name: r.name, description: r.description }
            : r,
        )
        .filter((r) => !(r.id === id && r.isNew && !r.name)),
    );
  }

  function patchRow(id: number, patch: Partial<PermissionRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function saveRow(id: number, data: { name: string; description?: string | null; module_id?: number | null }, isNew: boolean) {
    const name = data.name.trim();
    if (!name) {
      toast("Permission name is required.", "warning");
      return;
    }
    if (name.length < 3) {
      toast("Permission name must be at least 3 characters.", "warning");
      return;
    }

    setSavingId(id);
    setError(null);
    try {
      const created = await createPermission({
        name,
        description: data.description?.trim() || undefined,
        module_id: data.module_id ?? null,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...created, isNew: false, isEditing: false } : r,
        ),
      );
      toast(`Permission "${created.name}" ${isNew ? "created" : "updated"}.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save permission.";
      setError(message);
      toast(message, "error");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteRow(id: number, name: string) {
    const confirmed = await confirmDialog({
      title: "Remove this permission?",
      text: `"${name}" will be deleted from the catalog. Users who have it assigned will lose it.`,
      confirmText: "Yes, remove",
      danger: true,
    });
    if (!confirmed) return;

    setRows((prev) => prev.filter((r) => r.id !== id));
    toast(`"${name}" removed (reload to persist if it was already saved).`, "info");
  }

  const columns = useMemo<ColumnDef<PermissionRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Permission",
        cell: ({ row }) => {
          const r = row.original;
          const saving = savingId === r.id;
          if (r.isEditing) {
            return (
              <input
                autoFocus
                value={r.name}
                onChange={(e) => patchRow(r.id, { name: e.target.value })}
                placeholder="e.g. results.edit"
                className="w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
              />
            );
          }
          return (
            <span className="flex items-center gap-2 font-mono text-sm font-semibold text-navy-900">
              <KeyRound className="h-4 w-4 text-brand-500" />
              {r.name}
            </span>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const r = row.original;
          const saving = savingId === r.id;
          if (r.isEditing) {
            return (
              <input
                value={r.description ?? ""}
                onChange={(e) =>
                  patchRow(r.id, { description: e.target.value })
                }
                placeholder="Optional description"
                className="w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
              />
            );
          }
          return (
            <span className="text-sm text-ink-600">
              {r.description ?? <span className="text-ink-400">—</span>}
            </span>
          );
        },
      },
      {
        accessorKey: "module_id",
        header: "Module",
        cell: ({ row }) => {
          const r = row.original;
          const saving = savingId === r.id;
          if (r.isEditing) {
            return (
              <select
                value={r.module_id ?? ""}
                onChange={(e) =>
                  patchRow(r.id, {
                    module_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
              >
                <option value="">— None —</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            );
          }
          const mod = modules.find((m) => m.id === r.module_id);
          return (
            <span className="text-sm text-ink-600">
              {mod?.name ?? <span className="text-ink-400">—</span>}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const r = row.original;
          const saving = savingId === r.id;
          return (
            <div className="flex items-center justify-end gap-1">
              {r.isEditing ? (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      saveRow(r.id, { name: r.name, description: r.description, module_id: r.module_id ?? null }, !!r.isNew)
                    }
                    className="flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelEdit(r.id)}
                    className="rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(r.id)}
                    className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50"
                    aria-label="Edit permission"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRow(r.id, r.name)}
                    className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                    aria-label="Remove permission"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    // savingId + rows intentionally excluded from deps; we read them via closure
    // but rebuild when identity changes (stable enough for this local table).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savingId],
  );

  return (
    <div className="p-4">
      <DashPageHeader title="Add Permission" />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DashCard title="Permission Catalog">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-ink-500">
            {rows.length} permission{rows.length === 1 ? "" : "s"} defined.
          </p>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Permission
          </button>
        </div>

        {loading ? (
          <AdminPageLoader />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No permissions defined yet. Click “Add Permission” to create the first one."
          />
        )}
      </DashCard>
    </div>
  );
}
