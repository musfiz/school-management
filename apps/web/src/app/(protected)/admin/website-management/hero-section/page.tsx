"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { toast } from "@/lib/swal";
import type { HeroSectionSettings } from "@/lib/hero-section";

const EMPTY: HeroSectionSettings = {
  isVisible: true,
  admissionYear: "",
  tagline1: "",
  tagline1Bn: "",
  tagline2: "",
  tagline2Bn: "",
  tagline3: "",
  tagline3Bn: "",
  shortDescription: "",
  shortDescriptionBn: "",
  showApplyButton: true,
  instituteOpenInfo: "",
  instituteOpenInfoBn: "",
  phone: "",
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-ink-700">
        <span>{label}</span>
        {hint && <span className="text-xs font-normal text-ink-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400";

function BilingualCard({
  title,
  enLabel,
  bnLabel,
  enValue,
  bnValue,
  onEnChange,
  onBnChange,
  textarea = false,
  maxLength,
  placeholderEn,
  placeholderBn,
}: {
  title: string;
  enLabel: string;
  bnLabel: string;
  enValue: string;
  bnValue: string;
  onEnChange: (value: string) => void;
  onBnChange: (value: string) => void;
  textarea?: boolean;
  maxLength?: number;
  placeholderEn?: string;
  placeholderBn?: string;
}) {
  return (
    <DashCard title={title}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={enLabel}
          hint={maxLength ? `${enValue.length}/${maxLength}` : undefined}
        >
          {textarea ? (
            <textarea
              value={enValue}
              onChange={(e) => onEnChange(e.target.value)}
              rows={4}
              maxLength={maxLength}
              placeholder={placeholderEn}
              className={inputClass}
            />
          ) : (
            <input
              value={enValue}
              onChange={(e) => onEnChange(e.target.value)}
              maxLength={maxLength}
              placeholder={placeholderEn}
              className={inputClass}
            />
          )}
        </Field>
        <Field
          label={bnLabel}
          hint={maxLength ? `${bnValue.length}/${maxLength}` : undefined}
        >
          {textarea ? (
            <textarea
              value={bnValue}
              onChange={(e) => onBnChange(e.target.value)}
              rows={4}
              maxLength={maxLength}
              placeholder={placeholderBn}
              className={inputClass}
            />
          ) : (
            <input
              value={bnValue}
              onChange={(e) => onBnChange(e.target.value)}
              maxLength={maxLength}
              placeholder={placeholderBn}
              className={inputClass}
            />
          )}
        </Field>
      </div>
    </DashCard>
  );
}

export default function HeroSectionSettingsPage() {
  const [form, setForm] = useState<HeroSectionSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/hero-section")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load hero section settings");
        const data = await res.json();
        if (data) {
          setForm({
            isVisible: data.isVisible ?? true,
            admissionYear: data.admissionYear ?? "",
            tagline1: data.tagline1 ?? "",
            tagline1Bn: data.tagline1Bn ?? "",
            tagline2: data.tagline2 ?? "",
            tagline2Bn: data.tagline2Bn ?? "",
            tagline3: data.tagline3 ?? "",
            tagline3Bn: data.tagline3Bn ?? "",
            shortDescription: data.shortDescription ?? "",
            shortDescriptionBn: data.shortDescriptionBn ?? "",
            showApplyButton: data.showApplyButton ?? true,
            instituteOpenInfo: data.instituteOpenInfo ?? "",
            instituteOpenInfoBn: data.instituteOpenInfoBn ?? "",
            phone: data.phone ?? "",
          });
        }
      })
      .catch((err) => toast(err instanceof Error ? err.message : "Failed to load hero section settings", "error"))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof HeroSectionSettings>(key: K, value: HeroSectionSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/hero-section", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const detail = Array.isArray(err?.message) ? err.message.join(" ") : err?.message;
        throw new Error(detail || "Failed to save hero section settings");
      }
      toast("Hero section settings saved successfully.");
    } catch (err: any) {
      toast(err instanceof Error ? err.message : "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminPageLoader message="Loading Hero Section settings..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Hero Section Management</h1>
          <p className="text-sm text-ink-500">
            Control the visibility, taglines, admission badge, description, and call-to-actions on the home page hero section.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 self-start rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-navy-900 disabled:opacity-50 sm:self-auto"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Visibility & Toggle Controls */}
        <DashCard title="Visibility & Options">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Show/Hide Hero Section */}
            <div className="flex items-center justify-between rounded-lg border border-ink-200 p-4 bg-white">
              <div>
                <p className="text-sm font-semibold text-ink-900">Show Hero Section</p>
                <p className="text-xs text-ink-500">
                  Switch on or off to display or hide the entire hero section on the home page.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.isVisible}
                  onChange={(e) => update("isVisible", e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-ink-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-navy-800 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              </label>
            </div>

            {/* Show/Hide Apply Button */}
            <div className="flex items-center justify-between rounded-lg border border-ink-200 p-4 bg-white">
              <div>
                <p className="text-sm font-semibold text-ink-900">Show &ldquo;Apply For Admission&rdquo; Button</p>
                <p className="text-xs text-ink-500">
                  Toggle whether the direct apply button appears in the hero section.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.showApplyButton}
                  onChange={(e) => update("showApplyButton", e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-ink-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-navy-800 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              </label>
            </div>
          </div>
        </DashCard>

        {/* Admission Info */}
        <DashCard title="Admission & Contact Info">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Admission Open Year / Session" hint="e.g. 2026–2027 or 2026">
              <input
                type="text"
                value={form.admissionYear}
                onChange={(e) => update("admissionYear", e.target.value)}
                placeholder="2026–2027"
                className={inputClass}
              />
            </Field>

            <Field label="Hero Contact / Mobile Number" hint="e.g. +880 1700-000000">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+880 1700-000000"
                className={inputClass}
              />
            </Field>
          </div>
        </DashCard>

        {/* 3 Taglines */}
        <BilingualCard
          title="Tagline 1"
          enLabel="Tagline 1 (English)"
          bnLabel="Tagline 1 (Bangla)"
          enValue={form.tagline1}
          bnValue={form.tagline1Bn}
          onEnChange={(v) => update("tagline1", v)}
          onBnChange={(v) => update("tagline1Bn", v)}
          placeholderEn="Building Tomorrow’s Leaders"
          placeholderBn="ভবিষ্যতের নেতৃত্ব গড়ে তোলা"
        />

        <BilingualCard
          title="Tagline 2"
          enLabel="Tagline 2 (English)"
          bnLabel="Tagline 2 (Bangla)"
          enValue={form.tagline2}
          bnValue={form.tagline2Bn}
          onEnChange={(v) => update("tagline2", v)}
          onBnChange={(v) => update("tagline2Bn", v)}
          placeholderEn="Inspiring Excellence in Every Student"
          placeholderBn="প্রতিটি শিক্ষার্থীর শ্রেষ্ঠত্ব বিকাশ"
        />

        <BilingualCard
          title="Tagline 3"
          enLabel="Tagline 3 (English)"
          bnLabel="Tagline 3 (Bangla)"
          enValue={form.tagline3}
          bnValue={form.tagline3Bn}
          onEnChange={(v) => update("tagline3", v)}
          onBnChange={(v) => update("tagline3Bn", v)}
          placeholderEn="Through Knowledge & Values"
          placeholderBn="জ্ঞান ও মূল্যবোধের আলোয়"
        />

        {/* Short Description (Max 1000 chars) */}
        <BilingualCard
          title="Hero Short Description (Max 1000 characters)"
          enLabel="Short Description (English)"
          bnLabel="Short Description (Bangla)"
          enValue={form.shortDescription}
          bnValue={form.shortDescriptionBn}
          onEnChange={(v) => update("shortDescription", v)}
          onBnChange={(v) => update("shortDescriptionBn", v)}
          textarea
          maxLength={1000}
          placeholderEn="A concise summary of the institution’s mission, values and academic journey..."
          placeholderBn="প্রতিষ্ঠানের লক্ষ্য, মূল্যবোধ ও শিক্ষা কার্যক্রমের সংক্ষিপ্ত বিবরণ..."
        />

        {/* Institute Open Info */}
        <BilingualCard
          title="Institute Open Information"
          enLabel="Open Info (English)"
          bnLabel="Open Info (Bangla)"
          enValue={form.instituteOpenInfo}
          bnValue={form.instituteOpenInfoBn}
          onEnChange={(v) => update("instituteOpenInfo", v)}
          onBnChange={(v) => update("instituteOpenInfoBn", v)}
          placeholderEn="Open house: Sep 19 · 10am"
          placeholderBn="খোলা থাকার সময়: রবি - বৃহস্পতি ৯টা - ৪টা"
        />

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-navy-800 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-900 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
