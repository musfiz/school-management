"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Save } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashPage";
import ImageUploader from "@/components/dashboard/ImageUploader";
import { toast } from "@/lib/swal";

interface PageContent {
  titleEn: string;
  titleBn: string;
  contentEn: string;
  contentBn: string;
  imageUrl: string;
}

const EMPTY: PageContent = { titleEn: "", titleBn: "", contentEn: "", contentBn: "", imageUrl: "" };

const inputClass =
  "w-full rounded-md border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400";

/**
 * Reusable bilingual page editor (title + content + image) backed by
 * `/pages/:slug`. Used for one-off CMS pages like About Us and History —
 * `publicPath` is the live URL an admin can paste into the Navigation Menu.
 */
export default function PageEditor({
  slug,
  publicPath,
  heading,
}: {
  slug: string;
  publicPath: string;
  heading: string;
}) {
  const [data, setData] = useState<PageContent>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pages/${slug}`);
        if (res.status === 404) return; // Nothing saved yet — start blank.
        const json = await res.json();
        setData({
          titleEn: json.titleEn ?? "",
          titleBn: json.titleBn ?? "",
          contentEn: json.contentEn ?? "",
          contentBn: json.contentBn ?? "",
          imageUrl: json.imageUrl ?? "",
        });
      } catch {
        toast("Could not load this page.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  function patch(fields: Partial<PageContent>) {
    setData((prev) => ({ ...prev, ...fields }));
  }

  async function handleSave() {
    if (!data.titleEn.trim()) {
      toast("English title is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pages/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      setSavedAt(new Date().toLocaleTimeString());
      toast("Page saved.");
    } catch {
      toast("Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicPath);
      toast("URL copied.");
    } catch {
      toast("Could not copy the URL.", "error");
    }
  }

  if (loading) {
    return (
      <section className="p-6">
        <p className="text-sm text-ink-500">Loading…</p>
      </section>
    );
  }

  return (
    <section className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{heading}</h1>
          <p className="mt-1 text-sm text-ink-500">
            Bilingual title, content and a banner image for this page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs text-ink-500">Saved at {savedAt}</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand-700"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {/* Public URL — paste this into the Navigation Menu builder's href field. */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-ink-300 bg-ink-50 px-3 py-2 text-sm">
        <span className="font-medium text-ink-600">Public URL:</span>
        <code className="rounded bg-white px-2 py-0.5 text-ink-800">{publicPath}</code>
        <button
          type="button"
          onClick={copyUrl}
          className="flex items-center gap-1 rounded p-1 text-ink-500 hover:bg-ink-100"
          aria-label="Copy URL"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <a
          href={publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded p-1 text-brand-600 hover:bg-ink-100"
          aria-label="View live page"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashCard title="Image">
          <ImageUploader
            value={data.imageUrl}
            onChange={(url) => patch({ imageUrl: url })}
            emptyLabel="No image uploaded"
          />
        </DashCard>

        <DashCard title="English">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">Title</span>
              <input
                value={data.titleEn}
                onChange={(e) => patch({ titleEn: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">Content</span>
              <textarea
                value={data.contentEn}
                onChange={(e) => patch({ contentEn: e.target.value })}
                rows={8}
                className={inputClass}
              />
            </label>
          </div>
        </DashCard>

        <DashCard title="বাংলা (Bangla)" className="lg:col-start-2">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">শিরোনাম (Title)</span>
              <input
                value={data.titleBn}
                onChange={(e) => patch({ titleBn: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">বিষয়বস্তু (Content)</span>
              <textarea
                value={data.contentBn}
                onChange={(e) => patch({ contentBn: e.target.value })}
                rows={8}
                className={inputClass}
              />
            </label>
          </div>
        </DashCard>
      </div>
    </section>
  );
}
