"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Save } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import DatePickerField, { todayISO } from "@/components/ui/DatePicker";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { AdmissionApplication, AdmissionCampaign } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const GENDERS = ["MALE", "FEMALE", "OTHER"].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() }));
const STATUSES = ["APPLIED", "SHORTLISTED", "WAITING", "ADMITTED", "REJECTED"];
const STATUS_BADGE: Record<string, string> = {
  APPLIED: "bg-slate-200 text-slate-700",
  SHORTLISTED: "bg-sky-100 text-sky-800",
  WAITING: "bg-amber-100 text-amber-800",
  ADMITTED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-700",
};

/**
 * Phase 2 — Applications Pipeline (Plan Phase 2). Intake → form-fee (44102) →
 * bulk test marks + merit rank → status → convert-to-draft into the wizard.
 */
export default function ApplicationsView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<AdmissionCampaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState("");
  const [apps, setApps] = useState<AdmissionApplication[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  // intake form
  const [fName, setFName] = useState("");
  const [fGender, setFGender] = useState("");
  const [fDob, setFDob] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fExam, setFExam] = useState("");
  const [fGpa, setFGpa] = useState("");
  const [fQuota, setFQuota] = useState("");

  const loadCampaigns = useCallback(async () => {
    try {
      setCampaigns(await apiFetch<AdmissionCampaign[]>("/api/admissions/campaigns"));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load campaigns", "error");
    }
  }, []);

  const loadApps = useCallback(async (cid: string, st: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cid) params.set("campaignId", cid);
      if (st) params.set("status", st);
      const data = await apiFetch<AdmissionApplication[]>(`/api/admissions/applications?${params.toString()}`);
      setApps(data);
      setMarks(Object.fromEntries(data.map((a) => [a.id, a.admissionTestMarks])));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load applications", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);
  useEffect(() => {
    loadApps(campaignId, status);
  }, [campaignId, status, loadApps]);

  async function submitIntake() {
    const cid = campaignId;
    if (!cid) {
      toast("Select a campaign first (filter above doubles as the intake campaign)", "error");
      return;
    }
    if (!fName.trim() || !fGender || !fDob || !fPhone.trim()) {
      toast("Name, gender, DOB and guardian phone are required", "error");
      return;
    }
    setActing("intake");
    try {
      await apiFetch("/api/admissions/applications", {
        method: "POST",
        body: JSON.stringify({
          campaignId: cid,
          applicantNameEn: fName.trim(),
          gender: fGender,
          dateOfBirth: fDob,
          guardianPhone: fPhone.trim(),
          prevExamName: fExam.trim() || null,
          prevGpa: fGpa.trim() || null,
          quotaApplied: fQuota.trim() || null,
        }),
      });
      toast("Application submitted", "success");
      setFName(""); setFGender(""); setFDob(""); setFPhone(""); setFExam(""); setFGpa(""); setFQuota("");
      setShowIntake(false);
      await loadApps(cid, status);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Submit failed (eligibility GPA may block)", "error");
    } finally {
      setActing(null);
    }
  }

  async function saveMarks() {
    if (!campaignId) {
      toast("Select a campaign to rank", "error");
      return;
    }
    const changed = apps.filter((a) => (marks[a.id] ?? "").trim() !== a.admissionTestMarks);
    if (changed.length === 0) {
      toast("No mark changes to save", "error");
      return;
    }
    setActing("marks");
    try {
      const ranked = await apiFetch<AdmissionApplication[]>("/api/admissions/applications/test-marks", {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          marks: changed.map((a) => ({ applicationId: a.id, marks: marks[a.id].trim() })),
        }),
      });
      setApps(ranked);
      setMarks(Object.fromEntries(ranked.map((a) => [a.id, a.admissionTestMarks])));
      toast(`Marks saved — merit ranks recalculated (${ranked.filter((a) => a.meritRank).length} ranked)`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function setAppStatus(id: string, next: string) {
    setActing(id);
    try {
      const updated = await apiFetch<AdmissionApplication>(`/api/admissions/applications/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Status change failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function collectFee(id: string) {
    setActing(id);
    try {
      await apiFetch(`/api/admissions/applications/${id}/form-fee`, {
        method: "POST",
        body: JSON.stringify({ paymentChannel: "CASH", remark: "Counter form-fee collection" }),
      });
      toast("Form fee collected → GL 44102", "success");
      await loadApps(campaignId, status);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Collection failed", "error");
    } finally {
      setActing(null);
    }
  }

  if (loading && apps.length === 0) return <AdminPageLoader />;

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Applications Pipeline"
        description="Applicant pipeline, admission test marks entry, merit & waiting list"
      />
      <DashCard title="Filter applications">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0 2xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-700">Campaign (also the intake target)</label>
            <SearchSelect
              options={campaigns.map((c) => ({ value: c.id, label: `${c.campaignTitle} · min GPA ${c.minRequiredGpa}` }))}
              value={campaignId}
              onChange={setCampaignId}
              placeholder="All campaigns…"
              isClearable
              ariaLabel="Campaign filter"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Status</label>
            <SearchSelect
              options={STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
              value={status}
              onChange={setStatus}
              placeholder="All…"
              isClearable
              ariaLabel="Status filter"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-3">
            <button type="button" className={BTN} onClick={() => setShowIntake((v) => !v)}>
              <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New application</span>
            </button>
            <button type="button" className={BTN_GHOST} disabled={acting !== null} onClick={saveMarks}>
              <span className="inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save marks + rank</span>
            </button>
          </div>
        </div>
      </DashCard>

      {showIntake && (
        <DashCard title="Walk-in / online intake (eligibility-gated at submit)">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
            <div className="min-w-0 2xl:col-span-2">
              <label className="mb-1 block text-xs font-medium text-ink-700">Applicant name (EN)</label>
              <input className={INPUT} value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. Arif Hossain" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-ink-700">Gender</label>
              <SearchSelect options={GENDERS} value={fGender} onChange={setFGender} placeholder="Select…" ariaLabel="Gender" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-ink-700">Date of birth</label>
              <DatePickerField value={fDob} onChange={setFDob} maxDate={todayISO()} placeholder="Select DOB" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-ink-700">Guardian phone</label>
              <input className={INPUT} value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-ink-700">Prev exam (e.g. SSC)</label>
              <input className={INPUT} value={fExam} onChange={(e) => setFExam(e.target.value)} />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-ink-700">Prev GPA</label>
              <input className={INPUT} value={fGpa} onChange={(e) => setFGpa(e.target.value)} placeholder="e.g. 5.00" inputMode="decimal" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-ink-700">Quota (optional)</label>
              <input className={INPUT} value={fQuota} onChange={(e) => setFQuota(e.target.value)} placeholder="SIBLING / ORPHAN_LILLAH…" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-2">
              <button type="button" className={BTN} disabled={acting !== null} onClick={submitIntake}>
                {acting === "intake" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">Submit (APP number issued)</span>
                )}
              </button>
            </div>
          </div>
        </DashCard>
      )}

      <DashCard title={`Applicants (${apps.length})`}>
        {apps.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">No applications — submit the first one above.</p>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Application</th>
                  <th className="px-2.5 py-1.5 font-semibold">Prev / GPA</th>
                  <th className="px-2.5 py-1.5 font-semibold">Test marks</th>
                  <th className="px-2.5 py-1.5 font-semibold">Rank</th>
                  <th className="px-2.5 py-1.5 font-semibold">Fee</th>
                  <th className="px-2.5 py-1.5 font-semibold">Status</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {apps.map((a) => (
                  <tr key={a.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1">
                      <span className="font-mono font-semibold">{a.applicationNo}</span>
                      <span className="block font-medium">{a.applicantNameEn}</span>
                      <span className="block font-mono text-ink-500">{a.guardianPhone}</span>
                    </td>
                    <td className="px-2.5 py-1 font-mono">{a.prevExamName ?? "—"} {a.prevGpa ? `· ${a.prevGpa}` : ""}</td>
                    <td className="px-2.5 py-1">
                      <input
                        className={`${INPUT} !w-24 text-right font-mono`}
                        value={marks[a.id] ?? ""}
                        inputMode="decimal"
                        onChange={(e) => setMarks((m) => ({ ...m, [a.id]: e.target.value }))}
                      />
                    </td>
                    <td className="px-2.5 py-1 font-mono font-bold">{a.meritRank ?? "—"}</td>
                    <td className="px-2.5 py-1">
                      {a.formFeePaid ? (
                        <span className="rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">PAID</span>
                      ) : (
                        <button type="button" className={BTN_GHOST} disabled={acting !== null} onClick={() => collectFee(a.id)}>
                          Collect
                        </button>
                      )}
                    </td>
                    <td className="px-2.5 py-1">
                      <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[a.status]}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-1">
                      <div className="flex flex-wrap gap-1">
                        {["SHORTLISTED", "WAITING", "REJECTED"].filter((s) => s !== a.status).map((s) => (
                          <button key={s} type="button" className={BTN_GHOST} disabled={acting !== null} onClick={() => setAppStatus(a.id, s)}>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </button>
                        ))}
                        {(a.status === "APPLIED" || a.status === "SHORTLISTED" || a.status === "WAITING") && (
                          <button
                            type="button"
                            className={BTN_GHOST}
                            onClick={() => router.push(`/admin/admissions/direct-admission?query=${encodeURIComponent(a.guardianPhone)}&draft=${a.id}`)}
                            title="Pre-fill the wizard from this applicant"
                          >
                            <span className="inline-flex items-center gap-1">Convert <ArrowRight className="h-3 w-3" /></span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>
    </div>
  );
}
