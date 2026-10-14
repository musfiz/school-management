"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  Undo2,
  Activity,
  LayoutDashboard,
  Download,
  Printer,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import DatePickerField from "@/components/ui/DatePicker";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import { printElement } from "@/lib/print";
import { downloadCsv } from "@/lib/reports";
import {
  SOURCE_MODULE_LABELS,
  VOUCHER_STATUSES,
  VOUCHER_TYPES,
  SOURCE_MODULES,
  AUDIT_EVENT_TYPES,
  type AuditActivityLog,
  type AuditSummary,
  type ReversalRegistryItem,
  type SourceModuleStat,
  type VoucherAuditItem,
} from "@/lib/audit";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const TABS = [
  { id: "overview", label: "Overview & Compliance", icon: LayoutDashboard },
  { id: "vouchers", label: "Voucher Lifecycle", icon: FileText },
  { id: "reversals", label: "Reversal Registry", icon: Undo2 },
  { id: "activity", label: "Activity Stream", icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-200 text-slate-700",
  VERIFIED: "bg-sky-100 text-sky-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REVERSED: "bg-rose-100 text-rose-700",
};

const fmtMoney = (val: string | number | undefined | null) => {
  if (val == null || val === "") return "0.00";
  const num = typeof val === "number" ? val : parseFloat(val);
  return isNaN(num)
    ? "0.00"
    : num.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (val?: string | null) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val).slice(0, 10);
  return d.toISOString().slice(0, 10);
};

const fmtDateTime = (val?: string | null) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AuditTrailView() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [sourceModules, setSourceModules] = useState<SourceModuleStat[]>([]);

  // Voucher trail filters
  const [vStatus, setVStatus] = useState("");
  const [vType, setVType] = useState("");
  const [vModule, setVModule] = useState("");
  const [vStart, setVStart] = useState("");
  const [vEnd, setVEnd] = useState("");
  const [vSearch, setVSearch] = useState("");
  const [vouchers, setVouchers] = useState<VoucherAuditItem[]>([]);
  const [vLoading, setVLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Reversals
  const [reversals, setReversals] = useState<ReversalRegistryItem[]>([]);
  const [rLoading, setRLoading] = useState(false);

  // Activity logs
  const [eventType, setEventType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [logStart, setLogStart] = useState("");
  const [logEnd, setLogEnd] = useState("");
  const [logs, setLogs] = useState<AuditActivityLog[]>([]);
  const [lLoading, setLLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        apiFetch<AuditSummary>("/api/accounting/audit/summary"),
        apiFetch<SourceModuleStat[]>("/api/accounting/audit/source-modules"),
      ]);
      setSummary(s);
      setSourceModules(Array.isArray(m) ? m : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load audit summary", "error");
    }
  }, []);

  const loadVouchers = useCallback(async () => {
    setVLoading(true);
    try {
      const params = new URLSearchParams();
      if (vStatus) params.set("status", vStatus);
      if (vType) params.set("voucherType", vType);
      if (vModule) params.set("sourceModule", vModule);
      if (vStart) params.set("startDate", vStart);
      if (vEnd) params.set("endDate", vEnd);
      if (vSearch.trim()) params.set("search", vSearch.trim());
      params.set("limit", "200");
      const data = await apiFetch<{ total: number; items: VoucherAuditItem[] }>(
        `/api/accounting/audit/vouchers?${params.toString()}`,
      );
      setVouchers(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load voucher trail", "error");
    } finally {
      setVLoading(false);
    }
  }, [vStatus, vType, vModule, vStart, vEnd, vSearch]);

  const loadReversals = useCallback(async () => {
    setRLoading(true);
    try {
      const data = await apiFetch<{ total: number; items: ReversalRegistryItem[] }>(
        "/api/accounting/audit/reversals",
      );
      setReversals(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load reversal registry", "error");
    } finally {
      setRLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventType) params.set("eventType", eventType);
      if (entityType) params.set("entityType", entityType);
      if (logStart) params.set("startDate", logStart);
      if (logEnd) params.set("endDate", logEnd);
      params.set("limit", "200");
      const data = await apiFetch<{ total: number; items: AuditActivityLog[] }>(
        `/api/accounting/audit/logs?${params.toString()}`,
      );
      setLogs(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load activity stream", "error");
    } finally {
      setLLoading(false);
    }
  }, [eventType, entityType, logStart, logEnd]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadOverview(), loadVouchers(), loadReversals(), loadLogs()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced voucher search
  useEffect(() => {
    const t = setTimeout(() => {
      if (!loading) loadVouchers();
    }, vSearch ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vStatus, vType, vModule, vStart, vEnd, vSearch]);

  useEffect(() => {
    if (!loading && activeTab === "activity") loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, entityType, logStart, logEnd, activeTab]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const nonCompliant = useMemo(
    () => vouchers.filter((v) => !v.isSeparationCompliant),
    [vouchers],
  );

  const exportVouchersCsv = () => {
    if (vouchers.length === 0) {
      toast("No voucher rows to export", "warning");
      return;
    }
    downloadCsv(
      `Voucher_Audit_Trail_${new Date().toISOString().slice(0, 10)}`,
      vouchers.map((v) => ({
        "Voucher No": v.voucherNo,
        Type: v.voucherType,
        Date: fmtDate(v.transactionDate),
        Module: v.sourceModule,
        Narration: v.narration,
        Status: v.status,
        Amount: v.totalAmount,
        Maker: v.maker?.name ?? "",
        Checker: v.checker?.name ?? "",
        Approver: v.approver?.name ?? "",
        Compliant: v.isSeparationCompliant ? "YES" : "NO",
      })),
    );
  };

  const exportLogsCsv = () => {
    if (logs.length === 0) {
      toast("No activity rows to export", "warning");
      return;
    }
    downloadCsv(
      `Audit_Activity_Stream_${new Date().toISOString().slice(0, 10)}`,
      logs.map((l) => ({
        Time: l.createdAt,
        Event: l.eventType,
        Entity: l.entityType,
        Reference: l.entityReference ?? l.entityId,
        Actor: l.actor?.name ?? "",
        Role: l.actor?.role ?? "",
        Action: l.action,
        Details: l.details ?? "",
      })),
    );
  };

  if (loading) return <AdminPageLoader />;

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Audit Trail & Governance"
        description="Spec §1.7 — immutable Maker → Checker → Approver lifecycle, no-delete reversal registry, automated vs manual posting split, and chronological system event stream."
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-100 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-xs px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div id="printable-audit-area">
        {activeTab === "overview" && summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Total Vouchers", value: String(summary.totalVouchers) },
                { label: "Approved", value: String(summary.approvedVouchers) },
                { label: "Verified (Checker)", value: String(summary.verifiedVouchers) },
                { label: "Draft (Maker only)", value: String(summary.draftVouchers) },
                { label: "Reversed", value: String(summary.reversedVouchers) },
                { label: "Reversal Rate", value: summary.reversalRate },
              ].map((k) => (
                <div key={k.label} className="rounded-xs border border-ink-200 bg-white p-3">
                  <div className="text-[11px] font-medium uppercase text-ink-500">{k.label}</div>
                  <div className="mt-1 font-mono text-lg font-bold text-navy-900">{k.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <DashCard title="Approved Volume">
                <div className="font-mono text-2xl font-bold text-emerald-800">
                  {fmtMoney(summary.totalApprovedVolume)} BDT
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  Sum of approved debit postings across all funds.
                </p>
              </DashCard>
              <DashCard title="Separation of Duties">
                <div
                  className={`flex items-center gap-1.5 text-sm font-bold ${
                    summary.separationOfDutiesViolations > 0 || nonCompliant.length > 0
                      ? "text-rose-700"
                      : "text-emerald-700"
                  }`}
                >
                  {summary.separationOfDutiesViolations > 0 || nonCompliant.length > 0 ? (
                    <ShieldAlert className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span>
                    {summary.separationOfDutiesViolations} system violations
                    {nonCompliant.length > 0 ? ` · ${nonCompliant.length} in current filter` : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  Maker, checker and approver must be distinct users (Phase 2 enforcement).
                </p>
              </DashCard>
              <DashCard title="Compliance Status">
                <span className="rounded-xs bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  {summary.complianceStatus}
                </span>
                <p className="mt-2 text-xs text-ink-500">
                  No-delete policy: posted vouchers change only via linked REVERSAL entries.
                </p>
              </DashCard>
            </div>

            <DashCard title="Automated vs Manual Postings by Source Module">
              <div className="overflow-x-auto rounded-xs border border-ink-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Source Module</th>
                      <th className="px-2.5 py-1.5 font-semibold">Description</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Vouchers</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Approved Volume (BDT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {sourceModules.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-ink-400">
                          No approved postings yet.
                        </td>
                      </tr>
                    ) : (
                      sourceModules.map((m) => (
                        <tr key={m.key} className="hover:bg-ink-50">
                          <td className="px-2.5 py-1 font-mono font-medium text-ink-900">{m.key}</td>
                          <td className="px-2.5 py-1 text-ink-700">
                            <span className="font-medium">{m.name}</span>
                            <span className="block text-[11px] text-ink-400">{m.description}</span>
                          </td>
                          <td className="px-2.5 py-1 text-right font-mono">{m.voucherCount}</td>
                          <td className="px-2.5 py-1 text-right font-mono font-semibold">
                            {fmtMoney(m.totalVolume)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </DashCard>
          </div>
        )}

        {activeTab === "vouchers" && (
          <div className="space-y-4">
            <DashCard title="Filter Voucher Lifecycle">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Status</label>
                  <select value={vStatus} onChange={(e) => setVStatus(e.target.value)} className={INPUT}>
                    <option value="">All Statuses</option>
                    {VOUCHER_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Voucher Type</label>
                  <select value={vType} onChange={(e) => setVType(e.target.value)} className={INPUT}>
                    <option value="">All Types</option>
                    {VOUCHER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Source Module</label>
                  <select value={vModule} onChange={(e) => setVModule(e.target.value)} className={INPUT}>
                    <option value="">All Modules</option>
                    {SOURCE_MODULES.map((m) => (
                      <option key={m} value={m}>
                        {m} — {SOURCE_MODULE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Search</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                    <input
                      value={vSearch}
                      onChange={(e) => setVSearch(e.target.value)}
                      placeholder="Voucher no / narration…"
                      className={`${INPUT} pl-7`}
                    />
                  </div>
                </div>
                <DatePickerField
                  label="From"
                  value={vStart}
                  onChange={setVStart}
                  placeholder="From date"
                  maxDate={vEnd || undefined}
                />
                <DatePickerField
                  label="To"
                  value={vEnd}
                  onChange={setVEnd}
                  placeholder="To date"
                  minDate={vStart || undefined}
                />
                <div className="flex items-center gap-1.5 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => loadVouchers()}
                    className="cursor-pointer rounded-xs bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600"
                  >
                    Run Query
                  </button>
                  <button
                    type="button"
                    onClick={exportVouchersCsv}
                    className="flex cursor-pointer items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  >
                    <Download className="h-3 w-3" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        printElement("printable-audit-area", "Voucher Audit Trail");
                      } catch (e) {
                        toast(e instanceof Error ? e.message : "Print failed", "error");
                      }
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  >
                    <Printer className="h-3 w-3" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVStatus(""); setVType(""); setVModule("");
                      setVStart(""); setVEnd(""); setVSearch("");
                    }}
                    className="cursor-pointer rounded-xs bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-200"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </DashCard>

            <DashCard
              title={`Maker → Checker → Approver Chain (${vouchers.length} vouchers)`}
              action={
                nonCompliant.length > 0 ? (
                  <span className="rounded-xs bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                    {nonCompliant.length} separation violation(s)
                  </span>
                ) : (
                  <span className="rounded-xs bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    All compliant
                  </span>
                )
              }
            >
              {vLoading ? (
                <AdminPageLoader />
              ) : (
                <div className="overflow-x-auto rounded-xs border border-ink-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 text-ink-700">
                      <tr>
                        <th className="px-2.5 py-1.5 font-semibold" />
                        <th className="px-2.5 py-1.5 font-semibold">Voucher</th>
                        <th className="px-2.5 py-1.5 font-semibold">Module</th>
                        <th className="px-2.5 py-1.5 font-semibold">Maker</th>
                        <th className="px-2.5 py-1.5 font-semibold">Checker</th>
                        <th className="px-2.5 py-1.5 font-semibold">Approver</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Amount</th>
                        <th className="px-2.5 py-1.5 font-semibold">Status</th>
                        <th className="px-2.5 py-1.5 font-semibold">SoD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 bg-white">
                      {vouchers.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-ink-400">
                            No vouchers match the current filters.
                          </td>
                        </tr>
                      ) : (
                        vouchers.map((v) => {
                          const open = expanded.has(v.id);
                          return (
                            <>
                              <tr key={v.id} className="hover:bg-ink-50">
                                <td className="px-1.5 py-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(v.id)}
                                    className="cursor-pointer rounded-xs p-0.5 text-ink-500 hover:bg-ink-100"
                                    aria-label={open ? "Collapse" : "Expand"}
                                  >
                                    {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  </button>
                                </td>
                                <td className="px-2.5 py-1">
                                  <span className="font-mono font-medium text-ink-900">{v.voucherNo}</span>
                                  <span className="block text-[10px] text-ink-400">
                                    {v.voucherType} · {fmtDate(v.transactionDate)}
                                  </span>
                                </td>
                                <td className="px-2.5 py-1">
                                  <span className="rounded-xs bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-700">
                                    {v.sourceModule}
                                  </span>
                                </td>
                                <td className="px-2.5 py-1 text-ink-800">
                                  {v.maker?.name}
                                  <span className="block text-[10px] text-ink-400">{fmtDateTime(v.maker?.at)}</span>
                                </td>
                                <td className="px-2.5 py-1 text-ink-800">
                                  {v.checker ? (
                                    <>
                                      {v.checker.name}
                                      <span className="block text-[10px] text-ink-400">{fmtDateTime(v.checker.at)}</span>
                                    </>
                                  ) : (
                                    <span className="text-ink-300">— pending —</span>
                                  )}
                                </td>
                                <td className="px-2.5 py-1 text-ink-800">
                                  {v.approver ? (
                                    <>
                                      {v.approver.name}
                                      <span className="block text-[10px] text-ink-400">{fmtDateTime(v.approver.at)}</span>
                                    </>
                                  ) : (
                                    <span className="text-ink-300">— pending —</span>
                                  )}
                                </td>
                                <td className="px-2.5 py-1 text-right font-mono font-semibold">{fmtMoney(v.totalAmount)}</td>
                                <td className="px-2.5 py-1">
                                  <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[v.status] ?? "bg-ink-100 text-ink-700"}`}>
                                    {v.status}
                                  </span>
                                </td>
                                <td className="px-2.5 py-1">
                                  {v.isSeparationCompliant ? (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                                      <ShieldCheck className="h-3 w-3" /> OK
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-700">
                                      <ShieldAlert className="h-3 w-3" /> VIOLATION
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {open && (
                                <tr key={`${v.id}-detail`} className="bg-ink-50/50">
                                  <td />
                                  <td colSpan={8} className="px-2.5 py-2 text-xs text-ink-700">
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                      <div>
                                        <div className="text-[10px] font-semibold uppercase text-ink-500">Narration</div>
                                        <div className="mt-0.5">{v.narration}</div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-semibold uppercase text-ink-500">Actor emails / roles</div>
                                        <div className="mt-0.5 space-y-0.5 text-[11px]">
                                          <div>Maker: {v.maker?.email || "—"} ({v.maker?.role || "MAKER"})</div>
                                          <div>Checker: {v.checker?.email || "—"} ({v.checker?.role || "—"})</div>
                                          <div>Approver: {v.approver?.email || "—"} ({v.approver?.role || "—"})</div>
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-semibold uppercase text-ink-500">References</div>
                                        <div className="mt-0.5 space-y-0.5 font-mono text-[11px]">
                                          <div>ID: {v.id}</div>
                                          {v.sourceReferenceId && <div>Source ref: {v.sourceReferenceId}</div>}
                                          {v.reversedEntryId && <div>Reversed entry: {v.reversedEntryId}</div>}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </DashCard>
          </div>
        )}

        {activeTab === "reversals" && (
          <DashCard
            title={`Immutable Reversal Registry (${reversals.length}) — No-Delete Policy`}
            action={
              <button
                type="button"
                onClick={() => {
                  try {
                    printElement("printable-audit-area", "Reversal Registry");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Print failed", "error");
                  }
                }}
                className="flex cursor-pointer items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
              >
                <Printer className="h-3 w-3" />
                <span>Print</span>
              </button>
            }
          >
            {rLoading ? (
              <AdminPageLoader />
            ) : reversals.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                No reversals recorded. Corrections to approved vouchers must create a linked REVERSAL entry — originals are never edited or deleted.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xs border border-ink-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Reversal Voucher</th>
                      <th className="px-2.5 py-1.5 font-semibold">Date</th>
                      <th className="px-2.5 py-1.5 font-semibold">Reason (Narration)</th>
                      <th className="px-2.5 py-1.5 font-semibold">Reversed By</th>
                      <th className="px-2.5 py-1.5 font-semibold">Original Voucher</th>
                      <th className="px-2.5 py-1.5 font-semibold">Original Maker / Approver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {reversals.map((r) => (
                      <tr key={r.reversalVoucherId} className="hover:bg-ink-50">
                        <td className="px-2.5 py-1 font-mono font-medium text-rose-700">{r.reversalVoucherNo}</td>
                        <td className="px-2.5 py-1 text-ink-700">{fmtDate(r.reversalDate)}</td>
                        <td className="px-2.5 py-1 text-ink-700">{r.reversalReason}</td>
                        <td className="px-2.5 py-1 text-ink-800">
                          {r.reverser?.name}
                          <span className="block text-[10px] text-ink-400">
                            {r.reverser?.role || ""} · {fmtDateTime(r.reverser?.at)}
                          </span>
                        </td>
                        <td className="px-2.5 py-1">
                          {r.originalVoucher ? (
                            <>
                              <span className="font-mono font-medium text-ink-900">{r.originalVoucher.voucherNo}</span>
                              <span className="block text-[10px] text-ink-400">
                                {r.originalVoucher.voucherType} · {fmtDate(r.originalVoucher.transactionDate)}
                              </span>
                              <span className="block text-[11px] text-ink-500">{r.originalVoucher.narration}</span>
                            </>
                          ) : (
                            <span className="text-ink-300">— unlinked —</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1 text-[11px] text-ink-600">
                          {r.originalVoucher ? (
                            <>
                              <div>Maker: {r.originalVoucher.makerName}</div>
                              <div>Approver: {r.originalVoucher.approverName}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashCard>
        )}

        {activeTab === "activity" && (
          <div className="space-y-4">
            <DashCard title="Filter Activity Stream">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5 items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Event Type</label>
                  <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={INPUT}>
                    <option value="">All Events</option>
                    {AUDIT_EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Entity Type</label>
                  <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={INPUT}>
                    <option value="">All Entities</option>
                    {["JOURNAL_ENTRY", "STUDENT_INVOICE", "PAYMENT_COLLECTION", "VENDOR_BILL", "TAX_CHALLAN", "PAYROLL_RUN"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <DatePickerField
                  label="From"
                  value={logStart}
                  onChange={setLogStart}
                  placeholder="From date"
                  maxDate={logEnd || undefined}
                />
                <DatePickerField
                  label="To"
                  value={logEnd}
                  onChange={setLogEnd}
                  placeholder="To date"
                  minDate={logStart || undefined}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadLogs()}
                    className="cursor-pointer rounded-xs bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600"
                  >
                    Run Query
                  </button>
                  <button
                    type="button"
                    onClick={exportLogsCsv}
                    className="flex cursor-pointer items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  >
                    <Download className="h-3 w-3" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>
            </DashCard>

            <DashCard title={`Chronological Activity Stream (${logs.length} events)`}>
              {lLoading ? (
                <AdminPageLoader />
              ) : logs.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">No audit events match the current filters.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-ink-200 pl-4">
                  {logs.map((l) => (
                    <li key={l.id} className="rounded-xs border border-ink-100 bg-white p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-xs bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-800">
                          {l.eventType}
                        </span>
                        <span className="rounded-xs bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-700">
                          {l.entityType}
                        </span>
                        <span className="font-mono text-[11px] text-ink-500">
                          {l.entityReference || l.entityId}
                        </span>
                        <span className="ml-auto text-[11px] text-ink-400">{fmtDateTime(l.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-xs text-ink-700">
                        <span className="font-medium">{l.actor?.name || "System"}</span>
                        {l.actor?.role && <span className="text-ink-400"> ({l.actor.role})</span>}
                        <span className="text-ink-400"> — {l.action}</span>
                      </div>
                      {l.details && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] font-medium text-brand-700">
                            View details
                          </summary>
                          <pre className="mt-1 overflow-x-auto rounded-xs bg-ink-50 p-2 font-mono text-[10px] text-ink-700">
                            {l.details}
                          </pre>
                        </details>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </DashCard>
          </div>
        )}
      </div>
    </div>
  );
}
