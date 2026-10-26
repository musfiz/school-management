"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FiPlus, FiEdit, FiTrash, FiSave, FiX, FiLoader, FiEye, FiEyeOff } from "react-icons/fi";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/dashboard/DataTable";
import { DashCard } from "@/components/dashboard/DashPage";
import GlobalImageUploader from "@/components/common/image-uploader/global-image-uploader";
import { ImagePreset } from "@/constants/image-upload-presets";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { resolveImageUrl, isExternalImage } from "@/lib/media";
import { confirmDialog, toast } from "@/lib/swal";

export interface GalleryRecord {
  id: string;
  imageUrl: string;
  titleEn?: string | null;
  titleBn?: string | null;
  subtitleEn?: string | null;
  subtitleBn?: string | null;
  tagEn?: string | null;
  tagBn?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
}

interface FormState {
  id: string | null;
  imageUrl: string;
  titleEn: string;
  titleBn: string;
  subtitleEn: string;
  subtitleBn: string;
  tagEn: string;
  tagBn: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  imageUrl: "",
  titleEn: "",
  titleBn: "",
  subtitleEn: "",
  subtitleBn: "",
  tagEn: "",
  tagBn: "",
  sortOrder: 1,
  isActive: true,
};

const MIN_SORT_ORDER = 1;

const INPUT_BASE =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

export default function GalleryManagementPage() {
  const [items, setItems] = useState<GalleryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<"imageUrl", string>>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/galleries");
      const data = (await res.json()) as GalleryRecord[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast("Could not load gallery items.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function nextSortOrder(): number {
    const max = items.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), 0);
    return Math.max(MIN_SORT_ORDER, max + 1);
  }

  function openAddForm() {
    setForm({ ...EMPTY_FORM, sortOrder: nextSortOrder() });
    setErrors({});
    setFormOpen(true);
  }

  function openEditForm(item: GalleryRecord) {
    setForm({
      id: item.id,
      imageUrl: item.imageUrl,
      titleEn: item.titleEn ?? "",
      titleBn: item.titleBn ?? "",
      subtitleEn: item.subtitleEn ?? "",
      subtitleBn: item.subtitleBn ?? "",
      tagEn: item.tagEn ?? "",
      tagBn: item.tagBn ?? "",
      sortOrder: item.sortOrder ?? 1,
      isActive: item.isActive,
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
    if (!form.imageUrl.trim()) {
      next.imageUrl = "An image is required. Please crop and upload a photo.";
    }
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
        subtitleEn: form.subtitleEn.trim() || undefined,
        subtitleBn: form.subtitleBn.trim() || undefined,
        tagEn: form.tagEn.trim() || undefined,
        tagBn: form.tagBn.trim() || undefined,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };

      const res = await fetch(form.id ? `/api/galleries/${form.id}` : "/api/galleries", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
        throw new Error(detail || "Save failed.");
      }

      toast(form.id ? "Gallery item updated." : "Gallery photo added.");
      closeForm();
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: GalleryRecord) {
    try {
      const res = await fetch(`/api/galleries/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error();
      toast(item.isActive ? "Photo hidden from public gallery." : "Photo is now live in gallery.");
      await load();
    } catch {
      toast("Could not update photo status.", "error");
    }
  }

  async function handleDelete(item: GalleryRecord) {
    const confirmed = await confirmDialog({
      title: "Remove this gallery photo?",
      text: `"${item.titleEn || "This photo"}" will be permanently removed from the gallery.`,
      confirmText: "Yes, remove",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/galleries/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Photo removed.");
      if (form.id === item.id) closeForm();
      await load();
    } catch {
      toast("Could not remove photo.", "error");
    }
  }

  const columns = useMemo<ColumnDef<GalleryRecord, any>[]>(
    () => [
      {
        header: "Preview",
        accessorKey: "imageUrl",
        cell: ({ row }) => {
          const item = row.original;
          return item.imageUrl ? (
            <div className="relative h-12 w-16 overflow-hidden rounded-xs border border-ink-200 bg-ink-100">
              <Image
                src={resolveImageUrl(item.imageUrl)}
                alt={item.titleEn ?? "Gallery photo"}
                fill
                sizes="64px"
                unoptimized={isExternalImage(item.imageUrl)}
                className="object-cover"
              />
            </div>
          ) : (
            <span className="flex h-12 w-16 items-center justify-center rounded-xs bg-ink-100 text-xs font-semibold text-ink-400">
              No image
            </span>
          );
        },
      },
      {
        header: "Title & Subtitle",
        accessorKey: "titleEn",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="min-w-0 max-w-xs">
              <p className="truncate font-medium text-navy-900">
                {item.titleEn || item.titleBn || <span className="italic text-ink-400">Untitled</span>}
              </p>
              {(item.subtitleEn || item.subtitleBn) && (
                <p className="truncate text-xs text-ink-500">{item.subtitleEn || item.subtitleBn}</p>
              )}
            </div>
          );
        },
      },
      {
        header: "Tag / Category",
        accessorKey: "tagEn",
        cell: ({ row }) => {
          const tag = row.original.tagEn || row.original.tagBn;
          return tag ? (
            <span className="rounded-xs bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {tag}
            </span>
          ) : (
            <span className="text-xs text-ink-400">—</span>
          );
        },
      },
      {
        header: "Order",
        accessorKey: "sortOrder",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.sortOrder}</span>,
      },
      {
        header: "Status",
        accessorKey: "isActive",
        cell: ({ row }) => {
          const item = row.original;
          return item.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
              <FiEye className="h-3 w-3" /> Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
              <FiEyeOff className="h-3 w-3" /> Hidden
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
              className={`rounded-xs border border-transparent p-1.5 hover:bg-ink-100 ${
                row.original.isActive ? "text-emerald-600" : "text-ink-400"
              }`}
              aria-label={row.original.isActive ? "Hide photo" : "Show photo"}
              title={row.original.isActive ? "Hide from site" : "Show on site"}
            >
              {row.original.isActive ? <FiEye className="h-4 w-4" /> : <FiEyeOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => openEditForm(row.original)}
              className="rounded-xs border border-transparent p-1.5 text-ink-600 hover:bg-ink-100 hover:text-brand-600"
              aria-label="Edit photo"
              title="Edit photo details"
            >
              <FiEdit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(row.original)}
              className="rounded-xs border border-transparent p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Remove photo"
              title="Delete photo"
            >
              <FiTrash className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  if (loading) return <AdminPageLoader />;

  return (
    <section className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Photo Gallery</h1>
          <p className="text-xs text-ink-500">
            Manage public website photo gallery with interactive cropping and locale support.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <FiPlus className="h-3.5 w-3.5" />
            Add Photo
          </button>
        )}
      </div>

      {formOpen && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-navy-900">
              {form.id ? "Edit Gallery Photo" : "Upload Gallery Photo"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xs p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close form"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>

          <DashCard>
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              {/* Image Upload Stage with CropModal support */}
              <div>
                <span className="mb-1.5 block text-xs font-medium text-ink-700">
                  Photo (Required) <span className="text-rose-500">*</span>
                </span>
                <GlobalImageUploader
                  preset={ImagePreset.GALLERY}
                  uploadEndpoint="/api/uploads/gallery"
                  value={form.imageUrl || null}
                  onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url ?? "" }))}
                />
                {errors.imageUrl && (
                  <span className="mt-1 block text-xs leading-tight text-red-600">
                    {errors.imageUrl}
                  </span>
                )}
                <p className="mt-2 text-[11px] text-ink-400">
                  Click or drag a photo to open the interactive 3:2 cropper.
                </p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Title (Locale EN / BN) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-700">
                      Title (English) <span className="text-ink-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      value={form.titleEn}
                      onChange={(e) => setForm((prev) => ({ ...prev, titleEn: e.target.value }))}
                      className={INPUT_BASE}
                      placeholder="e.g. Annual Sports Day 2026"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-700">
                      শিরোনাম (বাংলা) <span className="text-ink-400 font-normal">(ঐচ্ছিক)</span>
                    </label>
                    <input
                      value={form.titleBn}
                      onChange={(e) => setForm((prev) => ({ ...prev, titleBn: e.target.value }))}
                      className={INPUT_BASE}
                      placeholder="যেমনঃ বার্ষিক ক্রীড়া প্রতিযোগিতা ২০২৬"
                      dir="auto"
                    />
                  </div>
                </div>

                {/* Subtitle / Description (Locale EN / BN) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-700">
                      Subtitle / Caption (English){" "}
                      <span className="text-ink-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      value={form.subtitleEn}
                      onChange={(e) => setForm((prev) => ({ ...prev, subtitleEn: e.target.value }))}
                      className={INPUT_BASE}
                      placeholder="Short description or event milestone"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-700">
                      উপশিরোনাম (বাংলা) <span className="text-ink-400 font-normal">(ঐচ্ছিক)</span>
                    </label>
                    <input
                      value={form.subtitleBn}
                      onChange={(e) => setForm((prev) => ({ ...prev, subtitleBn: e.target.value }))}
                      className={INPUT_BASE}
                      placeholder="সংক্ষিপ্ত বিবরণ বা ক্যাপশন"
                      dir="auto"
                    />
                  </div>
                </div>

                {/* Tag / Category (Locale EN / BN) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-700">
                      Tag / Category (English){" "}
                      <span className="text-ink-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      value={form.tagEn}
                      onChange={(e) => setForm((prev) => ({ ...prev, tagEn: e.target.value }))}
                      className={INPUT_BASE}
                      placeholder="e.g. Sports, Campus, Academic, Lab"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-700">
                      ট্যাগ / ক্যাটাগরি (বাংলা){" "}
                      <span className="text-ink-400 font-normal">(ঐচ্ছিক)</span>
                    </label>
                    <input
                      value={form.tagBn}
                      onChange={(e) => setForm((prev) => ({ ...prev, tagBn: e.target.value }))}
                      className={INPUT_BASE}
                      placeholder="যেমনঃ খেলাধুলা, ক্যাম্পাস, সাংস্কৃতিক"
                      dir="auto"
                    />
                  </div>
                </div>

                {/* Sort Order & Active Toggle */}
                <div className="grid gap-4 sm:grid-cols-2 items-center">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-700">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min={MIN_SORT_ORDER}
                      value={form.sortOrder}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value, 10) || 1 }))
                      }
                      className={INPUT_BASE}
                    />
                  </div>

                  <div className="pt-5">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="h-4 w-4 cursor-pointer rounded-xs border-ink-300 text-brand-600 focus:ring-0"
                      />
                      <span className="text-xs font-medium text-ink-800">
                        Show in Public Gallery (Active)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Footer Buttons (30px standard) */}
                <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex items-center rounded-xs border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiSave className="h-3.5 w-3.5" />}
                    {form.id ? "Update Photo" : "Save Photo"}
                  </button>
                </div>
              </div>
            </div>
          </DashCard>
        </div>
      )}

      {/* Gallery Table */}
      <DataTable columns={columns} data={items} emptyMessage="No gallery photos yet." />
    </section>
  );
}
