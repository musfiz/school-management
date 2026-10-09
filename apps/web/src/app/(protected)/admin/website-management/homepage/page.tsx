"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Save, X, Loader2, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/dashboard/DataTable";
import { DashCard } from "@/components/dashboard/DashPage";
import ImageUploader from "@/components/dashboard/ImageUploader";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { hasRenderer, knownSectionKeys } from "@/components/homepage/HomepageSections";
import { HOMEPAGE_ICON_TOKENS } from "@/components/homepage/icon-registry";
import { resolveImageUrl, isExternalImage } from "@/lib/media";
import { confirmDialog, toast } from "@/lib/swal";
import type { HomepageBackground, HomepageItem, HomepageItemKey, HomepageSection } from "@/lib/homepage";

interface ItemForm {
  id: number | null;
  itemKey: HomepageItemKey;
  titleEn: string;
  titleBn: string;
  subtitleEn: string;
  subtitleBn: string;
  bodyEn: string;
  bodyBn: string;
  icon: string;
  imageUrl: string;
  href: string;
  isVisible: boolean;
}

const emptyItem = (itemKey: HomepageItemKey = "card"): ItemForm => ({
  id: null,
  itemKey,
  titleEn: "",
  titleBn: "",
  subtitleEn: "",
  subtitleBn: "",
  bodyEn: "",
  bodyBn: "",
  icon: "",
  imageUrl: "",
  href: "",
  isVisible: true,
});

interface FormState {
  id: number | null;
  sectionKey: string;
  labelEn: string;
  labelBn: string;
  eyebrowEn: string;
  eyebrowBn: string;
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  imageUrl: string;
  ctaTextEn: string;
  ctaTextBn: string;
  ctaHref: string;
  background: HomepageBackground;
  sortOrder: number;
  isVisible: boolean;
  items: ItemForm[];
}

const EMPTY_FORM: FormState = {
  id: null,
  sectionKey: "",
  labelEn: "",
  labelBn: "",
  eyebrowEn: "",
  eyebrowBn: "",
  titleEn: "",
  titleBn: "",
  bodyEn: "",
  bodyBn: "",
  imageUrl: "",
  ctaTextEn: "",
  ctaTextBn: "",
  ctaHref: "",
  background: "white",
  sortOrder: 1,
  isVisible: true,
  items: [],
};

const INPUT_BASE =
  "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400";

const ITEM_KEY_OPTIONS: { value: HomepageItemKey; label: string; hint: string }[] = [
  { value: "value", label: "Value pillar", hint: "Icon + title, used in the values band" },
  { value: "bullet", label: "Bullet", hint: "Tick-list line under about copy" },
  { value: "stat", label: "Stat tile", hint: "Title = number, subtitle = label" },
  { value: "card", label: "Card", hint: "Generic card with title + body" },
  { value: "image", label: "Image", hint: "Photo tile" },
];

export default function HomepagePage() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<"sectionKey" | "labelEn", string>>>({});
  const [itemsOpen, setItemsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/homepage/sections");
      const data = (await res.json()) as HomepageSection[];
      setSections(Array.isArray(data) ? data : []);
    } catch {
      toast("Could not load homepage sections.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Items are a separate endpoint so the list view stays a light request. */
  async function loadItems(sectionId: number): Promise<ItemForm[]> {
    try {
      const res = await fetch(`/api/homepage/sections/${sectionId}/items`);
      const data = (await res.json()) as HomepageItem[];
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({
        id: item.id,
        itemKey: item.itemKey,
        titleEn: item.titleEn ?? "",
        titleBn: item.titleBn ?? "",
        subtitleEn: item.subtitleEn ?? "",
        subtitleBn: item.subtitleBn ?? "",
        bodyEn: item.bodyEn ?? "",
        bodyBn: item.bodyBn ?? "",
        icon: item.icon ?? "",
        imageUrl: item.imageUrl ?? "",
        href: item.href ?? "",
        isVisible: item.isVisible,
      }));
    } catch {
      toast("Could not load this section's items.", "error");
      return [];
    }
  }

  function nextSortOrder(): number {
    const max = sections.reduce((m, s) => Math.max(m, s.sortOrder ?? 0), 0);
    return max + 1;
  }

  function openAddForm() {
    setForm({ ...EMPTY_FORM, sortOrder: nextSortOrder(), sectionKey: knownSectionKeys()[0] ?? "" });
    setErrors({});
    setItemsOpen(false);
    setFormOpen(true);
  }

  async function openEditForm(section: HomepageSection) {
    // Fetch items before opening so the editor never paints an empty list and
    // then repopulates it (which reads as the content being lost).
    const items = await loadItems(section.id);
    setForm({
      id: section.id,
      sectionKey: section.sectionKey,
      labelEn: section.labelEn,
      labelBn: section.labelBn ?? "",
      eyebrowEn: section.eyebrowEn ?? "",
      eyebrowBn: section.eyebrowBn ?? "",
      titleEn: section.titleEn ?? "",
      titleBn: section.titleBn ?? "",
      bodyEn: section.bodyEn ?? "",
      bodyBn: section.bodyBn ?? "",
      imageUrl: section.imageUrl ?? "",
      ctaTextEn: section.ctaTextEn ?? "",
      ctaTextBn: section.ctaTextBn ?? "",
      ctaHref: section.ctaHref ?? "",
      background: section.background ?? "white",
      sortOrder: section.sortOrder,
      isVisible: section.isVisible,
      items,
    });
    setErrors({});
    setFormOpen(true);
    setItemsOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
    setItemsOpen(false);
  }

  function validate(): boolean {
    const next: typeof errors = {};
    // The key drives which component renders on the public site, so it must
    // exist and be unique — the API rejects duplicates, this catches it early.
    if (!form.sectionKey.trim()) next.sectionKey = "A section key is required.";
    else if (!/^[a-z0-9-]+$/.test(form.sectionKey.trim()))
      next.sectionKey = "Use lowercase letters, numbers and dashes only.";
    else if (sections.some((s) => s.sectionKey === form.sectionKey.trim() && s.id !== form.id))
      next.sectionKey = "Another section already uses this key.";
    if (!form.labelEn.trim()) next.labelEn = "A label is required (shown in this list).";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      // Empty strings are sent as undefined so the API's blankToNull transform
      // clears the column instead of storing "".
      const payload = {
        ...(form.id ? {} : { sectionKey: form.sectionKey.trim() }),
        labelEn: form.labelEn.trim(),
        labelBn: form.labelBn.trim() || undefined,
        eyebrowEn: form.eyebrowEn.trim() || undefined,
        eyebrowBn: form.eyebrowBn.trim() || undefined,
        titleEn: form.titleEn.trim() || undefined,
        titleBn: form.titleBn.trim() || undefined,
        bodyEn: form.bodyEn.trim() || undefined,
        bodyBn: form.bodyBn.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        ctaTextEn: form.ctaTextEn.trim() || undefined,
        ctaTextBn: form.ctaTextBn.trim() || undefined,
        ctaHref: form.ctaHref.trim() || undefined,
        background: form.background,
        sortOrder: form.sortOrder,
        isVisible: form.isVisible,
        // Omitted entirely unless the item list was opened, so saving section
        // copy can never wipe items the editor didn't load.
        ...(itemsOpen
          ? {
              items: form.items.map((item, index) => ({
                ...(item.id ? { id: item.id } : {}),
                itemKey: item.itemKey,
                titleEn: item.titleEn.trim() || undefined,
                titleBn: item.titleBn.trim() || undefined,
                subtitleEn: item.subtitleEn.trim() || undefined,
                subtitleBn: item.subtitleBn.trim() || undefined,
                bodyEn: item.bodyEn.trim() || undefined,
                bodyBn: item.bodyBn.trim() || undefined,
                icon: item.icon || undefined,
                imageUrl: item.imageUrl.trim() || undefined,
                href: item.href.trim() || undefined,
                sortOrder: index + 1,
                isVisible: item.isVisible,
              })),
            }
          : {}),
      };

      const res = await fetch(
        form.id ? `/api/homepage/sections/${form.id}` : "/api/homepage/sections",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
        throw new Error(detail || "Save failed.");
      }
      toast(form.id ? "Section updated." : "Section added.");
      closeForm();
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  /** Toggle visibility without opening the editor. */
  async function toggleVisible(section: HomepageSection) {
    try {
      const res = await fetch(`/api/homepage/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: !section.isVisible }),
      });
      if (!res.ok) throw new Error();
      toast(section.isVisible ? "Section hidden from the homepage." : "Section is now visible.");
      await load();
    } catch {
      toast("Could not update this section.", "error");
    }
  }

  /** Swap a section with its neighbour to change homepage order. */
  async function move(section: HomepageSection, direction: -1 | 1) {
    const list = [...sections];
    const index = list.findIndex((s) => s.id === section.id);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    const swapped = list[target];
    list[target] = section;
    list[index] = swapped;
    setSections(list); // optimistic; reverted by load() on failure

    try {
      const res = await Promise.all([
        fetch(`/api/homepage/sections/${section.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: swapped.sortOrder }),
        }),
        fetch(`/api/homepage/sections/${swapped.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: section.sortOrder }),
        }),
      ]);
      if (res.some((r) => !r.ok)) throw new Error();
      toast("Order updated.");
      await load();
    } catch {
      toast("Could not reorder sections.", "error");
      await load();
    }
  }

  async function handleDelete(section: HomepageSection) {
    const confirmed = await confirmDialog({
      title: "Remove this section?",
      text: `"${section.labelEn}" and all of its items will be removed from the homepage. This cannot be undone.`,
      confirmText: "Yes, remove",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/homepage/sections/${section.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Section removed.");
      if (form.id === section.id) closeForm();
      await load();
    } catch {
      toast("Could not remove this section.", "error");
    }
  }

  function addItem(itemKey: HomepageItemKey) {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem(itemKey)] }));
  }

  function updateItem(index: number, patch: Partial<ItemForm>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  const columns = useMemo<ColumnDef<HomepageSection, any>[]>(
    () => [
      {
        header: "Order",
        accessorKey: "sortOrder",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(row.original, -1)}
              className="rounded p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
              aria-label="Move up"
              title="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-sm text-ink-500">{row.original.sortOrder}</span>
            <button
              type="button"
              onClick={() => move(row.original, 1)}
              className="rounded p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
              aria-label="Move down"
              title="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        ),
      },
      {
        header: "Section key",
        accessorKey: "sectionKey",
        cell: ({ row }) => (
          <div>
            <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-navy-800">
              {row.original.sectionKey}
            </code>
            {!hasRenderer(row.original.sectionKey) && (
              <p className="mt-1 text-xs text-amber-600">
                No renderer yet — this section won&apos;t appear on the public homepage.
              </p>
            )}
          </div>
        ),
      },
      {
        header: "Label",
        accessorKey: "labelEn",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-ink-800">{row.original.labelEn}</p>
            {row.original.titleEn && (
              <p className="truncate text-xs text-ink-500">{row.original.titleEn}</p>
            )}
          </div>
        ),
      },
      {
        header: "Status",
        accessorKey: "isVisible",
        cell: ({ row }) =>
          row.original.isVisible ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <Eye className="h-3 w-3" /> Visible
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-500">
              <EyeOff className="h-3 w-3" /> Hidden
            </span>
          ),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleVisible(row.original)}
              className={`rounded p-1.5 hover:bg-ink-50 ${
                row.original.isVisible ? "text-emerald-600" : "text-ink-400"
              }`}
              aria-label={row.original.isVisible ? "Hide section" : "Show section"}
              title={row.original.isVisible ? "Hide from homepage" : "Show on homepage"}
            >
              {row.original.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
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
          <h1 className="text-xl font-bold text-ink-900">Homepage</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            Sections render top-to-bottom in the order below. Reorder, hide, and edit each one here.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add section
          </button>
        )}
      </div>

      {formOpen && (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy-900">
              {form.id ? "Edit section" : "Add section"}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Section key"
                  hint={
                    form.id
                      ? "Used to pick the public renderer — it cannot be changed after creation."
                      : `Lowercase, dashes. Drives which component renders it. Known keys: ${knownSectionKeys().join(", ")}`
                  }
                >
                  <input
                    value={form.sectionKey}
                    onChange={(e) => setForm((prev) => ({ ...prev, sectionKey: e.target.value }))}
                    disabled={!!form.id}
                    className={`${INPUT_BASE} border-ink-200 disabled:bg-ink-50 disabled:text-ink-400`}
                    placeholder="values"
                  />
                  {errors.sectionKey && (
                    <span className="mt-1 block text-xs leading-tight text-red-600">
                      {errors.sectionKey}
                    </span>
                  )}
                </Field>

                <Field label="Label (English)" hint="Only used to identify the section in this list.">
                  <input
                    value={form.labelEn}
                    onChange={(e) => setForm((prev) => ({ ...prev, labelEn: e.target.value }))}
                    className={`${INPUT_BASE} border-ink-200`}
                    placeholder="Our Values"
                  />
                  {errors.labelEn && (
                    <span className="mt-1 block text-xs leading-tight text-red-600">
                      {errors.labelEn}
                    </span>
                  )}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="লেবেল (বাংলা)">
                  <input
                    value={form.labelBn}
                    onChange={(e) => setForm((prev) => ({ ...prev, labelBn: e.target.value }))}
                    className={`${INPUT_BASE} border-ink-200`}
                    dir="auto"
                  />
                </Field>

                <Field label="Background">
                  <select
                    value={form.background}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, background: e.target.value as HomepageBackground }))
                    }
                    className={`${INPUT_BASE} border-ink-200`}
                  >
                    <option value="white">White</option>
                    <option value="muted">Light grey</option>
                    <option value="navy">Navy</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Eyebrow (English)" hint="Small gold label above the heading.">
                  <input
                    value={form.eyebrowEn}
                    onChange={(e) => setForm((prev) => ({ ...prev, eyebrowEn: e.target.value }))}
                    className={`${INPUT_BASE} border-ink-200`}
                    placeholder="What we stand for"
                  />
                </Field>
                <Field label="আইব্রো (বাংলা)">
                  <input
                    value={form.eyebrowBn}
                    onChange={(e) => setForm((prev) => ({ ...prev, eyebrowBn: e.target.value }))}
                    className={`${INPUT_BASE} border-ink-200`}
                    dir="auto"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Heading (English)">
                  <input
                    value={form.titleEn}
                    onChange={(e) => setForm((prev) => ({ ...prev, titleEn: e.target.value }))}
                    className={`${INPUT_BASE} border-ink-200`}
                    placeholder="Knowledge. Discipline. Excellence."
                  />
                </Field>
                <Field label="শিরোনাম (বাংলা)">
                  <input
                    value={form.titleBn}
                    onChange={(e) => setForm((prev) => ({ ...prev, titleBn: e.target.value }))}
                    className={`${INPUT_BASE} border-ink-200`}
                    dir="auto"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Body (English)" hint="Supports basic HTML.">
                  <textarea
                    rows={4}
                    value={form.bodyEn}
                    onChange={(e) => setForm((prev) => ({ ...prev, bodyEn: e.target.value }))}
                    className={`${INPUT_BASE} border-ink-200`}
                  />
                </Field>
                <Field label="বডি (বাংলা)" hint="Basic HTML supported.">
                  <textarea
                    rows={4}
                    value={form.bodyBn}
                    onChange={(e) => setForm((prev) => ({ ...prev, bodyBn: e.target.value }))}
                    className={`${INPUT_BASE} border-ink-200`}
                    dir="auto"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_180px]">
                <Field label="Section image" hint="Used by split sections.">
                  <ImageUploader
                    endpoint="/api/uploads/hero-slider"
                    value={form.imageUrl}
                    onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
                    emptyLabel="Drop or click to upload"
                    previewClassName="aspect-[16/9] w-full"
                  />
                </Field>

                <div className="space-y-4">
                  <Field label="Button label (English)">
                    <input
                      value={form.ctaTextEn}
                      onChange={(e) => setForm((prev) => ({ ...prev, ctaTextEn: e.target.value }))}
                      className={`${INPUT_BASE} border-ink-200`}
                      placeholder="Learn our story"
                    />
                  </Field>
                  <Field label="Button link">
                    <input
                      value={form.ctaHref}
                      onChange={(e) => setForm((prev) => ({ ...prev, ctaHref: e.target.value }))}
                      className={`${INPUT_BASE} border-ink-200`}
                      placeholder="/about/about-us"
                    />
                  </Field>
                </div>

                <div className="space-y-4">
                  <Field label="Sort order" hint="Lower appears first.">
                    <input
                      type="number"
                      min={1}
                      value={form.sortOrder}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          sortOrder: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className={`${INPUT_BASE} border-ink-200`}
                    />
                  </Field>
                  <label className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={form.isVisible}
                      onChange={(e) => setForm((prev) => ({ ...prev, isVisible: e.target.checked }))}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600"
                    />
                    <span className="text-sm font-medium text-ink-700">Visible on the site</span>
                  </label>
                </div>
              </div>

              {/* Items */}
              <div className="rounded-md border border-ink-200">
                <button
                  type="button"
                  onClick={() => setItemsOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink-800">
                      Items ({form.items.length})
                    </span>
                    <span className="block text-xs text-ink-500">
                      Pillars, bullets, stats and cards inside this section.
                    </span>
                  </span>
                  {itemsOpen ? <ChevronUp className="h-4 w-4 text-ink-400" /> : <ChevronDown className="h-4 w-4 text-ink-400" />}
                </button>

                {itemsOpen && (
                  <div className="space-y-3 border-t border-ink-200 p-4">
                    {form.items.length === 0 && (
                      <p className="text-sm text-ink-500">No items yet. Add one below.</p>
                    )}

                    {form.items.map((item, index) => (
                      <ItemRow
                        key={item.id ?? `new-${index}`}
                        item={item}
                        index={index}
                        onChange={(patch) => updateItem(index, patch)}
                        onRemove={() => removeItem(index)}
                      />
                    ))}

                    <div className="flex flex-wrap gap-2 pt-2">
                      {ITEM_KEY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => addItem(opt.value)}
                          title={opt.hint}
                          className="flex items-center gap-1 rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                        >
                          <Plus className="h-3 w-3" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
          data={sections}
          emptyMessage="No homepage sections yet. Add one to get started."
          footer={`Total sections: ${sections.length}`}
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
      {hint ? <span className="mt-1 block text-xs leading-tight text-ink-400">{hint}</span> : null}
    </label>
  );
}

/** One editable item row inside a section. */
function ItemRow({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: ItemForm;
  index: number;
  onChange: (patch: Partial<ItemForm>) => void;
  onRemove: () => void;
}) {
  const meta = ITEM_KEY_OPTIONS.find((o) => o.value === item.itemKey);

  return (
    <div className="rounded-md border border-ink-200 bg-ink-50/50 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-navy-800 px-2 py-0.5 text-xs font-bold text-white">
          {index + 1}
        </span>
        <select
          value={item.itemKey}
          onChange={(e) => onChange({ itemKey: e.target.value as HomepageItemKey })}
          className={`${INPUT_BASE} w-auto border-ink-200 text-xs`}
        >
          {ITEM_KEY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {meta && <span className="text-xs text-ink-400">{meta.hint}</span>}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-600">
          <input
            type="checkbox"
            checked={item.isVisible}
            onChange={(e) => onChange({ isVisible: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600"
          />
          Visible
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-red-600 hover:bg-red-50"
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title (English)">
          <input
            value={item.titleEn}
            onChange={(e) => onChange({ titleEn: e.target.value })}
            className={`${INPUT_BASE} border-ink-200`}
            placeholder={item.itemKey === "stat" ? "2,400+" : "Knowledge"}
          />
        </Field>
        <Field label="শিরোনাম (বাংলা)">
          <input
            value={item.titleBn}
            onChange={(e) => onChange({ titleBn: e.target.value })}
            className={`${INPUT_BASE} border-ink-200`}
            dir="auto"
          />
        </Field>

        <Field label="Subtitle (English)">
          <input
            value={item.subtitleEn}
            onChange={(e) => onChange({ subtitleEn: e.target.value })}
            className={`${INPUT_BASE} border-ink-200`}
            placeholder={item.itemKey === "stat" ? "Students" : "Optional"}
          />
        </Field>
        <Field label="সাবটাইটেল (বাংলা)">
          <input
            value={item.subtitleBn}
            onChange={(e) => onChange({ subtitleBn: e.target.value })}
            className={`${INPUT_BASE} border-ink-200`}
            dir="auto"
          />
        </Field>

        <Field label="Body (English)">
          <textarea
            rows={2}
            value={item.bodyEn}
            onChange={(e) => onChange({ bodyEn: e.target.value })}
            className={`${INPUT_BASE} border-ink-200`}
          />
        </Field>
        <Field label="বডি (বাংলা)">
          <textarea
            rows={2}
            value={item.bodyBn}
            onChange={(e) => onChange({ bodyBn: e.target.value })}
            className={`${INPUT_BASE} border-ink-200`}
            dir="auto"
          />
        </Field>

        <Field label="Icon" hint="Value and card items.">
          <select
            value={item.icon}
            onChange={(e) => onChange({ icon: e.target.value })}
            className={`${INPUT_BASE} border-ink-200 text-xs`}
          >
            <option value="">None</option>
            {HOMEPAGE_ICON_TOKENS.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Link">
          <input
            value={item.href}
            onChange={(e) => onChange({ href: e.target.value })}
            className={`${INPUT_BASE} border-ink-200`}
            placeholder="/about/about-us"
          />
        </Field>
      </div>

      {(item.itemKey === "image" || item.itemKey === "card") && (
        <div className="mt-3">
          <Field label="Item image">
            <ImageUploader
              endpoint="/api/uploads/hero-slider"
              value={item.imageUrl}
              onChange={(url) => onChange({ imageUrl: url })}
              emptyLabel="Drop or click to upload"
              previewClassName="aspect-[16/9] w-full max-w-xs"
            />
          </Field>
          {item.imageUrl && (
            <Image
              src={resolveImageUrl(item.imageUrl)}
              alt=""
              width={80}
              height={48}
              unoptimized={isExternalImage(item.imageUrl)}
              className="mt-2 h-12 w-20 rounded object-cover"
            />
          )}
        </div>
      )}

      {item.imageUrl && isExternalImage(item.imageUrl) && (
        <p className="mt-2 text-xs text-ink-400">External image — served unoptimized.</p>
      )}
    </div>
  );
}