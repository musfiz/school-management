"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpCircle, FileText, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import DatePickerField, { todayISO } from "@/components/ui/DatePicker";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { StudentClearance, StudentDirectoryRow } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const GROUPS = ["GENERAL", "SCIENCE", "ARTS", "COMMERCE", "MUZABBID", "HIFZ"].map((v) => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));
const ENROLL_TYPES = [
  { value: "PROMOTED", label: "Promoted" },
  { value: "READMISSION", label: "Readmission" },
];

/**
 * Phase 5 — Promotion & TC Issue (Plan §5). Bulk session promotion /
 * readmission plus a TC issue panel that enforces the Accounting
 * dues-clearance gate (AR balance = 0 and caution deposits settled).
 */
export default function PromotionTcView() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [options, setOptions] = useState<{ sessions: { value: string; label: string; count: number }[]; classes: { value: string; label: string; count: number }[]; sections: { value: string; label: string; count: number }[] }>({ sessions: [], classes: [], sections: [] });

  // promotion
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [targetSession, setTargetSession] = useState("");
  const [targetClass, setTargetClass] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [targetGroup, setTargetGroup] = useState("");
  const [enrollType, setEnrollType] = useState("PROMOTED");
  const [result, setResult] = useState<{ promoted: number; skipped: Array<{ studentId: string; reason: string }> } | null>(null);

  // TC
  const [tcStudentId, setTcStudentId] = useState("");
  const [clearance, setClearance] = useState<StudentClearance | null>(null);
  const [tcNumber, setTcNumber] = useState("");
  const [tcDate, setTcDate] = useState(todayISO());
  const [overrideReason, setOverrideReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsData, opts] = await Promise.all([
        apiFetch<StudentDirectoryRow[]>("/api/admissions/students?status=ACTIVE&limit=500"),
        apiFetch<{ sessions: { value: string; label: string; count: number }[]; classes: { value: string; label: string; count: number }[]; sections: { value: string; label: string; count: number }[] }>("/api/admissions/students/filter-options"),
      ]);
      setStudents(studentsData);
      setOptions(opts);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load students", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function togglePick(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  async function promote() {
    if (picked.size === 0) {
      toast("Select at least one student", "error");
      return;
    }
    if (!targetSession.trim() || !targetClass.trim()) {
      toast("Target session ID and class/dept ID are required", "error");
      return;
    }
    setBusy("promote");
    setResult(null);
    try {
      const res = await apiFetch<{ promoted: number; skipped: Array<{ studentId: string; reason: string }> }>(
        "/api/admissions/students/promote",
        {
          method: "POST",
          body: JSON.stringify({
            studentIds: Array.from(picked),
            targetSessionId: targetSession.trim(),
            targetClassOrDeptId: targetClass.trim(),
            sectionOrBatchId: targetSection.trim() || null,
            academicGroup: targetGroup || null,
            enrollmentType: enrollType,
          }),
        },
      );
      setResult(res);
      toast(`${res.promoted} student(s) ${enrollType === "READMISSION" ? "readmitted" : "promoted"}`, "success");
      setPicked(new Set());
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Promotion failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function loadClearance(id: string) {
    setTcStudentId(id);
    setClearance(null);
    setTcNumber("");
    setTcDate(todayISO());
    setOverrideReason("");
    if (!id) return;
    setBusy("clearance");
    try {
      setClearance(await apiFetch<StudentClearance>(`/api/admissions/students/${id}/clearance`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Clearance check failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function issueTc() {
    if (!tcStudentId || !clearance) return;
    if (!clearance.canIssueTc && overrideReason.trim().length < 3) {
      toast("Dues outstanding — provide an override reason to waive", "error");
      return;
    }
    setBusy("tc");
    try {
      const res = await apiFetch<{ studentUniqueId: string; tcNumber: string }>(
        `/api/admissions/students/${tcStudentId}/tc`,
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
      setTcStudentId("");
      setClearance(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "TC issue failed", "error");
    } finally {
      setBusy(null);
    }
  }

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.studentUniqueId} — ${s.fullNameEn}${s.enrollment ? ` (roll ${s.enrollment.classRollNo})` : ""}`,
  }));

  if (loading && students.length === 0) return <AdminPageLoader />;

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Promotion & TC Issue"
        description="Plan §5 — session promotion, readmission, TC with Accounting dues clearance"
      />

      <DashCard title={`Bulk promotion / readmission — ${picked.size} selected`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Target session ID *</label>
            <SearchSelect
              options={options.sessions}
              value={targetSession}
              onChange={setTargetSession}
              placeholder="Select session…"
              isClearable
              ariaLabel="Target session"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Target class / dept ID *</label>
            <SearchSelect
              options={options.classes}
              value={targetClass}
              onChange={setTargetClass}
              placeholder="Select class…"
              isClearable
              ariaLabel="Target class"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Target section ID</label>
            <SearchSelect
              options={options.sections}
              value={targetSection}
              onChange={setTargetSection}
              placeholder="Select section…"
              isClearable
              ariaLabel="Target section"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Academic group</label>
            <SearchSelect options={GROUPS} value={targetGroup} onChange={setTargetGroup} placeholder="Keep current…" isClearable ariaLabel="Target group" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Action</label>
            <SearchSelect options={ENROLL_TYPES} value={enrollType} onChange={setEnrollType} ariaLabel="Enrollment type" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-1">
            <button type="button" className={BTN} disabled={busy !== null} onClick={promote}>
              {busy === "promote" ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</span>
              ) : (
                <span className="inline-flex items-center gap-1.5"><ArrowUpCircle className="h-3.5 w-3.5" /> Promote selected</span>
              )}
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-3 space-y-1 rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs">
            <p className="font-semibold text-emerald-700">{result.promoted} succeeded</p>
            {result.skipped.length > 0 && (
              <ul className="list-inside list-disc text-rose-700">
                {result.skipped.map((s) => (
                  <li key={s.studentId} className="font-mono">{s.studentId.slice(0, 8)} — {s.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {students.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">No active students to promote.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xs border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={picked.size === students.length && students.length > 0}
                      onChange={(e) => setPicked(e.target.checked ? new Set(students.map((s) => s.id)) : new Set())}
                    />
                  </th>
                  <th className="px-2.5 py-1.5 font-semibold">Student</th>
                  <th className="px-2.5 py-1.5 font-semibold">Current placement</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Roll</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">AR balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1">
                      <input type="checkbox" className="cursor-pointer" checked={picked.has(s.id)} onChange={() => togglePick(s.id)} />
                    </td>
                    <td className="px-2.5 py-1">
                      <span className="font-medium">{s.fullNameEn}</span>
                      <span className="block font-mono text-ink-500">{s.studentUniqueId}</span>
                    </td>
                    <td className="px-2.5 py-1 font-mono text-ink-500" title={s.enrollment ? `${s.enrollment.academicSessionId} · ${s.enrollment.classOrDeptId}` : ""}>
                      {s.enrollment ? `${s.enrollment.academicSessionId.slice(0, 8)} · ${s.enrollment.classOrDeptId.slice(0, 8)}` : "—"}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono">{s.enrollment?.classRollNo ?? "—"}</td>
                    <td className={`px-2.5 py-1 text-right font-mono ${s.feeDue ? "font-bold text-rose-700" : ""}`}>{s.arBalance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

      <DashCard title="Transfer Certificate issue (dues-clearance gate)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0 sm:col-span-2 2xl:col-span-3">
            <label className="mb-1 block text-xs font-medium text-ink-700">Student</label>
            <SearchSelect
              options={studentOptions}
              value={tcStudentId}
              onChange={loadClearance}
              placeholder="Search active student…"
              isClearable
              ariaLabel="Student for TC"
            />
          </div>
        </div>

        {busy === "clearance" && <AdminPageLoader variant="inline" />}

        {clearance && (
          <div className="mt-3 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <p className="rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1.5">
                AR balance: <span className="font-mono font-bold">{clearance.arBalance}</span> BDT
              </p>
              <p className="rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1.5">
                Caution held: <span className="font-mono font-bold">{clearance.cautionHeld}</span> BDT
              </p>
            </div>
            {clearance.canIssueTc ? (
              <p className="inline-flex items-center gap-1.5 rounded-xs border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Dues clear — ready to issue.
              </p>
            ) : (
              <div className="rounded-xs border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-rose-800">
                <p className="inline-flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="h-3.5 w-3.5" /> Blocked:
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
                <label className="mb-1 block text-xs font-medium text-ink-700">Override reason (required to waive dues — audited)</label>
                <input className={INPUT} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. Principal-approved hardship waiver" />
              </div>
            )}
            <button
              type="button"
              className={BTN}
              disabled={busy !== null || (!clearance.canIssueTc && overrideReason.trim().length < 3)}
              onClick={issueTc}
            >
              {busy === "tc" ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Issuing…</span>
              ) : (
                <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {clearance.canIssueTc ? "Issue Transfer Certificate" : "Issue TC (waive dues)"}</span>
              )}
            </button>
          </div>
        )}

        <p className="mt-3 text-xs text-ink-500">
          Looking for the full directory, profile and per-row TC actions?{" "}
          <Link href="/admin/admissions/students" className="font-semibold text-brand-700 hover:underline">
            Open Students Directory →
          </Link>
        </p>
      </DashCard>
    </div>
  );
}
