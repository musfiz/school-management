"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiEye, FiFileText, FiLoader, FiRefreshCcw, FiSearch, FiTrash, FiUpload as Upload, FiXCircle } from "react-icons/fi";
import { RiShieldCheckLine } from "react-icons/ri";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import { apiFetch } from "@/lib/api";
import { resolveImageUrl } from "@/lib/media";
import { toast } from "@/lib/swal";
import type { DocumentSummary, StudentDocumentChecklist, StudentDocumentRow } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const MODAL_BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const PENDING_FILTER = [
  { value: "true", label: "Pending only" },
  { value: "false", label: "All students" },
];

/** Canonical checklist labels (mirrors the API's STUDENT_DOCUMENT_TYPES). */
const DOC_TYPES = [
  { value: "BIRTH_CERT", label: "Birth certificate / BRN" },
  { value: "PHOTO", label: "Passport photo" },
  { value: "FATHER_NID", label: "Father NID" },
  { value: "MOTHER_NID", label: "Mother NID" },
  { value: "TC_COPY", label: "Transfer certificate (TC) copy" },
  { value: "SSC_MARKSHEET", label: "SSC / Dakhil marksheet" },
  { value: "HSC_MARKSHEET", label: "HSC / Alim marksheet" },
  { value: "TESTIMONIAL", label: "Testimonial" },
  { value: "MIGRATION_CERT", label: "Migration certificate" },
  { value: "ORPHAN_CERT", label: "Orphan / Lillah certificate" },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  TC_ISSUED: "bg-rose-100 text-rose-700",
  GRADUATED: "bg-sky-100 text-sky-800",
  DROPPED: "bg-slate-200 text-slate-600",
  SUSPENDED: "bg-amber-100 text-amber-800",
};

function docLabel(type: string): string {
  return DOC_TYPES.find((d) => d.value === type)?.label ?? type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Phase 5 — Documents & Verification.
 * Per-student checklist: upload birth cert / NIDs / TC / marksheets / orphan
 * cert, flag originals held, and stamp the human verification gate.
 */
export default function DocumentsView() {
  const [data, setData] = useState<DocumentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState("false");

  const [detail, setDetail] = useState<StudentDocumentChecklist | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (onlyPending === "true") params.set("onlyPending", "true");
      setData(await apiFetch<DocumentSummary>(`/api/admissions/documents?${params.toString()}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load documents", "error");
    } finally {
      setLoading(false);
    }
  }, [search, onlyPending]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(async (studentId: string) => {
    setDetailLoading(true);
    try {
      setDetail(await apiFetch<StudentDocumentChecklist>(`/api/admissions/documents/student/${studentId}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load checklist", "error");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function openDetail(row: { studentId: string }) {
    setDetail(null);
    loadDetail(row.studentId);
  }

  function pickFile(type: string) {
    pendingTypeRef.current = type;
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const type = pendingTypeRef.current;
    if (!file || !type || !detail) return;
    setBusy(type);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const fd = new FormData();
      fd.append("file", file);
      // Scans → DOCUMENT preset pipeline (WebP, magic-byte verified).
      // PDFs stay on the legacy document endpoint (image pipeline can't take them).
      const up = await fetch(isPdf ? "/api/uploads/document" : "/api/uploads/optimized", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const upJson = (await up.json().catch(() => null)) as { url?: string; message?: string } | null;
      if (!up.ok || !upJson?.url) throw new Error(upJson?.message ?? `Upload failed (${up.status})`);
      await apiFetch(`/api/admissions/documents/student/${detail.student.id}`, {
        method: "POST",
        body: JSON.stringify({ documentType: type, fileUrl: upJson.url }),
      });
      toast("Document uploaded — pending verification", "success");
      await loadDetail(detail.student.id);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function patchDoc(doc: StudentDocumentRow, patch: { isOriginalSubmitted?: boolean }) {
    if (!detail) return;
    setBusy(doc.id);
    try {
      await apiFetch(`/api/admissions/documents/${doc.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await loadDetail(detail.student.id);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function verify(doc: StudentDocumentRow, verified: boolean) {
    if (!detail) return;
    setBusy(doc.id);
    try {
      await apiFetch(`/api/admissions/documents/${doc.id}/verify`, {
        method: "PATCH",
        body: JSON.stringify({ verified }),
      });
      toast(verified ? `${docLabel(doc.documentType)} verified` : "Verification cleared", "success");
      await loadDetail(detail.student.id);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Verification failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function removeDoc(doc: StudentDocumentRow) {
    if (!detail) return;
    setBusy(doc.id);
    try {
      await apiFetch(`/api/admissions/documents/${doc.id}`, { method: "DELETE" });
      toast("Document removed", "success");
      await loadDetail(detail.student.id);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setBusy(null);
    }
  }

  // Canonical checklist + any extra types already on record for this student.
  const checklistTypes = (() => {
    const known = DOC_TYPES.map((d) => d.value);
    const extra = (detail?.documents ?? []).map((d) => d.documentType).filter((t) => !known.includes(t));
    return [...known, ...Array.from(new Set(extra))];
  })();

  const t = data?.totals;

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Documents & Verification"
        description="Birth cert, NIDs, TC copy, marksheets, orphan cert checklist + verification"
      />

      {loading && !data ? (
        <AdminPageLoader />
      ) : !data || !t ? (
        <p className="py-10 text-center text-sm text-ink-400">Document data unavailable — retry.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Students in view" value={String(t.students)} />
            <Tile label="Documents uploaded" value={String(t.uploaded)} />
            <Tile label="Verified" value={String(t.verified)} tone="text-emerald-700" />
            <Tile label="Pending verification" value={String(t.pending)} tone={t.pending > 0 ? "text-rose-700" : "text-ink-900"} />
          </div>

          <DashCard title="Filter students">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
              <div className="min-w-0 sm:col-span-2 2xl:col-span-2">
                <label className="mb-1 block text-xs font-medium text-ink-700">Search (name / student ID)</label>
                <input
                  className={INPUT}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  placeholder="e.g. Arif / STD-26-0001"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Checklist state</label>
                <SearchSelect options={PENDING_FILTER} value={onlyPending} onChange={setOnlyPending} ariaLabel="Checklist state filter" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-2">
                <button type="button" className={BTN} disabled={loading} onClick={load}>
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5"><FiLoader className="h-3.5 w-3.5 animate-spin" /> Loading…</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5"><FiSearch className="h-3.5 w-3.5" /> Run</span>
                  )}
                </button>
                <button type="button" className={BTN_GHOST} disabled={loading} onClick={load}>
                  <span className="inline-flex items-center gap-1"><FiRefreshCcw className="h-3.5 w-3.5" /> Refresh</span>
                </button>
              </div>
            </div>
          </DashCard>

          <DashCard title={`Students (${data.rows.length})`}>
            {data.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                No students match — admit a student via the Direct Admission Wizard first.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xs border border-ink-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Student</th>
                      <th className="px-2.5 py-1.5 font-semibold">Class / Section</th>
                      <th className="px-2.5 py-1.5 font-semibold">Status</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Uploaded</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Verified</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Pending</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Originals</th>
                      <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {data.rows.map((r) => (
                      <tr key={r.studentId} className="hover:bg-ink-50">
                        <td className="px-2.5 py-1">
                          <span className="font-medium">{r.fullNameEn}</span>
                          <span className="block font-mono text-ink-500">{r.studentUniqueId}</span>
                        </td>
                        <td className="px-2.5 py-1 font-mono text-ink-500" title={`${r.classOrDeptId ?? "—"} · ${r.sectionOrBatchId ?? "no section"}`}>
                          {r.classOrDeptId ? `${r.classOrDeptId.slice(0, 8)} · ${r.sectionOrBatchId?.slice(0, 8) ?? "—"}` : "—"}
                        </td>
                        <td className="px-2.5 py-1">
                          <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[r.currentStatus] ?? "bg-slate-200 text-slate-600"}`}>
                            {r.currentStatus}
                          </span>
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono">{r.uploaded}</td>
                        <td className="px-2.5 py-1 text-right font-mono text-emerald-700">{r.verified}</td>
                        <td className={`px-2.5 py-1 text-right font-mono ${r.pending > 0 ? "font-bold text-rose-700" : "text-ink-600"}`}>{r.pending}</td>
                        <td className="px-2.5 py-1 text-right font-mono text-ink-600">{r.originalsHeld}</td>
                        <td className="px-2.5 py-1">
                          <button type="button" className={BTN_GHOST} onClick={() => openDetail(r)}>
                            <span className="inline-flex items-center gap-1"><FiEye className="h-3 w-3" /> Checklist</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashCard>
        </>
      )}

      {/* ── Checklist drawer ── */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xs bg-white p-5" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <AdminPageLoader variant="inline" />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink-900">Documents — {detail.student.fullNameEn}</h3>
                  <span className="font-mono text-xs text-ink-500">{detail.student.studentUniqueId}</span>
                  <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[detail.student.currentStatus] ?? "bg-slate-200 text-slate-600"}`}>
                    {detail.student.currentStatus}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  Upload birth certificate, NIDs, TC copy, marksheets and orphan certificate. Ticking “original held”
                  records documents the institution keeps (college/university transcripts). Verified rows are stamped
                  with your user account.
                </p>

                <div className="mt-3 overflow-x-auto rounded-xs border border-ink-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 text-ink-700">
                      <tr>
                        <th className="px-2.5 py-1.5 font-semibold">Document</th>
                        <th className="px-2.5 py-1.5 font-semibold">State</th>
                        <th className="px-2.5 py-1.5 font-semibold">Original</th>
                        <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 bg-white">
                      {checklistTypes.map((type) => {
                        const doc = detail.documents.find((d) => d.documentType === type);
                        const verified = Boolean(doc?.verifiedBy);
                        const rowBusy = busy === type || (doc && busy === doc.id);
                        return (
                          <tr key={type} className="hover:bg-ink-50">
                            <td className="px-2.5 py-1 font-medium">{docLabel(type)}</td>
                            <td className="px-2.5 py-1">
                              {!doc ? (
                                <span className="rounded-xs bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">MISSING</span>
                              ) : verified ? (
                                <span className="rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">VERIFIED</span>
                              ) : (
                                <span className="rounded-xs bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">UPLOADED</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1">
                              <label className={`inline-flex items-center gap-1.5 text-xs ${doc ? "cursor-pointer text-ink-700" : "text-ink-300"}`}>
                                <input
                                  type="checkbox"
                                  className="cursor-pointer"
                                  disabled={!doc || busy !== null}
                                  checked={Boolean(doc?.isOriginalSubmitted)}
                                  onChange={(e) => doc && patchDoc(doc, { isOriginalSubmitted: e.target.checked })}
                                />
                                Original held
                              </label>
                            </td>
                            <td className="px-2.5 py-1">
                              <div className="flex flex-wrap gap-1">
                                <button type="button" className={BTN_GHOST} disabled={busy !== null} onClick={() => pickFile(type)}>
                                  {rowBusy && busy === type ? (
                                    <span className="inline-flex items-center gap-1"><FiLoader className="h-3 w-3 animate-spin" /> Uploading…</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1"><Upload className="h-3 w-3" /> {doc ? "Replace" : "Upload"}</span>
                                  )}
                                </button>
                                {doc && (
                                  <a
                                    href={resolveImageUrl(doc.fileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={BTN_GHOST}
                                  >
                                    <span className="inline-flex items-center gap-1"><FiFileText className="h-3 w-3" /> View</span>
                                  </a>
                                )}
                                {doc && (
                                  <button
                                    type="button"
                                    className={BTN_GHOST}
                                    disabled={busy !== null}
                                    onClick={() => verify(doc, !verified)}
                                  >
                                    {rowBusy && busy === doc.id ? (
                                      <span className="inline-flex items-center gap-1"><FiLoader className="h-3 w-3 animate-spin" /></span>
                                    ) : verified ? (
                                      <span className="inline-flex items-center gap-1"><FiXCircle className="h-3 w-3" /> Unverify</span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1"><RiShieldCheckLine className="h-3 w-3" /> Verify</span>
                                    )}
                                  </button>
                                )}
                                {doc && (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                                    disabled={busy !== null}
                                    onClick={() => removeDoc(doc)}
                                    title="Remove document"
                                  >
                                    <FiTrash className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-500">
                  <FiCheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  {detail.documents.filter((d) => d.verifiedBy).length} verified ·{" "}
                  {detail.documents.filter((d) => !d.verifiedBy).length} pending ·{" "}
                  {checklistTypes.filter((t) => !detail.documents.some((d) => d.documentType === t)).length} missing
                </p>

                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" className={MODAL_BTN_GHOST} onClick={() => setDetail(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xs border border-ink-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase text-ink-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${tone ?? "text-ink-900"}`}>{value}</p>
    </div>
  );
}
