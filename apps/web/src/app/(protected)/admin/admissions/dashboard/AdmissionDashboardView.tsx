"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, Wallet } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { AdmissionDashboardOverview } from "@/lib/admissions";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const STATUS_BADGE: Record<string, string> = {
  APPLIED: "bg-sky-100 text-sky-800",
  SHORTLISTED: "bg-amber-100 text-amber-800",
  WAITING: "bg-violet-100 text-violet-800",
  ADMITTED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-700",
};

const STATUS_BAR: Record<string, string> = {
  APPLIED: "bg-sky-500",
  SHORTLISTED: "bg-amber-500",
  WAITING: "bg-violet-500",
  ADMITTED: "bg-emerald-500",
  REJECTED: "bg-rose-500",
};

/**
 * Phase 2/5 — Admission Dashboard (Plan §2 dashboard).
 * Seat capacity vs admitted per campaign, the application funnel, today's
 * admissions feed, and the pending admission-fee list.
 */
export default function AdmissionDashboardView() {
  const [data, setData] = useState<AdmissionDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<AdmissionDashboardOverview>("/api/admissions/dashboard"));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load dashboard", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const k = data?.kpis;

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Admission Dashboard"
        description="Plan §2 — seat capacity vs admitted, today's admissions, pending admission fees"
      />

      {loading && !data ? (
        <AdminPageLoader />
      ) : !data || !k ? (
        <p className="py-10 text-center text-sm text-ink-400">Dashboard data unavailable — retry.</p>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Seats filled" value={`${k.fillPct}%`} tone="text-brand-700" sub={`${k.totalEnrolled} of ${k.totalSeats} seats`} />
            <Tile label="Seats remaining" value={String(k.seatsRemaining)} sub={`${k.activeCampaigns} active campaign${k.activeCampaigns === 1 ? "" : "s"}`} />
            <Tile label="Applications" value={String(k.totalApplications)} sub="all campaigns" />
            <Tile label="Today's admissions" value={String(k.todayAdmissions)} tone="text-emerald-700" sub={data.today} />
            <Tile label="Pending admission fees" value={String(k.pendingFeeCount)} tone={k.pendingFeeCount > 0 ? "text-rose-700" : "text-ink-900"} sub="invoices with balance" />
            <Tile label="Outstanding (BDT)" value={k.pendingFeeAmount} tone={k.pendingFeeCount > 0 ? "text-rose-700" : "text-ink-900"} sub="admission invoices" />
            <Tile label="Admitted (apps)" value={String(data.applicationStatus.find((s) => s.status === "ADMITTED")?.count ?? 0)} sub="marked ADMITTED" />
            <Tile label="Waiting list" value={String(data.applicationStatus.find((s) => s.status === "WAITING")?.count ?? 0)} tone="text-amber-700" sub="queued applicants" />
          </div>

          {/* Seat capacity vs admitted */}
          <DashCard
            title="Seat capacity vs admitted"
            action={
              <button type="button" className={BTN_GHOST} disabled={loading} onClick={load}>
                {loading ? (
                  <span className="inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Refresh</span>
                )}
              </button>
            }
          >
            {data.campaigns.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                No campaigns yet — create one under Campaigns &amp; Circulars.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xs border border-ink-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Campaign</th>
                      <th className="px-2.5 py-1.5 font-semibold">Window</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Seats</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Applications</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Admitted</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Enrolled</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Remaining</th>
                      <th className="px-2.5 py-1.5 font-semibold">Fill</th>
                      <th className="px-2.5 py-1.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {data.campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-ink-50">
                        <td className="px-2.5 py-1">
                          <span className="font-medium">{c.campaignTitle}</span>
                          <span className="block font-mono text-ink-500" title={`${c.academicSessionId} · ${c.classOrDeptId}`}>
                            {c.academicSessionId.slice(0, 8)} · {c.classOrDeptId.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-2.5 py-1 text-ink-600">
                          {c.startDate} → {c.endDate}
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono">{c.totalSeats}</td>
                        <td className="px-2.5 py-1 text-right font-mono">{c.applications}</td>
                        <td className="px-2.5 py-1 text-right font-mono">{c.admitted}</td>
                        <td className="px-2.5 py-1 text-right font-mono font-semibold">{c.enrolled}</td>
                        <td className={`px-2.5 py-1 text-right font-mono ${c.remaining === 0 ? "font-bold text-rose-700" : "text-ink-600"}`}>
                          {c.remaining}
                        </td>
                        <td className="px-2.5 py-1">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-xs bg-ink-100">
                              <div
                                className={`h-full ${c.fillPct >= 100 ? "bg-rose-500" : c.fillPct >= 80 ? "bg-amber-500" : "bg-brand-500"}`}
                                style={{ width: `${Math.min(100, c.fillPct)}%` }}
                              />
                            </div>
                            <span className="font-mono text-ink-600">{c.fillPct}%</span>
                          </div>
                        </td>
                        <td className="px-2.5 py-1">
                          <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${c.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                            {c.isActive ? "ACTIVE" : "CLOSED"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Application funnel */}
            <DashCard title="Application funnel">
              {k.totalApplications === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">No applications yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.applicationStatus.map((s) => (
                    <li key={s.status}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[s.status] ?? "bg-slate-200 text-slate-600"}`}>
                          {s.status}
                        </span>
                        <span className="font-mono text-ink-600">
                          {s.count}
                          <span className="text-ink-400"> · {k.totalApplications > 0 ? Math.round((s.count / k.totalApplications) * 100) : 0}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-xs bg-ink-100">
                        <div
                          className={`h-full ${STATUS_BAR[s.status] ?? "bg-slate-400"}`}
                          style={{ width: `${k.totalApplications > 0 ? (s.count / k.totalApplications) * 100 : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DashCard>

            {/* Today's admissions */}
            <DashCard title={`Today's admissions (${data.todayAdmissions.length})`} className="lg:col-span-2">
              {data.todayAdmissions.length === 0 ? (
                <p className="inline-flex items-center gap-1.5 py-6 text-sm text-ink-400">
                  <CalendarDays className="h-4 w-4" /> No admissions recorded today ({data.today}).
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xs border border-ink-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 text-ink-700">
                      <tr>
                        <th className="px-2.5 py-1.5 font-semibold">Student</th>
                        <th className="px-2.5 py-1.5 font-semibold">Gender</th>
                        <th className="px-2.5 py-1.5 font-semibold">Class / Section</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Roll</th>
                        <th className="px-2.5 py-1.5 font-semibold">Group</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 bg-white">
                      {data.todayAdmissions.map((s) => (
                        <tr key={s.studentId} className="hover:bg-ink-50">
                          <td className="px-2.5 py-1">
                            <span className="font-medium">{s.fullNameEn}</span>
                            <span className="block font-mono text-ink-500">{s.studentUniqueId}</span>
                          </td>
                          <td className="px-2.5 py-1 text-ink-600">{s.gender}</td>
                          <td className="px-2.5 py-1 font-mono text-ink-500" title={`${s.classOrDeptId ?? "—"} · ${s.sectionOrBatchId ?? "no section"}`}>
                            {s.classOrDeptId ? `${s.classOrDeptId.slice(0, 8)} · ${s.sectionOrBatchId?.slice(0, 8) ?? "—"}` : "—"}
                          </td>
                          <td className="px-2.5 py-1 text-right font-mono">{s.classRollNo ?? "—"}</td>
                          <td className="px-2.5 py-1">{s.academicGroup ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DashCard>
          </div>

          {/* Pending admission fees */}
          <DashCard
            title={`Pending admission fees (${data.pendingFees.length})`}
            action={
              k.pendingFeeAmount !== "0.00" ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                  <Wallet className="h-3.5 w-3.5" /> {k.pendingFeeAmount} BDT outstanding
                </span>
              ) : undefined
            }
          >
            {data.pendingFees.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                No outstanding admission invoices — every admitted student is settled.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xs border border-ink-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Invoice</th>
                      <th className="px-2.5 py-1.5 font-semibold">Student</th>
                      <th className="px-2.5 py-1.5 font-semibold">Period</th>
                      <th className="px-2.5 py-1.5 font-semibold">Due</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Net</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Paid</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {data.pendingFees.map((f) => (
                      <tr key={f.invoiceId} className="hover:bg-ink-50">
                        <td className="px-2.5 py-1 font-mono font-medium">{f.invoiceNo}</td>
                        <td className="px-2.5 py-1">
                          <span className="font-medium">{f.fullNameEn}</span>
                          <span className="block font-mono text-ink-500">{f.studentUniqueId}</span>
                        </td>
                        <td className="px-2.5 py-1 font-mono text-ink-500">{f.billingPeriod}</td>
                        <td className="px-2.5 py-1">
                          <span className="font-mono text-ink-600">{f.dueDate}</span>
                          {f.overdue && (
                            <span className="ml-1 rounded-xs bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">OVERDUE</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono">{f.netAmount}</td>
                        <td className="px-2.5 py-1 text-right font-mono text-ink-500">{f.paidAmount}</td>
                        <td className="px-2.5 py-1 text-right font-mono font-bold text-rose-700">{f.outstanding}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashCard>

          <p className="text-right text-[11px] text-ink-400">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xs border border-ink-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase text-ink-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${tone ?? "text-ink-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-ink-400" title={sub}>{sub}</p>}
    </div>
  );
}
