"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashPage";
import ImageUploader from "@/components/dashboard/ImageUploader";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { toast } from "@/lib/swal";
import type { HeaderDisplayMode, SiteSettings } from "@/lib/site-settings";

const EMPTY: SiteSettings = {
  siteName: "",
  siteNameBn: "",
  tagline: "",
  taglineBn: "",
  description: "",
  descriptionBn: "",
  logoUrl: "",
  headerDisplay: "both",
  phone: "",
  email: "",
  address: "",
  addressBn: "",
  established: undefined,
  eiin: "",
  facebookUrl: "",
  twitterUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",
  copyrightText: "",
  copyrightTextBn: "",
};

const headerDisplayOptions: { value: HeaderDisplayMode; label: string; hint: string }[] = [
  { value: "logo", label: "Logo only", hint: "Just the school logo" },
  { value: "info", label: "Info only", hint: "Name, tagline & address text" },
  { value: "both", label: "Logo + Info", hint: "Logo alongside the text block" },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400";

/** One card per translatable field — English and Bangla side by side. */
function BilingualCard({
  title,
  enLabel,
  bnLabel,
  enValue,
  bnValue,
  onEnChange,
  onBnChange,
  textarea = false,
  placeholder,
}: {
  title: string;
  enLabel: string;
  bnLabel: string;
  enValue: string;
  bnValue: string;
  onEnChange: (value: string) => void;
  onBnChange: (value: string) => void;
  textarea?: boolean;
  placeholder?: string;
}) {
  return (
    <DashCard title={title}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={enLabel}>
          {textarea ? (
            <textarea
              value={enValue}
              onChange={(e) => onEnChange(e.target.value)}
              rows={3}
              placeholder={placeholder}
              className={inputClass}
            />
          ) : (
            <input
              value={enValue}
              onChange={(e) => onEnChange(e.target.value)}
              placeholder={placeholder}
              className={inputClass}
            />
          )}
        </Field>
        <Field label={bnLabel}>
          {textarea ? (
            <textarea
              value={bnValue}
              onChange={(e) => onBnChange(e.target.value)}
              rows={3}
              className={inputClass}
            />
          ) : (
            <input
              value={bnValue}
              onChange={(e) => onBnChange(e.target.value)}
              className={inputClass}
            />
          )}
        </Field>
      </div>
    </DashCard>
  );
}

/** Picks only the fields the API's DTO accepts — the GET response also
 *  carries id/created_at/updated_at, which must not be echoed back on save. */
function toSettings(json: Partial<SiteSettings>): SiteSettings {
  return {
    siteName: json.siteName ?? "",
    siteNameBn: json.siteNameBn ?? "",
    tagline: json.tagline ?? "",
    taglineBn: json.taglineBn ?? "",
    description: json.description ?? "",
    descriptionBn: json.descriptionBn ?? "",
    logoUrl: json.logoUrl ?? "",
    headerDisplay: json.headerDisplay ?? "both",
    phone: json.phone ?? "",
    email: json.email ?? "",
    address: json.address ?? "",
    addressBn: json.addressBn ?? "",
    established: json.established ?? undefined,
    eiin: json.eiin ?? "",
    facebookUrl: json.facebookUrl ?? "",
    twitterUrl: json.twitterUrl ?? "",
    linkedinUrl: json.linkedinUrl ?? "",
    youtubeUrl: json.youtubeUrl ?? "",
    copyrightText: json.copyrightText ?? "",
    copyrightTextBn: json.copyrightTextBn ?? "",
  };
}

export default function SiteSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/site-settings");
        const data = (await res.json()) as SiteSettings;
        setSettings(toSettings(data));
      } catch {
        toast("Could not load site settings.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function patch(fields: Partial<SiteSettings>) {
    setSettings((prev) => ({ ...prev, ...fields }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSettings(settings)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
        throw new Error(detail || "Save failed.");
      }
      const data = (await res.json()) as SiteSettings;
      setSettings(toSettings(data));
      setSavedAt(new Date().toLocaleTimeString());
      toast("Site settings saved.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="p-6">
        <AdminPageLoader />
      </section>
    );
  }

  return (
    <section className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Site Settings</h1>
          <p className="mt-1 text-sm text-ink-500">
            Controls the public site&apos;s header (logo/info) and footer content.
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

      <div className="space-y-6">
        <BilingualCard
          title="Site Name"
          enLabel="Site name (English)"
          bnLabel="সাইটের নাম (বাংলা)"
          enValue={settings.siteName}
          bnValue={settings.siteNameBn}
          onEnChange={(v) => patch({ siteName: v })}
          onBnChange={(v) => patch({ siteNameBn: v })}
        />

        <BilingualCard
          title="Tagline"
          enLabel="Tagline (English)"
          bnLabel="ট্যাগলাইন (বাংলা)"
          enValue={settings.tagline}
          bnValue={settings.taglineBn}
          onEnChange={(v) => patch({ tagline: v })}
          onBnChange={(v) => patch({ taglineBn: v })}
        />

        <BilingualCard
          title="Description"
          enLabel="Description (English)"
          bnLabel="বিবরণ (বাংলা)"
          enValue={settings.description}
          bnValue={settings.descriptionBn}
          onEnChange={(v) => patch({ description: v })}
          onBnChange={(v) => patch({ descriptionBn: v })}
          textarea
        />

        <DashCard title="Address & Contact">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address (English)">
                <input
                  value={settings.address}
                  onChange={(e) => patch({ address: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="ঠিকানা (বাংলা)">
                <input
                  value={settings.addressBn}
                  onChange={(e) => patch({ addressBn: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input
                  value={settings.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <input
                  value={settings.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </DashCard>

        <BilingualCard
          title="Copyright Text"
          enLabel="Copyright (English)"
          bnLabel="স্বত্বাধিকার (বাংলা)"
          enValue={settings.copyrightText}
          bnValue={settings.copyrightTextBn}
          onEnChange={(v) => patch({ copyrightText: v })}
          onBnChange={(v) => patch({ copyrightTextBn: v })}
          placeholder="© 2026 Model High School. All rights reserved."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <DashCard title="Header">
            <div className="space-y-4">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink-700">
                  What shows in the header
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {headerDisplayOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch({ headerDisplay: opt.value })}
                      className={`rounded-md border px-2 py-2 text-left text-xs transition-colors ${
                        settings.headerDisplay === opt.value
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-ink-200 text-ink-600 hover:bg-ink-50"
                      }`}
                    >
                      <span className="block font-semibold">{opt.label}</span>
                      <span className="text-[11px] text-ink-500">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Logo">
                <ImageUploader
                  value={settings.logoUrl}
                  onChange={(url) => patch({ logoUrl: url })}
                  emptyLabel="No logo uploaded"
                  previewClassName="h-40 w-full"
                />
                <input
                  value={settings.logoUrl}
                  onChange={(e) => patch({ logoUrl: e.target.value })}
                  placeholder="/logo.png"
                  className={`${inputClass} mt-2`}
                />
                <span className="mt-1 block text-xs text-ink-400">
                  Upload an image, or paste a path under /public (e.g. /logo.png) or a
                  fully-qualified URL.
                </span>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Established year">
                  <input
                    type="number"
                    value={settings.established ?? ""}
                    onChange={(e) =>
                      patch({ established: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="EIIN">
                  <input
                    value={settings.eiin ?? ""}
                    onChange={(e) => patch({ eiin: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </DashCard>

          <DashCard title="Social Links">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Facebook URL">
                <input
                  value={settings.facebookUrl}
                  onChange={(e) => patch({ facebookUrl: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="X (Twitter) URL">
                <input
                  value={settings.twitterUrl}
                  onChange={(e) => patch({ twitterUrl: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="LinkedIn URL">
                <input
                  value={settings.linkedinUrl}
                  onChange={(e) => patch({ linkedinUrl: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="YouTube URL">
                <input
                  value={settings.youtubeUrl}
                  onChange={(e) => patch({ youtubeUrl: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
          </DashCard>
        </div>
      </div>
    </section>
  );
}
