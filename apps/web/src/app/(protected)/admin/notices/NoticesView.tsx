"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Eye,
  EyeOff,
  Pin,
  FileText,
  Calendar,
  Search,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/dashboard/DataTable";
import { DashCard } from "@/components/dashboard/DashPage";
import ImageUploader from "@/components/dashboard/ImageUploader";
import PdfUploader from "@/components/dashboard/PdfUploader";
import RichTextEditor from "@/components/dashboard/RichTextEditor";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { confirmDialog, toast } from "@/lib/swal";
import {
  NOTICE_CATEGORIES,
  type NoticeCategory,
  type NoticeItem,
} from "@/lib/notices";
import { resolveImageUrl } from "@/lib/media";

interface FormState {
  id: number | null;
  title: string;
  titleBn: string;
  category: string;
  shortDescription: string;
  shortDescriptionBn: string;
  description: string;
  descriptionBn: string;
  imageUrl: string;
  pdfUrl: string;
  isPinned: boolean;
  isActive: boolean;
  publishDate: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  titleBn: "",
  category: "General",
  shortDescription: "",
  shortDescriptionBn: "",
  description: "",
  descriptionBn: "",
  imageUrl: "",
  pdfUrl: "",
  isPinned: false,
  isActive: true,
  publishDate: new Date().toISOString().split("T")[0],
};

const INPUT_BASE =
  "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400";

export default function NoticesView() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notices");
      const data = (await res.json()) as NoticeItem[];
      setNotices(Array.isArray(data) ? data : []);
    } catch {
      toast("Could not load the notice list.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function patchForm(fields: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...fields }));
    const updatedKeys = Object.keys(fields);
    setErrors((prev) => {
      const next = { ...prev };
      updatedKeys.forEach((key) => delete next[key]);
      return next;
    });
  }

  function openAddForm() {
    setForm({
      ...EMPTY_FORM,
      publishDate: new Date().toISOString().split("T")[0],
    });
    setErrors({});
    setFormOpen(true);
  }

  function openEditForm(notice: NoticeItem) {
    setForm({
      id: notice.id,
      title: notice.title || "",
      titleBn: notice.titleBn || "",
      category: notice.category || "General",
      shortDescription: notice.shortDescription || "",
      shortDescriptionBn: notice.shortDescriptionBn || "",
      description: notice.description || "",
      descriptionBn: notice.descriptionBn || "",
      imageUrl: notice.imageUrl || "",
      pdfUrl: notice.pdfUrl || "",
      isPinned: notice.isPinned ?? false,
      isActive: notice.isActive ?? true,
      publishDate:
        notice.publishDate ||
        (notice.createdAt ? notice.createdAt.split("T")[0] : ""),
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
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) {
      newErrors.title = "Notice title is required.";
    }
    if (!form.publishDate) {
      newErrors.publishDate = "Publish date is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        titleBn: form.titleBn.trim() || undefined,
        category: form.category,
        shortDescription: form.shortDescription.trim() || undefined,
        shortDescriptionBn: form.shortDescriptionBn.trim() || undefined,
        description: form.description || undefined,
        descriptionBn: form.descriptionBn || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        pdfUrl: form.pdfUrl.trim() || undefined,
        isPinned: form.isPinned,
        isActive: form.isActive,
        publishDate: form.publishDate,
      };

      const res = await fetch(
        form.id ? `/api/notices/${form.id}` : "/api/notices",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = Array.isArray(body?.message)
          ? body.message.join(" ")
          : body?.message;
        throw new Error(detail || "Save failed.");
      }

      toast({
        title: "Success",
        text: form.id
          ? "Notice updated successfully."
          : "Notice published successfully.",
        icon: "success",
      });
      closeForm();
      await load();
    } catch (err) {
      toast({
        title: "Error",
        text:
          err instanceof Error
            ? err.message
            : "Save failed. Please try again.",
        icon: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(notice: NoticeItem) {
    try {
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !notice.isActive }),
      });
      if (!res.ok) throw new Error();
      toast(
        notice.isActive
          ? "Notice hidden from website."
          : "Notice is now visible on website.",
      );
      await load();
    } catch {
      toast("Could not update notice status.", "error");
    }
  }

  async function togglePinned(notice: NoticeItem) {
    try {
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !notice.isPinned }),
      });
      if (!res.ok) throw new Error();
      toast(
        notice.isPinned
          ? "Notice unpinned from top."
          : "Notice pinned to top of list.",
      );
      await load();
    } catch {
      toast("Could not update pin status.", "error");
    }
  }

  async function handleDelete(notice: NoticeItem) {
    const confirmed = await confirmDialog({
      title: "Delete this notice?",
      text: `"${notice.title}" will be permanently removed.`,
      confirmText: "Yes, delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast({
        title: "Deleted",
        text: "Notice removed successfully.",
        icon: "success",
      });
      if (form.id === notice.id) closeForm();
      await load();
    } catch {
      toast("Could not delete this notice.", "error");
    }
  }

  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      const matchesCategory =
        selectedCategory === "ALL" || n.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.titleBn && n.titleBn.includes(searchQuery)) ||
        (n.shortDescription &&
          n.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [notices, selectedCategory, searchQuery]);

  const columns = useMemo<ColumnDef<NoticeItem, any>[]>(
    () => [
      {
        header: "Notice Title",
        accessorKey: "title",
        cell: ({ row }) => {
          const n = row.original;
          return (
            <div className="max-w-md">
              <div className="flex items-center gap-2">
                {n.isPinned && (
                  <span
                    className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-300"
                    title="Pinned Notice"
                  >
                    <Pin className="h-3 w-3 fill-amber-500 text-amber-600" />
                    Pinned
                  </span>
                )}
                <span className="font-semibold text-ink-900">{n.title}</span>
              </div>
              {n.titleBn && (
                <p className="mt-0.5 text-xs text-ink-500" dir="auto">
                  {n.titleBn}
                </p>
              )}
              {n.shortDescription && (
                <p className="mt-1 line-clamp-1 text-xs text-ink-600">
                  {n.shortDescription}
                </p>
              )}
            </div>
          );
        },
      },
      {
        header: "Category",
        accessorKey: "category",
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-sm bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-800">
            {row.original.category || "General"}
          </span>
        ),
      },
      {
        header: "Publish Date",
        accessorKey: "publishDate",
        cell: ({ row }) => {
          const d = row.original.publishDate;
          return (
            <div className="flex items-center gap-1.5 text-xs text-ink-600">
              <Calendar className="h-3.5 w-3.5 text-ink-400" />
              <span>
                {d
                  ? new Date(d).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
          );
        },
      },
      {
        header: "Attachments",
        id: "attachments",
        cell: ({ row }) => {
          const n = row.original;
          return (
            <div className="flex items-center gap-1.5">
              {n.pdfUrl ? (
                <a
                  href={resolveImageUrl(n.pdfUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                  title="View PDF Document"
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </a>
              ) : null}
              {n.imageUrl ? (
                <span className="rounded bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
                  Image
                </span>
              ) : null}
              {!n.pdfUrl && !n.imageUrl && (
                <span className="text-xs text-ink-400">None</span>
              )}
            </div>
          );
        },
      },
      {
        header: "Status",
        accessorKey: "isActive",
        cell: ({ row }) => {
          const n = row.original;
          return n.isActive ? (
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
        cell: ({ row }) => {
          const n = row.original;
          return (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => togglePinned(n)}
                className={`rounded p-1.5 hover:bg-amber-50 ${
                  n.isPinned ? "text-amber-600" : "text-ink-400"
                }`}
                title={n.isPinned ? "Unpin notice" : "Pin notice"}
              >
                <Pin
                  className={`h-4 w-4 ${n.isPinned ? "fill-amber-500" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => toggleActive(n)}
                className={`rounded p-1.5 hover:bg-ink-50 ${
                  n.isActive ? "text-emerald-600" : "text-ink-400"
                }`}
                title={n.isActive ? "Hide from website" : "Show on website"}
              >
                {n.isActive ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => openEditForm(n)}
                className="rounded p-1.5 text-brand-600 hover:bg-brand-50"
                title="Edit notice"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(n)}
                className="rounded p-1.5 text-red-600 hover:bg-red-50"
                title="Delete notice"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <section className="p-4">
      {/* Top Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Notice Management</h1>
          <p className="text-xs text-ink-500">
            Publish official announcements, academic circulars and notices
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Notice
          </button>
        )}
      </div>

      {/* Notice Form (Create / Edit) */}
      {formOpen && (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy-900">
              {form.id ? "Edit Notice" : "Create New Notice"}
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
            <div className="space-y-6">
              {/* Row 1: Title and Category */}
              <div className="grid gap-4 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-ink-700">
                      Notice Title (English) <span className="text-red-500">*</span>
                    </span>
                    <input
                      value={form.title}
                      onChange={(e) => patchForm({ title: e.target.value })}
                      className={`${INPUT_BASE} ${
                        errors.title
                          ? "border-red-500 focus:border-red-500"
                          : "border-ink-200"
                      }`}
                      placeholder="e.g. Midterm Examination Routine 2026"
                    />
                    {errors.title && (
                      <p className="mt-1 text-xs font-medium text-red-500">
                        {errors.title}
                      </p>
                    )}
                  </label>
                </div>

                <div className="sm:col-span-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-ink-700">
                      Category
                    </span>
                    <select
                      value={form.category}
                      onChange={(e) => patchForm({ category: e.target.value })}
                      className={`${INPUT_BASE} border-ink-200`}
                    >
                      {NOTICE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* Row 2: Bangla Title */}
              <div className="grid gap-4 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-ink-700">
                      বিজ্ঞপ্তির শিরোনাম (Bangla Title)
                    </span>
                    <input
                      value={form.titleBn}
                      onChange={(e) => patchForm({ titleBn: e.target.value })}
                      className={`${INPUT_BASE} border-ink-200`}
                      placeholder="যেমন: অর্ধবার্ষিক পরীক্ষার সময়সূচী ২০২৬"
                      dir="auto"
                    />
                  </label>
                </div>

                <div className="sm:col-span-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-ink-700">
                      Publish Date <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="date"
                      value={form.publishDate}
                      onChange={(e) => patchForm({ publishDate: e.target.value })}
                      className={`${INPUT_BASE} ${
                        errors.publishDate
                          ? "border-red-500 focus:border-red-500"
                          : "border-ink-200"
                      }`}
                    />
                    {errors.publishDate && (
                      <p className="mt-1 text-xs font-medium text-red-500">
                        {errors.publishDate}
                      </p>
                    )}
                  </label>
                </div>
              </div>

              {/* Row 3: Short Description */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink-700">
                    Short Summary / Subtitle (English)
                  </span>
                  <textarea
                    rows={2}
                    value={form.shortDescription}
                    onChange={(e) =>
                      patchForm({ shortDescription: e.target.value })
                    }
                    className={`${INPUT_BASE} border-ink-200`}
                    placeholder="Brief 1-2 sentence summary of notice..."
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink-700">
                    সংক্ষিপ্ত বিবরণ (Bangla Summary)
                  </span>
                  <textarea
                    rows={2}
                    value={form.shortDescriptionBn}
                    onChange={(e) =>
                      patchForm({ shortDescriptionBn: e.target.value })
                    }
                    className={`${INPUT_BASE} border-ink-200`}
                    placeholder="বিজ্ঞপ্তির সারসংক্ষেপ লিখুন..."
                    dir="auto"
                  />
                </label>
              </div>

              {/* Row 4: Rich Text Description (TipTap) */}
              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-ink-700">
                    Detailed Notice Description (TipTap Rich Text)
                  </span>
                  <RichTextEditor
                    value={form.description}
                    onChange={(html) => patchForm({ description: html })}
                  />
                </div>

                <div>
                  <span className="mb-1.5 block text-sm font-medium text-ink-700">
                    বিস্তারিত বিবরণ (বাংলা রিচ টেক্সট)
                  </span>
                  <RichTextEditor
                    value={form.descriptionBn}
                    onChange={(html) => patchForm({ descriptionBn: html })}
                  />
                </div>
              </div>

              {/* Row 5: Media & Attachment (Image + PDF) */}
              <div className="grid gap-6 rounded-lg border border-ink-100 bg-ink-50/50 p-4 lg:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-ink-700">
                    Notice Banner / Thumbnail Image
                  </span>
                  <ImageUploader
                    value={form.imageUrl}
                    onChange={(url) => patchForm({ imageUrl: url })}
                    emptyLabel="Notice Banner Image"
                    previewClassName="aspect-video w-full"
                  />
                </div>

                <div>
                  <PdfUploader
                    value={form.pdfUrl}
                    onChange={(url) => patchForm({ pdfUrl: url })}
                    label="Official Notice PDF Attachment"
                  />
                </div>
              </div>

              {/* Row 6: Toggles (Pin & Active) */}
              <div className="flex flex-wrap items-center gap-6 border-t border-ink-100 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPinned}
                    onChange={(e) => patchForm({ isPinned: e.target.checked })}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-medium text-ink-800">
                    Pin to top of Notice Board
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => patchForm({ isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-medium text-ink-800">
                    Published (Visible on website)
                  </span>
                </label>
              </div>
            </div>

            {/* Form Action Buttons */}
            <div className="mt-6 flex items-center gap-2 border-t border-ink-100 pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand-700"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {form.id ? "Save Changes" : "Publish Notice"}
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

      {/* Filter & Search Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notices..."
              className="w-64 rounded-md border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
          >
            <option value="ALL">All Categories</option>
            {NOTICE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-medium text-ink-500">
          Showing {filteredNotices.length} of {notices.length} notices
        </span>
      </div>

      {/* Notice Data Table */}
      {loading ? (
        <AdminPageLoader />
      ) : (
        <DataTable
          columns={columns}
          data={filteredNotices}
          emptyMessage="No notices found."
          footer={`Total notices: ${filteredNotices.length}`}
        />
      )}
    </section>
  );
}
