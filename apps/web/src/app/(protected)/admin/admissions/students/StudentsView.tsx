"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FileText, Loader2, RefreshCw, Search, ShieldCheck, ShieldAlert, ArrowRightLeft, IdCard, UserPlus } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import DatePickerField, { todayISO } from "@/components/ui/DatePicker";
import AddStudentModal from "@/components/admissions/AddStudentModal";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { StudentClearance, StudentDirectoryRow, StudentFilterOptions, StudentProfile } from "@/lib/admissions";

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
const FEE_DUE = [
  { value: "true", label: "Fee due only" },
  { value: "false", label: "All students" },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  TC_ISSUED: "bg-rose-100 text-rose-700",
  GRADUATED: "bg-sky-100 text-sky-800",
  DROPPED: "bg-slate-200 text-slate-600",
  SUSPENDED: "bg-amber-100 text-amber-800",
};

/**
 * Phase 5 — Master Student Directory (Plan §3.3 + §5).
 * Filters by session/class/section/group/quota/residence/status/fee-due,
 * profile view, TC clearance + issue (Accounting dues gate), section transfer.
 */
export default function StudentsView() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentDirectoryRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [options, setOptions] = useState<StudentFilterOptions>({ sessions: [], classes: [], sections: [] });
  const [addOpen, setAddOpen] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [group, setGroup] = useState("");
  const [quota, setQuota] = useState("");
  const [residence, setResidence] = useState("");
  const [status, setStatus] = useState("");
  const [feeDue, setFeeDue] = useState("false");

  // modals
  const [profileOf, setProfileOf] = useState<StudentDirectoryRow | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [tcOf, setTcOf] = useState<StudentDirectoryRow | null>(null);
  const [clearance, setClearance] = useState<StudentClearance | null>(null);
  const [tcNumber, setTcNumber] = useState("");
  const [tcDate, setTcDate] = useState(todayISO());
  const [overrideReason, setOverrideReason] = useState("");
  const [transferOf, setTransferOf] = useState<StudentDirectoryRow | null>(null);
  const [xSection, setXSection] = useState("");
  const [xShift, setXShift] = useState("");
  const [xGroup, setXGroup] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (sessionId.trim()) params.set("academicSessionId", sessionId.trim());
      if (classId.trim()) params.set("classOrDeptId", classId.trim());
      if (sectionId.trim()) params.set("sectionOrBatchId", sectionId.trim());
      if (group) params.set("academicGroup", group);
      if (quota) params.set("quotaTag", quota);
      if (residence) params.set("residenceType", residence);
      if (status) params.set("status", status);
      if (feeDue === "true") params.set("feeDue", "true");
      setRows(await apiFetch<StudentDirectoryRow[]>(`/api/admissions/students?${params.toString()}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load students", "error");
    } finally {
      setLoading(false);
    }
  }, [search, sessionId, classId, sectionId, group, quota, residence, status, feeDue]);

  const loadOptions = useCallback(async () => {
    try {
      setOptions(await apiFetch<StudentFilterOptions>("/api/admissions/students/filter-options"));
    } catch {
      /* filter dropdowns degrade to free-text when options are unavailable */
    }
  }, []);

  useEffect(() => {
    load();
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openProfile(row: StudentDirectoryRow) {
    setProfileOf(row);
    setProfile(null);
    setProfileLoading(true);
    try {
      setProfile(await apiFetch<StudentProfile>(`/api/admissions/students/${row.id}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load profile", "error");
    } finally {
      setProfileLoading(false);
    }
  }

  async function openTc(row: StudentDirectoryRow) {
    setTcOf(row);
    setClearance(null);
    setTcNumber("");
    setTcDate(todayISO());
    setOverrideReason("");
    setBusy("clearance");
    try {
      setClearance(await apiFetch<StudentClearance>(`/api/admissions/students/${row.id}/clearance`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Clearance check failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function issueTc() {
    if (!tcOf || !clearance) return;
    if (!clearance.canIssueTc && overrideReason.trim().length < 3) {
      toast("Dues are outstanding — provide an override reason (3+ chars) to waive", "error");
      return;
    }
    setBusy("tc");
    try {
      const res = await apiFetch<{ studentUniqueId: string; tcNumber: string }>(
        `/api/admissions/students/${tcOf.id}/tc`,
        {
          method: "POST",
          body: JSON.stringify({
            tcNumber: tcNumber.trim() || undefined,
            issueDate: tcDate,
            overrideReason: overrideReason.trim() || undefined,
          }),
        },
      );
      toast(`TC ${res.tcNumber} issued for ${res.studentUniqueId}`, "success");
      setTcOf(null);
      setClearance(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "TC issue failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function submitTransfer() {
    if (!transferOf) return;
    setBusy("transfer");
    try {
      await apiFetch(`/api/admissions/students/${transferOf.id}/transfer-section`, {
        method: "POST",
        body: JSON.stringify({
          sectionOrBatchId: xSection.trim() || null,
          shiftId: xShift.trim() || null,
          academicGroup: xGroup || null,
        }),
      });
      toast("Section transfer complete (roll re-assigned)", "success");
      setTransferOf(null);
      setXSection("");
      setXShift("");
      setXGroup("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Transfer failed", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Students Directory"
        description="Plan §3.3 + §5 — master directory, profile view, TC clearance & section transfer"
      />

      <DashCard title="Filter students">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0 sm:col-span-2 2xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-700">Search (name / ID / BRN)</label>
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
            <label className="mb-1 block text-xs font-medium text-ink-700">Group</label>
            <SearchSelect options={GROUPS} value={group} onChange={setGroup} placeholder="All…" isClearable ariaLabel="Academic group" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Quota</label>
            <SearchSelect options={QUOTAS} value={quota} onChange={setQuota} placeholder="All…" isClearable ariaLabel="Quota" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Residence</label>
            <SearchSelect options={RESIDENCES} value={residence} onChange={setResidence} placeholder="All…" isClearable ariaLabel="Residence" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Status</label>
            <SearchSelect options={STATUSES} value={status} onChange={setStatus} placeholder="All…" isClearable ariaLabel="Status" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Fee due</label>
            <SearchSelect options={FEE_DUE} value={feeDue} onChange={setFeeDue} ariaLabel="Fee due filter" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-2">
            <button type="button" className={BTN} disabled={loading} onClick={load}>
              {loading ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</span>
              ) : (
                <span className="inline-flex items-center gap-1.5"><Search className="h-3.5 w-3.5" /> Run</span>
              )}
            </button>
            <button type="button" className={BTN} onClick={() => setAddOpen(true)}>
              <span className="inline-flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Add student</span>
            </button>
            <button type="button" className={BTN_GHOST} disabled={loading} onClick={load}>
              <span className="inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Refresh</span>
            </button>
          </div>
        </div>
      </DashCard>

      <DashCard title={`Students (${rows.length})`}>
        {loading && rows.length === 0 ? (
          <AdminPageLoader variant="inline" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">
            No students match — admit one via the Direct Admission Wizard first.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Student</th>
                  <th className="px-2.5 py-1.5 font-semibold">Placement</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Roll</th>
                  <th className="px-2.5 py-1.5 font-semibold">Group / Quota</th>
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
                    <td className="px-2.5 py-1 text-right font-mono">{r.enrollment?.classRollNo ?? "—"}</td>
                    <td className="px-2.5 py-1">
                      {r.enrollment?.academicGroup ?? "—"}
                      <span className="block text-ink-500">{r.enrollment?.quotaTag ?? "—"}</span>
                    </td>
                    <td className="px-2.5 py-1 text-ink-600">{r.enrollment?.residenceType ?? "—"}</td>
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
                        <button type="button" className={BTN_GHOST} onClick={() => openProfile(r)}>
                          <span className="inline-flex items-center gap-1"><IdCard className="h-3 w-3" /> Profile</span>
                        </button>
                        <button type="button" className={BTN_GHOST} disabled={busy !== null} onClick={() => openTc(r)}>
                          <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> Clearance / TC</span>
                        </button>
                        <button type="button" className={BTN_GHOST} disabled={!r.enrollment} onClick={() => setTransferOf(r)}>
                          <span className="inline-flex items-center gap-1"><ArrowRightLeft className="h-3 w-3" /> Transfer</span>
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

      {/* ── Profile modal ── */}
      {profileOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" onClick={() => setProfileOf(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xs bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-ink-900">Student profile — {profileOf.studentUniqueId}</h3>
            {profileLoading ? (
              <AdminPageLoader variant="inline" />
            ) : profile ? (
              <div className="mt-3 space-y-3 text-xs">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="Name (EN)" value={profile.student.fullNameEn} />
                  <Field label="Name (BN)" value={profile.student.fullNameBn ?? "—"} />
                  <Field label="Gender / DOB" value={`${profile.student.gender} / ${profile.student.dateOfBirth?.slice(0, 10)}`} />
                  <Field label="BRN / NID" value={`${profile.student.birthRegNo ?? "—"} / ${profile.student.nationalIdNo ?? "—"}`} />
                  <Field label="Religion / Blood" value={`${profile.student.religion} / ${profile.student.bloodGroup ?? "—"}`} />
                  <Field label="Status" value={profile.student.currentStatus} />
                </div>
                <p className="rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1.5 font-mono">
                  AR balance {profile.arBalance} BDT
                  {profile.student.tcNumber ? ` · TC ${profile.student.tcNumber} (${profile.student.tcIssueDate?.slice(0, 10)})` : ""}
                </p>
                <Section title={`Family (${profile.family?.familyCode ?? "—"})`}>
                  <p>{profile.family ? `${profile.family.fatherNameEn} · ${profile.family.motherNameEn}` : "No family linked"}</p>
                  <p className="text-ink-500">{profile.family?.primaryGuardianPhone ?? "—"} · {profile.family?.presentAddress ?? "—"}</p>
                </Section>
                <Section title={`Enrollments (${profile.enrollments.length})`}>
                  {profile.enrollments.length === 0 ? (
                    <p className="text-ink-500">None</p>
                  ) : (
                    profile.enrollments.map((e) => (
                      <p key={e.id} className="font-mono">
                        {e.academicSessionId.slice(0, 8)} · class {e.classOrDeptId.slice(0, 8)} · sec {e.sectionOrBatchId?.slice(0, 8) ?? "—"} · roll {e.classRollNo} · {e.enrollmentType ?? ""}
                      </p>
                    ))
                  )}
                </Section>
                <Section title={`Previous education (${profile.previousEducations.length})`}>
                  {profile.previousEducations.length === 0 ? (
                    <p className="text-ink-500">None</p>
                  ) : (
                    profile.previousEducations.map((e) => (
                      <p key={e.id} className="font-mono">
                        {e.examTitle} · {e.instituteName} · GPA {e.gpaObtained ?? "—"}
                      </p>
                    ))
                  )}
                </Section>
                <Section title={`Documents (${profile.documents.length})`}>
                  {profile.documents.length === 0 ? (
                    <p className="text-ink-500">None uploaded</p>
                  ) : (
                    profile.documents.map((d) => (
                      <p key={d.id} className="font-mono">
                        {d.documentType} {d.isOriginalSubmitted ? "· original" : ""}
                      </p>
                    ))
                  )}
                </Section>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-500">Could not load profile.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={MODAL_BTN_GHOST} onClick={() => setProfileOf(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clearance / TC modal ── */}
      {tcOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" onClick={() => setTcOf(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xs bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-ink-900">Transfer Certificate — {tcOf.studentUniqueId}</h3>
            {busy === "clearance" ? (
              <AdminPageLoader variant="inline" />
            ) : clearance ? (
              <div className="mt-3 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="AR balance (BDT)" value={clearance.arBalance} />
                  <Field label="Caution held (BDT)" value={clearance.cautionHeld} />
                </div>
                {clearance.canIssueTc ? (
                  <p className="inline-flex items-center gap-1.5 rounded-xs border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800">
                    <ShieldCheck className="h-3.5 w-3.5" /> Dues clear — TC can be issued.
                  </p>
                ) : (
                  <div className="rounded-xs border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-rose-800">
                    <p className="inline-flex items-center gap-1.5 font-semibold">
                      <ShieldAlert className="h-3.5 w-3.5" /> TC blocked:
                    </p>
                    <ul className="mt-1 list-inside list-disc">
                      {clearance.blockers.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-end">
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-ink-700">TC number (optional)</label>
                    <input className={INPUT} value={tcNumber} onChange={(e) => setTcNumber(e.target.value)} placeholder={`TC-${clearance.studentUniqueId}`} />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-ink-700">Issue date</label>
                    <DatePickerField value={tcDate} onChange={setTcDate} />
                  </div>
                </div>

                {!clearance.canIssueTc && (
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-ink-700">
                      Override reason (required to waive outstanding dues — audited)
                    </label>
                    <input
                      className={INPUT}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g. Approved by Principal — hardship waiver"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-500">Could not load clearance.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={MODAL_BTN_GHOST} onClick={() => setTcOf(null)}>Cancel</button>
              <button
                type="button"
                className={MODAL_BTN}
                disabled={busy !== null || !clearance || (!clearance.canIssueTc && overrideReason.trim().length < 3)}
                onClick={issueTc}
              >
                {busy === "tc" ? (
                  <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Issuing…</span>
                ) : clearance && !clearance.canIssueTc ? (
                  "Issue TC (waive dues)"
                ) : (
                  "Issue Transfer Certificate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section transfer modal ── */}
      {transferOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" onClick={() => setTransferOf(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xs bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-ink-900">Transfer section — {transferOf.studentUniqueId}</h3>
            <p className="mt-1 text-xs text-ink-500">
              Current: section {transferOf.enrollment?.sectionOrBatchId?.slice(0, 8) ?? "—"} · roll {transferOf.enrollment?.classRollNo ?? "—"} ·
              group {transferOf.enrollment?.academicGroup ?? "—"}. A new roll is reserved in the target scope.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 items-end">
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Target section ID</label>
                <input className={`${INPUT} font-mono`} value={xSection} onChange={(e) => setXSection(e.target.value)} placeholder="UUID (blank = no section)" />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Target shift ID (optional)</label>
                <input className={`${INPUT} font-mono`} value={xShift} onChange={(e) => setXShift(e.target.value)} placeholder="UUID…" />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Academic group</label>
                <SearchSelect options={GROUPS} value={xGroup} onChange={setXGroup} placeholder="Unchanged…" isClearable ariaLabel="Target group" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={MODAL_BTN_GHOST} onClick={() => setTransferOf(null)}>Cancel</button>
              <button type="button" className={MODAL_BTN} disabled={busy !== null} onClick={submitTransfer}>
                {busy === "transfer" ? (
                  <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Transferring…</span>
                ) : (
                  "Confirm transfer"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          load();
          loadOptions();
        }}
        options={options}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-ink-700">{label}</p>
      <p className="truncate rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1 text-sm" title={value}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-semibold text-ink-700">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
