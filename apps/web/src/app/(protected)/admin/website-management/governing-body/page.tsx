"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Save, X, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/dashboard/DataTable";
import { DashCard } from "@/components/dashboard/DashPage";
import ImageUploader from "@/components/dashboard/ImageUploader";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { resolveImageUrl, isExternalImage } from "@/lib/media";
import { confirmDialog, toast } from "@/lib/swal";
import type { GoverningBodyMember } from "@/lib/governing-body";

interface FormState {
  id: number | null;
  name: string;
  nameBn: string;
  designation: string;
  designationBn: string;
  imageUrl: string;
  sortOrder: number;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  nameBn: "",
  designation: "",
  designationBn: "",
  imageUrl: "",
  sortOrder: 1,
};

// Sort order starts at 1 (the first member) — this matches how a viewer
// counts cards top-to-bottom and avoids the "0 looks off" edge case.
const MIN_SORT_ORDER = 1;

const INPUT_BASE =
  "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400";

export default function GoverningBodyPage() {
  const [members, setMembers] = useState<GoverningBodyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<"name" | "designation", string>>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/governing-body");
      const data = (await res.json()) as GoverningBodyMember[];
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      toast("Could not load the governing body list.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function nextSortOrder(): number {
    // Append at the bottom so existing rows stay in place. For an empty
    // roster this returns 1 — i.e. the first member is the first card.
    const max = members.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), 0);
    return Math.max(MIN_SORT_ORDER, max + 1);
  }

  function openAddForm() {
    setForm({ ...EMPTY_FORM, sortOrder: nextSortOrder() });
    setErrors({});
    setFormOpen(true);
  }

  function openEditForm(member: GoverningBodyMember) {
    setForm({
      id: member.id,
      name: member.name,
      nameBn: member.nameBn ?? "",
      designation: member.designation,
      designationBn: member.designationBn ?? "",
      imageUrl: member.imageUrl ?? "",
      sortOrder: member.sortOrder,
    });
    setErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.designation.trim()) next.designation = "Designation is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        nameBn: form.nameBn.trim() || undefined,
        designation: form.designation.trim(),
        designationBn: form.designationBn.trim() || undefined,
        imageUrl: form.imageUrl || undefined,
        sortOrder: form.sortOrder,
      };
      const res = await fetch(form.id ? `/api/governing-body/${form.id}` : "/api/governing-body", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
        throw new Error(detail || "Save failed.");
      }
      toast(form.id ? "Member updated." : "Member added.");
      closeForm();
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: GoverningBodyMember) {
    const confirmed = await confirmDialog({
      title: "Remove this member?",
      text: `"${member.name}" will be removed from the governing body list.`,
      confirmText: "Yes, remove",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/governing-body/${member.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Member removed.");
      if (form.id === member.id) closeForm();
      await load();
    } catch {
      toast("Could not remove this member.", "error");
    }
  }

  const columns = useMemo<ColumnDef<GoverningBodyMember, any>[]>(
    () => [
      {
        header: "Photo",
        accessorKey: "imageUrl",
        cell: ({ row }) => {
          const m = row.original;
          return m.imageUrl ? (
            <Image
              src={resolveImageUrl(m.imageUrl)}
              alt={m.name}
              width={100}
              height={150}
              unoptimized={isExternalImage(m.imageUrl)}
              className="h-[150px] w-[100px] rounded-md object-cover"
            />
          ) : (
            <span className="flex h-[150px] w-[100px] items-center justify-center rounded-md bg-ink-100 text-2xl font-semibold text-ink-400">
              {m.name.slice(0, 1).toUpperCase()}
            </span>
          );
        },
      },
      { header: "Name", accessorKey: "name" },
      { header: "Designation", accessorKey: "designation" },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEditForm(row.original)}
              className="rounded p-1.5 text-brand-600 hover:bg-brand-50"
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(row.original)}
              className="rounded p-1.5 text-red-600 hover:bg-red-50"
              aria-label="Delete"
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
    <section className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Governing Body</h1>
          <p className="mt-1 text-sm text-ink-500">
            Manage the members shown on the public Governing Body page.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add member
          </button>
        )}
      </div>

      {formOpen && (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy-900">
              {form.id ? "Edit member" : "Add member"}
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

          {/* Single card: 100×150 image left | fields right, buttons in footer */}
          <DashCard>
            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink-700">Photo</span>
                <ImageUploader
                  value={form.imageUrl}
                  onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
                  emptyLabel="Drop or click to upload"
                  previewClassName="h-[150px] w-[100px]"
                />
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name (English)" error={errors.name}>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      className={`${INPUT_BASE} ${errors.name ? "border-red-400" : "border-ink-200"}`}
                    />
                  </Field>

                  <Field label="নাম (বাংলা)">
                    <input
                      value={form.nameBn}
                      onChange={(e) => setForm((prev) => ({ ...prev, nameBn: e.target.value }))}
                      className={`${INPUT_BASE} border-ink-200`}
                      dir="auto"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Designation (English)" error={errors.designation}>
                    <input
                      value={form.designation}
                      onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value }))}
                      className={`${INPUT_BASE} ${errors.designation ? "border-red-400" : "border-ink-200"}`}
                    />
                  </Field>

                  <Field label="পদবি (বাংলা)">
                    <input
                      value={form.designationBn}
                      onChange={(e) => setForm((prev) => ({ ...prev, designationBn: e.target.value }))}
                      className={`${INPUT_BASE} border-ink-200`}
                      dir="auto"
                    />
                  </Field>
                </div>

                <Field label="Sort order" hint="Lower numbers appear first on the public page.">
                  <input
                    type="number"
                    min={MIN_SORT_ORDER}
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sortOrder: Math.max(MIN_SORT_ORDER, Number(e.target.value) || MIN_SORT_ORDER),
                      }))
                    }
                    className={`${INPUT_BASE} w-24 border-ink-200`}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-ink-100 pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand-700"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
        </div>
      )}

      {loading ? (
        <AdminPageLoader />
      ) : (
        <DataTable
          columns={columns}
          data={members}
          emptyMessage="No governing body members yet."
          footer={`Total members: ${members.length}`}
        />
      )}
    </section>
  );
}

/**
 * Labeled input wrapper that matches the site-settings standard:
 * `mb-1.5` label + `py-2` input keeps consistent field height across pages.
 */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs leading-tight text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs leading-tight text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}