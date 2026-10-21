"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiFileText, FiLoader, FiRefreshCcw, FiSearch, FiUsers } from "react-icons/fi";
import { FaArrowRightArrowLeft } from "react-icons/fa6";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import { peekRoll, transferSection, type TransferSectionResult } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const MODAL_BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const MODAL_BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const GROUPS = ["GENERAL", "SCIENCE", "ARTS", "COMMERCE", "MUZABBID", "HIFZ"].map((v) => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));
const QUOTAS = ["NONE", "MERIT", "SIBLING", "FREEDOM_FIGHTER", "ORPHAN_LILLAH", "STAFF_CHILD"].map((v) => ({
  value: v,
  label: v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
}));
const RESIDENCES = [
  { value: "DAY_SCHOLAR", label: "Day scholar" },
  { value: "HOSTEL_REGULAR", label: "Hostel (regular)" },
  { value: "MADRASAH_LILLAH_BOARDER", label: "Madrasah Lillah boarder" },
];
const STATUSES = ["ACTIVE", "TC_ISSUED", "GRADUATED", "DROPPED", "SUSPENDED"].map((v) => ({
  value: v,
  label: v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
}));

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  TC_ISSUED: "bg-rose-100 text-rose-700",
  GRADUATED: "bg-sky-100 text-sky-800",
  DROPPED: "bg-slate-200 text-slate-600",
  SUSPENDED: "bg-amber-100 text-amber-800",
};

interface StudentRow {
  id: string;
  studentUniqueId: string;
  fullNameEn: string;
  fullNameBn?: string | null;
  gender: string;
  currentStatus: string;
  admissionDate: string;
  photoUrl?: string | null;
  arBalance: string;
  feeDue: boolean;
  enrollment: {
    id: string;
    academicSessionId: string;
    classOrDeptId: string;
    sectionOrBatchId?: string | null;
    academicGroup: string;
    classRollNo: number;
    residenceType: string;
    quotaTag: string;
    enrollmentType?: string;
  } | null;
}

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface FilterOptions {
  sessions: FilterOption[];
  classes: FilterOption[];
  sections: FilterOption[];
}

/**
 * Plan §3.4 — Enrollments & Sections.
 * Session-wise placement (class, shift, section, group, auto roll preview),
 * section transfer + residence (day/hostel/Lillah) + quota tags.
 * Rows are written by Direct Admission confirm (Workflow 4); this page
 * manages placement and transfers for existing students.
 */
export default function EnrollmentsView() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [options, setOptions] = useState<FilterOptions>({ sessions: [], classes: [], sections: [] });

  // filters
  const [search, setSearch] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

  // transfer modal
  const [transferOf, setTransferOf] = useState<StudentRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [xSession, setXSession] = useState("");
  const [xClass, setXClass] = useState("");
  const [xSection, setXSection] = useState("");
  const [xShift, setXShift] = useState("");
  const [xGroup, setXGroup] = useState("");
  const [xResidence, setXResidence] = useState("");
  const [xQuota, setXQuota] = useState("");
  const [previewRoll, setPreviewRoll] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (sessionId.trim()) params.set("academicSessionId", sessionId.trim());
      if (classId.trim()) params.set("classOrDeptId", classId.trim());
      if (sectionId.trim()) params.set("sectionOrBatchId", sectionId.trim());
      setRows(await apiFetch<StudentRow[]>(`/api/admissions/students?${params.toString()}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load enrollments", "error");
    } finally {
      setLoading(false);
    }
  }, [search, sessionId, classId, sectionId]);

  const loadOptions = useCallback(async () => {
    try {
      setOptions(await apiFetch<FilterOptions>("/api/admissions/students/filter-options"));
    } catch {
      /* filter dropdowns degrade to free-text when options are unavailable */
    }
  }, []);

  useEffect(() => {
    load();
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- roll preview ----
  const previewEnabled = useMemo(() => Boolean(xSession && xClass && xSection), [xSession, xClass, xSection]);

  const previewRollNo = useCallback(async () => {
    if (!previewEnabled) return;
    try {
      const res = await apiFetch<{ classRollNo: number }>(`/api/admissions/enrollments/peek-roll`, {
        method: "POST",
        body: JSON.stringify({
          academicSessionId: xSession,
          classOrDeptId: xClass,
          sectionOrBatchId: xSection || null,
        }),
      });
      setPreviewRoll(res.classRollNo);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Roll preview failed", "error");
    }
  }, [previewEnabled, xSession, xClass, xSection]);

  useEffect(() => {
    if (previewEnabled) {
      const t = setTimeout(previewRollNo, 150);
      return () => clearTimeout(t);
    }
    setPreviewRoll(null);
  }, [previewEnabled, previewRollNo]);

  // ---- section transfer ----
  async function submitTransfer() {
    if (!transferOf) return;
    setBusy("transfer");
    try {
      const res = await transferSection(transferOf.id, {
        academicSessionId: xSession || undefined,
        sectionOrBatchId: xSection || null,
        shiftId: xShift || null,
        academicGroup: xGroup || null,
        residenceType: xResidence || null,
        quotaTag: xQuota || null,
      });
      toast(
        `Transferred ${res.studentUniqueId} — new roll ${res.classRollNo} in ${res.sectionOrBatchId ?? "no section"}`,
        "success",
      );
      setTransferOf(null);
      setXSession("");
      setXClass("");
      setXSection("");
      setXShift("");
      setXGroup("");
      setXResidence("");
      setXQuota("");
      setPreviewRoll(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Transfer failed", "error");
    } finally {
      setBusy(null);
    }
  }

  const defaultX = useMemo(() => {
    if (!transferOf?.enrollment) return {};
    const en = transferOf.enrollment;
    return {
      session: en.academicSessionId,
      class: en.classOrDeptId,
      section: en.sectionOrBatchId ?? "",
      group: en.academicGroup,
      residence: en.residenceType,
      quota: en.quotaTag,
    };
  }, [transferOf]);

  useEffect(() => {
    if (transferOf) {
      setXSession(defaultX.session ?? "");
      setXClass(defaultX.class ?? "");
      setXSection(defaultX.section ?? "");
      setXGroup(defaultX.group ?? "");
      setXResidence(defaultX.residence ?? "");
      setXQuota(defaultX.quota ?? "");
      setPreviewRoll(null);
    }
  }, [transferOf, defaultX.session, defaultX.class, defaultX.section]);

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Enrollments & Sections"
        description="Plan §3.4 — session-wise placement, section transfer, residence & quota tags"
      />

      {/* ── Filter card ── */}
      <DashCard title="Filter enrollments">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0 sm:col-span-2 2xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-700">Search (name / ID)</label>
            <input
              className={INPUT}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="e.g. Arif / STD-26-0001"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Session</label>
            <SearchSelect
              options={options.sessions}
              value={sessionId}
              onChange={setSessionId}
              placeholder="All sessions…"
              isClearable
              ariaLabel="Session filter"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Class / Dept</label>
            <SearchSelect
              options={options.classes}
              value={classId}
              onChange={setClassId}
              placeholder="All classes…"
              isClearable
              ariaLabel="Class filter"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Section</label>
            <SearchSelect
              options={options.sections}
              value={sectionId}
              onChange={setSectionId}
              placeholder="All sections…"
              isClearable
              ariaLabel="Section filter"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Status</label>
            <SearchSelect
              options={STATUSES}
              value={""}
              onChange={() => {}}
              placeholder="All…"
              isClearable
              ariaLabel="Status filter"
              isDisabled
            />
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

      {/* ── Student enrollment table ── */}
      <DashCard title={`Enrolled students (${rows.length})`}>
        {loading && rows.length === 0 ? (
          <AdminPageLoader variant="inline" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">
            No enrollments match — admit students via the Direct Admission Wizard first.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Student</th>
                  <th className="px-2.5 py-1.5 font-semibold">Placement</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Roll</th>
                  <th className="px-2.5 py-1.5 font-semibold">Group</th>
                  <th className="px-2.5 py-1.5 font-semibold">Quota</th>
                  <th className="px-2.5 py-1.5 font-semibold">Residence</th>
                  <th className="px-2.5 py-1.5 font-semibold">Status</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">AR balance</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1">
                      <span className="font-medium">{r.fullNameEn}</span>
                      <span className="block font-mono text-ink-500">{r.studentUniqueId}</span>
                    </td>
                    <td className="px-2.5 py-1 font-mono text-ink-500" title={r.enrollment ? `${r.enrollment.academicSessionId} · ${r.enrollment.classOrDeptId} · ${r.enrollment.sectionOrBatchId ?? "no section"}` : "no active enrollment"}>
                      {r.enrollment
                        ? `${r.enrollment.academicSessionId.slice(0, 8)} · ${r.enrollment.classOrDeptId.slice(0, 8)} · ${r.enrollment.sectionOrBatchId?.slice(0, 8) ?? "—"}`
                        : "—"}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono">
                      {r.enrollment?.classRollNo ?? "—"}
                    </td>
                    <td className="px-2.5 py-1 font-mono text-ink-500">
                      {r.enrollment?.academicGroup ?? "—"}
                    </td>
                    <td className="px-2.5 py-1">
                      <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                        r.enrollment?.quotaTag === "NONE" ? "bg-ink-100 text-ink-600" : "bg-amber-100 text-amber-800"
                      }`}>
                        {r.enrollment?.quotaTag ?? "—"}
                      </span>
                    </td>
                    <td className="px-2.5 py-1 text-ink-600">
                      {r.enrollment?.residenceType ?? "—"}
                    </td>
                    <td className="px-2.5 py-1">
                      <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[r.currentStatus] ?? "bg-slate-200 text-slate-600"}`}>
                        {r.currentStatus}
                      </span>
                    </td>
                    <td className={`px-2.5 py-1 text-right font-mono ${r.feeDue ? "font-bold text-rose-700" : "text-ink-600"}`}>
                      {r.arBalance}
                    </td>
                    <td className="px-2.5 py-1">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={BTN_GHOST}
                          disabled={!r.enrollment || busy !== null}
                          onClick={() => setTransferOf(r)}
                        >
                          <span className="inline-flex items-center gap-1"><FaArrowRightArrowLeft className="h-3 w-3" /> Transfer</span>
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

      {/* ── Section transfer modal ── */}
      {transferOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" onClick={() => setTransferOf(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xs bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-ink-900">Transfer section — {transferOf.studentUniqueId}</h3>
            <p className="mt-1 text-xs text-ink-500">
              Current: section {transferOf.enrollment?.sectionOrBatchId?.slice(0, 8) ?? "—"} · roll {transferOf.enrollment?.classRollNo ?? "—"} ·
              group {transferOf.enrollment?.academicGroup ?? "—"} · {transferOf.enrollment?.residenceType ?? "—"} ·
              {transferOf.enrollment?.quotaTag ?? "—"}. A new roll is reserved in the target scope.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
              <div className="min-w-0 sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-ink-700">Target session</label>
                <SearchSelect
                  options={options.sessions}
                  value={xSession}
                  onChange={setXSession}
                  placeholder="Select session…"
                  isClearable
                  ariaLabel="Target session"
                />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-ink-700">Target class / dept</label>
                <SearchSelect
                  options={options.classes}
                  value={xClass}
                  onChange={setXClass}
                  placeholder="Select class…"
                  isClearable
                  ariaLabel="Target class"
                />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-ink-700">Target section</label>
                <SearchSelect
                  options={options.sections}
                  value={xSection}
                  onChange={setXSection}
                  placeholder="Select section…"
                  isClearable
                  ariaLabel="Target section"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Target shift (optional)</label>
                <input
                  className={INPUT}
                  value={xShift}
                  onChange={(e) => setXShift(e.target.value)}
                  placeholder="Shift UUID…"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Academic group</label>
                <SearchSelect
                  options={GROUPS}
                  value={xGroup}
                  onChange={setXGroup}
                  placeholder="Unchanged…"
                  isClearable
                  ariaLabel="Target group"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Residence</label>
                <SearchSelect
                  options={RESIDENCES}
                  value={xResidence}
                  onChange={setXResidence}
                  placeholder="Unchanged…"
                  isClearable
                  ariaLabel="Residence"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Quota tag</label>
                <SearchSelect
                  options={QUOTAS}
                  value={xQuota}
                  onChange={setXQuota}
                  placeholder="Unchanged…"
                  isClearable
                  ariaLabel="Quota tag"
                />
              </div>
            </div>

            {previewEnabled && (
              <div className="mt-3 rounded-xs border border-brand-200 bg-brand-50 px-2.5 py-2">
                <p className="text-xs font-medium text-brand-800">
                  <FiLoader className="h-3.5 w-3.5 inline mr-1.5 animate-spin" /> Next roll in target scope:
                  <span className="font-mono font-bold">{previewRoll ?? "—"}</span>
                </p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={MODAL_BTN_GHOST} onClick={() => setTransferOf(null)}>Cancel</button>
              <button
                type="button"
                className={MODAL_BTN}
                disabled={busy !== null || !previewEnabled}
                onClick={submitTransfer}
              >
                {busy === "transfer" ? (
                  <span className="inline-flex items-center gap-1.5"><FiLoader className="h-3.5 w-3.5 animate-spin" /> Transferring…</span>
                ) : (
                  "Confirm transfer"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
