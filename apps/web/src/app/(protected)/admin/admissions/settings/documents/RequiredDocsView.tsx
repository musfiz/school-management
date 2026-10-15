"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import { apiFetch } from "@/lib/api";
import { confirmDialog, toast } from "@/lib/swal";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const MODAL_BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const MODAL_BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

interface RequiredDocumentRule {
  id: string;
  classOrDeptId: string;
  documentType: string;
  isOriginalRequired: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Option {
  value: string;
  label: string;
}

/** Canonical document type labels (mirrors the API's STUDENT_DOCUMENT_TYPES). */
const DOC_LABELS: Record<string, string> = {
  BIRTH_CERT: "Birth certificate / BRN",
  PHOTO: "Passport photo",
  FATHER_NID: "Father NID",
  MOTHER_NID: "Mother NID",
  TC_COPY: "Transfer certificate (TC) copy",
  SSC_MARKSHEET: "SSC / Dakhil marksheet",
  HSC_MARKSHEET: "HSC / Alim marksheet",
  TESTIMONIAL: "Testimonial",
  MIGRATION_CERT: "Migration certificate",
  ORPHAN_CERT: "Orphan / Lillah certificate",
};

function docLabel(type: string): string {
  return DOC_LABELS[type] ?? type;
}

/**
 * Plan §2 settings — per-class required-document checklist.
 * Add rules (class/dept + document type + original-required) that the
 * Documents & Verification page enforces at admission time.
 */
export default function RequiredDocsView() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<RequiredDocumentRule[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [docTypes, setDocTypes] = useState<Option[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formClassOrDept, setFormClassOrDept] = useState("");
  const [formDocumentType, setFormDocumentType] = useState("");
  const [formIsOriginal, setFormIsOriginal] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, typesRes, filterRes] = await Promise.all([
        apiFetch<RequiredDocumentRule[]>("/api/admissions/required-document-rules"),
        apiFetch<string[]>("/api/admissions/documents/types"),
        apiFetch<{ classes: Option[] }>("/api/admissions/filter-options"),
      ]);
      setRules(rulesRes);
      setDocTypes((typesRes ?? []).map((t) => ({ value: t, label: docLabel(t) })));
      setClasses(filterRes?.classes ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load required-document rules", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function classLabel(id: string): string {
    return classes.find((c) => c.value === id)?.label ?? id;
  }

  function openModal() {
    setFormClassOrDept("");
    setFormDocumentType("");
    setFormIsOriginal(true);
    setModalOpen(true);
  }

  async function submit() {
    if (!formClassOrDept || !formDocumentType) {
      toast("Select a class and a document type first", "warning");
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch<RequiredDocumentRule>("/api/admissions/required-document-rules", {
        method: "POST",
        body: JSON.stringify({
          classOrDeptId: formClassOrDept,
          documentType: formDocumentType,
          isOriginalRequired: formIsOriginal,
        }),
      });
      toast("Required-document rule added", "success");
      setModalOpen(false);
      setRules((prev) => {
        const next = prev.filter((r) => !(r.classOrDeptId === created.classOrDeptId && r.documentType === created.documentType));
        return [...next, created].sort(
          (a, b) => a.classOrDeptId.localeCompare(b.classOrDeptId) || a.documentType.localeCompare(b.documentType),
        );
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add rule", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule: RequiredDocumentRule) {
    setActing(rule.id);
    try {
      const updated = await apiFetch<RequiredDocumentRule>(`/api/admissions/required-document-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: updated.isActive } : r)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function removeRule(rule: RequiredDocumentRule) {
    const confirmed = await confirmDialog({
      title: `Delete required document`,
      text: `Remove “${docLabel(rule.documentType)}” from ${classLabel(rule.classOrDeptId)}? This cannot be undone.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setActing(rule.id);
    try {
      await apiFetch(`/api/admissions/required-document-rules/${rule.id}`, { method: "DELETE" });
      toast("Required-document rule deleted", "success");
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Required Documents"
        description="Per-class required-document checklist enforced at admission time"
      />

      <DashCard
        title={`Required document rules (${rules.length})`}
        action={
          <button type="button" className={BTN} disabled={loading} onClick={openModal}>
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add rule
            </span>
          </button>
        }
      >
        {loading ? (
          <AdminPageLoader variant="inline" />
        ) : rules.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">
            No required-document rules yet — click <span className="font-semibold">Add rule</span> to
            define what each class must submit (e.g. Class 11 needs the SSC marksheet original).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Class / Dept</th>
                  <th className="px-2.5 py-1.5 font-semibold">Document type</th>
                  <th className="px-2.5 py-1.5 font-semibold">Original</th>
                  <th className="px-2.5 py-1.5 font-semibold">Status</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1 font-mono">{classLabel(r.classOrDeptId)}</td>
                    <td className="px-2.5 py-1">{docLabel(r.documentType)}</td>
                    <td className="px-2.5 py-1">
                      <span
                        className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                          r.isOriginalRequired ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {r.isOriginalRequired ? "ORIGINAL" : "COPY OK"}
                      </span>
                    </td>
                    <td className="px-2.5 py-1">
                      <span
                        className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                          r.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {r.isActive ? "ACTIVE" : "OFF"}
                      </span>
                    </td>
                    <td className="px-2.5 py-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={BTN_GHOST}
                          disabled={acting !== null}
                          onClick={() => toggleActive(r)}
                        >
                          {acting === r.id ? "…" : r.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className={BTN_GHOST}
                          disabled={acting !== null}
                          onClick={() => removeRule(r)}
                          title="Delete rule"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xs bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-ink-900">Add required document</h3>
              <button
                type="button"
                className="rounded-xs border border-ink-200 bg-white p-1 text-ink-500 transition-colors hover:bg-ink-50"
                onClick={() => !saving && setModalOpen(false)}
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Pick the class or department and the document it must submit. Rules drive the
              Documents &amp; Verification checklist at admission.
            </p>

            <div className="mt-4 space-y-3">
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Class / Department</label>
                {classes.length > 0 ? (
                  <SearchSelect
                    options={classes}
                    value={formClassOrDept}
                    onChange={setFormClassOrDept}
                    placeholder="Select class / dept"
                    isClearable
                    ariaLabel="Class or department"
                  />
                ) : (
                  <input
                    className={INPUT}
                    value={formClassOrDept}
                    onChange={(e) => setFormClassOrDept(e.target.value)}
                    placeholder="e.g. Class 11 / SCIENCE"
                  />
                )}
              </div>

              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Document type</label>
                <SearchSelect
                  options={docTypes}
                  value={formDocumentType}
                  onChange={setFormDocumentType}
                  placeholder="Select document type"
                  isClearable
                  ariaLabel="Document type"
                />
              </div>

              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-700">
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={formIsOriginal}
                  onChange={(e) => setFormIsOriginal(e.target.checked)}
                />
                Original document must be submitted (otherwise a copy is accepted)
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={MODAL_BTN_GHOST}
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={MODAL_BTN}
                disabled={saving || !formClassOrDept || !formDocumentType}
                onClick={submit}
              >
                {saving ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                  </span>
                ) : (
                  "Add rule"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
