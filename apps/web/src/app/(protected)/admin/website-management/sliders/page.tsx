"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Save, X, Loader2, Eye, EyeOff } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/dashboard/DataTable";
import { DashCard } from "@/components/dashboard/DashPage";
import ImageUploader from "@/components/dashboard/ImageUploader";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { resolveImageUrl, isExternalImage } from "@/lib/media";
import { confirmDialog, toast } from "@/lib/swal";
import type { Slider } from "@/lib/sliders";

interface FormState {
  id: number | null;
  imageUrl: string;
  titleEn: string;
  titleBn: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  imageUrl: "",
  titleEn: "",
  titleBn: "",
  sortOrder: 1,
  isActive: true,
};

const MIN_SORT_ORDER = 1;

const INPUT_BASE =
  "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400";

export default function SlidersPage() {
  const [slides, setSlides] = useState<Slider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<"imageUrl", string>>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/sliders");
      const data = (await res.json()) as Slider[];
      setSlides(Array.isArray(data) ? data : []);
    } catch {
      toast("Could not load the slider list.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function nextSortOrder(): number {
    const max = slides.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), 0);
    return Math.max(MIN_SORT_ORDER, max + 1);
  }

  function openAddForm() {
    setForm({ ...EMPTY_FORM, sortOrder: nextSortOrder() });
    setErrors({});
    setFormOpen(true);
  }

  function openEditForm(slide: Slider) {
    setForm({
      id: slide.id,
      imageUrl: slide.imageUrl,
      titleEn: slide.titleEn ?? "",
      titleBn: slide.titleBn ?? "",
      sortOrder: slide.sortOrder,
      isActive: slide.isActive,
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
    if (!form.imageUrl.trim()) next.imageUrl = "A slide image is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        imageUrl: form.imageUrl.trim(),
        titleEn: form.titleEn.trim() || undefined,
        titleBn: form.titleBn.trim() || undefined,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      const res = await fetch(form.id ? `/api/sliders/${form.id}` : "/api/sliders", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
        throw new Error(detail || "Save failed.");
      }
      toast(form.id ? "Slide updated." : "Slide added.");
      closeForm();
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  /** Toggle a slide active/inactive inline from the table. */
  async function toggleActive(slide: Slider) {
    try {
      const res = await fetch(`/api/sliders/${slide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !slide.isActive }),
      });
      if (!res.ok) throw new Error();
      toast(slide.isActive ? "Slide hidden from the site." : "Slide is now visible.");
      await load();
    } catch {
      toast("Could not update this slide.", "error");
    }
  }

  async function handleDelete(slide: Slider) {
    const confirmed = await confirmDialog({
      title: "Remove this slide?",
      text: `The slide "${slide.titleEn || "Untitled"}" will be removed from the home page slider.`,
      confirmText: "Yes, remove",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/sliders/${slide.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Slide removed.");
      if (form.id === slide.id) closeForm();
      await load();
    } catch {
      toast("Could not remove this slide.", "error");
    }
  }

  const columns = useMemo<ColumnDef<Slider, any>[]>(
    () => [
      {
        header: "Preview",
        accessorKey: "imageUrl",
        cell: ({ row }) => {
          const s = row.original;
          return s.imageUrl ? (
            <Image
              src={resolveImageUrl(s.imageUrl)}
              alt={s.titleEn ?? "Slide"}
              width={120}
              height={68}
              unoptimized={isExternalImage(s.imageUrl)}
              className="h-[68px] w-[120px] rounded-md object-cover"
            />
          ) : (
            <span className="flex h-[68px] w-[120px] items-center justify-center rounded-md bg-ink-100 text-2xl font-semibold text-ink-400">
              ?
            </span>
          );
        },
      },
      { header: "Title", accessorKey: "titleEn" },
      {
        header: "Status",
        accessorKey: "isActive",
        cell: ({ row }) => {
          const s = row.original;
          return s.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <Eye className="h-3 w-3" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-500">
              <EyeOff className="h-3 w-3" /> Hidden
            </span>
          );
        },
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleActive(row.original)}
              className={`rounded p-1.5 hover:bg-ink-50 ${
                row.original.isActive ? "text-emerald-600" : "text-ink-400"
              }`}
              aria-label={row.original.isActive ? "Hide slide" : "Show slide"}
              title={row.original.isActive ? "Hide from site" : "Show on site"}
            >
              {row.original.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
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
    <section className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Slider</h1>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add slide
          </button>
        )}
      </div>

      {formOpen && (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy-900">
              {form.id ? "Edit slide" : "Add slide"}
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

          <DashCard>
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink-700">Slide image</span>
                <ImageUploader
                  endpoint="/api/uploads/hero-slider"
                  value={form.imageUrl}
                  onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
                  emptyLabel="Drop or click to upload"
                  previewClassName="aspect-[16/9] w-full"
                />
                {errors.imageUrl && (
                  <span className="mt-1 block text-xs leading-tight text-red-600">
                    {errors.imageUrl}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Title (English)">
                    <input
                      value={form.titleEn}
                      onChange={(e) => setForm((prev) => ({ ...prev, titleEn: e.target.value }))}
                      className={`${INPUT_BASE} border-ink-200`}
                      placeholder="Welcome to our school"
                    />
                  </Field>

                  <Field label="শিরোনাম (বাংলা)">
                    <input
                      value={form.titleBn}
                      onChange={(e) => setForm((prev) => ({ ...prev, titleBn: e.target.value }))}
                      className={`${INPUT_BASE} border-ink-200`}
                      placeholder="আমাদের স্কুলে স্বাগতম"
                      dir="auto"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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

                  <label className="flex items-end gap-2 pb-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600"
                    />
                    <span className="text-sm font-medium text-ink-700">
                      Active (visible on the public site)
                    </span>
                  </label>
                </div>
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
          data={slides}
          emptyMessage="No slides yet."
          footer={`Total slides: ${slides.length}`}
        />
      )}
    </section>
  );
}

/** Labeled input wrapper that matches the site-settings standard. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs leading-tight text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}
