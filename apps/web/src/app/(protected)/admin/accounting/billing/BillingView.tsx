"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Undo2, Gavel, Receipt, Wallet, BookOpen } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { apiFetch } from "@/lib/api";
import { confirmDialog, promptDialog, toast } from "@/lib/swal";
import DatePickerField from "@/components/ui/DatePicker";
import type { ChartOfAccount, CostCenter, Fund } from "@/lib/accounting";
import {
  WAIVER_LABELS,
  WAIVER_TYPES,
  dueOf,
  fmtMoney,
  type BillingType,
  type CautionDeposit,
  type FeeHead,
  type StudentInvoice,
  type StudentLedger,
  type StudentWaiver,
} from "@/lib/billing";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const STATUS_BADGE: Record<string, string> = {
  UNPAID: "bg-slate-200 text-slate-700",
  PARTIAL: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-rose-100 text-rose-700",
  REVERSED: "bg-zinc-200 text-zinc-500 line-through",
};

const TABS = ["Invoices", "Fee Heads", "Waivers", "Ledger & Dues", "Caution"] as const;
type Tab = (typeof TABS)[number];

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

interface NewItem {
  key: string;
  feeHeadId: string;
  amount: string;
  creditHours: string;
}
const newItem = (): NewItem => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  feeHeadId: "",
  amount: "",
  creditHours: "",
});

export default function BillingView() {
  const [tab, setTab] = useState<Tab>("Invoices");
  const [loading, setLoading] = useState(true);
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [waivers, setWaivers] = useState<StudentWaiver[]>([]);
  const [cautions, setCautions] = useState<CautionDeposit[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  // invoice filters + forms
  const [statusFilter, setStatusFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showSingle, setShowSingle] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [sStudent, setSStudent] = useState("");
  const [sPeriod, setSPeriod] = useState(thisMonth());
  const [sIssue, setSIssue] = useState(today());
  const [sDue, setSDue] = useState(today());
  const [sItems, setSItems] = useState<NewItem[]>([newItem()]);
  const [bStudents, setBStudents] = useState("");
  const [bPeriod, setBPeriod] = useState(thisMonth());
  const [bIssue, setBIssue] = useState(today());
  const [bDue, setBDue] = useState(today());
  const [bItems, setBItems] = useState<NewItem[]>([newItem()]);

  // fee head form
  const [hCode, setHCode] = useState("");
  const [hName, setHName] = useState("");
  const [hType, setHType] = useState<BillingType>("MONTHLY");
  const [hAmount, setHAmount] = useState("");
  const [hRate, setHRate] = useState("");
  const [hGl, setHGl] = useState("");
  const [hCaution, setHCaution] = useState(false);

  // waiver form
  const [wStudent, setWStudent] = useState("");
  const [wType, setWType] = useState<(typeof WAIVER_TYPES)[number]>("MERIT");
  const [wPct, setWPct] = useState("20");
  const [wFilter, setWFilter] = useState("");

  // ledger
  const [lStudent, setLStudent] = useState("");
  const [ledger, setLedger] = useState<StudentLedger | null>(null);
  const [aging, setAging] = useState<{ totalDue: string; counts: Record<string, number> } | null>(null);

  // caution form
  const [cStudent, setCStudent] = useState("");
  const [cGl, setCGl] = useState("");
  const [cAmount, setCAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (periodFilter.trim()) params.set("period", periodFilter.trim());
      const [h, inv, w, c, f, a, cc] = await Promise.all([
        apiFetch<FeeHead[]>("/api/accounting/billing/fee-heads"),
        apiFetch<StudentInvoice[]>(`/api/accounting/billing/invoices?${params.toString()}`),
        apiFetch<StudentWaiver[]>(wFilter.trim() ? `/api/accounting/billing/waivers?studentId=${wFilter.trim()}` : "/api/accounting/billing/waivers?limit=200"),
        apiFetch<CautionDeposit[]>("/api/accounting/billing/cautions"),
        apiFetch<Fund[]>("/api/accounting/funds"),
        apiFetch<ChartOfAccount[]>("/api/accounting/chart-of-accounts?activeOnly=true"),
        apiFetch<CostCenter[]>("/api/accounting/cost-centers"),
      ]);
      setHeads(Array.isArray(h) ? h : []);
      setInvoices(Array.isArray(inv) ? inv : []);
      setWaivers(Array.isArray(w) ? w : []);
      setCautions(Array.isArray(c) ? c : []);
      setFunds(Array.isArray(f) ? f : []);
      setAccounts(Array.isArray(a) ? a : []);
      setCenters(Array.isArray(cc) ? cc : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load billing", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, periodFilter, wFilter]);

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [load]);

  const headById = useMemo(() => new Map(heads.map((h) => [h.id, h])), [heads]);
  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i) =>
        i.invoiceNo.toLowerCase().includes(q) ||
        i.studentId.toLowerCase().includes(q) ||
        i.billingPeriod.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const revenueAccounts = useMemo(
    () => accounts.filter((a) => ["REVENUE", "LIABILITY"].includes(a.accountType)),
    [accounts],
  );
  const cautionAccounts = useMemo(() => accounts.filter((a) => ["21401", "21402"].includes(a.glCode)), [accounts]);

  function itemsPayload(items: NewItem[]) {
    return items
      .filter((i) => i.feeHeadId)
      .map((i) => ({
        feeHeadId: i.feeHeadId,
        ...(i.amount.trim() ? { amount: Number(i.amount).toFixed(2) } : {}),
        ...(i.creditHours.trim() ? { creditHours: Number(i.creditHours).toFixed(2) } : {}),
      }));
  }

  async function createSingle() {
    if (!sStudent.trim() || !sPeriod.trim() || itemsPayload(sItems).length === 0) {
      toast("Student, period and at least one fee head are required.", "warning");
      return;
    }
    setActing("create-single");
    try {
      const created = await apiFetch<StudentInvoice>("/api/accounting/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          studentId: sStudent.trim(),
          billingPeriod: sPeriod.trim(),
          issueDate: sIssue,
          dueDate: sDue,
          items: itemsPayload(sItems),
        }),
      });
      toast(`Invoice ${created.invoiceNo} posted (net ${fmtMoney(created.netAmount)})`, "success");
      setShowSingle(false);
      setSStudent("");
      setSItems([newItem()]);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Invoice failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function createBulk() {
    const ids = bStudents.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0 || !bPeriod.trim() || itemsPayload(bItems).length === 0) {
      toast("Paste student UUIDs (one per line), a period and fee heads.", "warning");
      return;
    }
    setActing("create-bulk");
    try {
      const res = await apiFetch<{ created: number; skipped: { studentId: string; reason: string }[] }>(
        "/api/accounting/billing/invoices/bulk",
        {
          method: "POST",
          body: JSON.stringify({
            studentIds: ids,
            billingPeriod: bPeriod.trim(),
            issueDate: bIssue,
            dueDate: bDue,
            items: itemsPayload(bItems),
          }),
        },
      );
      toast(
        `Bulk done: ${res.created} posted${res.skipped.length ? `, ${res.skipped.length} skipped (duplicates)` : ""}`,
        res.skipped.length ? "warning" : "success",
      );
      setShowBulk(false);
      setBStudents("");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function createHead() {
    if (!hCode.trim() || !hName.trim() || !hGl) {
      toast("Code, name and revenue GL are required.", "warning");
      return;
    }
    setActing("create-head");
    try {
      await apiFetch("/api/accounting/billing/fee-heads", {
        method: "POST",
        body: JSON.stringify({
          headCode: hCode.trim().toUpperCase(),
          headName: hName.trim(),
          billingType: hType,
          defaultAmount: hAmount.trim() ? Number(hAmount).toFixed(2) : "0.00",
          perCreditRate: hRate.trim() ? Number(hRate).toFixed(2) : "0.00",
          revenueGlId: hGl,
          isCautionDeposit: hCaution,
        }),
      });
      toast(`Fee head ${hCode.trim().toUpperCase()} created`, "success");
      setHCode("");
      setHName("");
      setHAmount("");
      setHRate("");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Create failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function seedDefaults() {
    setActing("seed");
    try {
      const res = await apiFetch<FeeHead[]>("/api/accounting/billing/fee-heads/seed-defaults", { method: "POST" });
      toast(`${res.length} standard fee heads ready`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Seed failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function createWaiver() {
    if (!wStudent.trim()) {
      toast("Student UUID is required.", "warning");
      return;
    }
    setActing("create-waiver");
    try {
      await apiFetch("/api/accounting/billing/waivers", {
        method: "POST",
        body: JSON.stringify({
          studentId: wStudent.trim(),
          waiverType: wType,
          percent: Number(wPct),
        }),
      });
      toast(`Waiver ${wType} ${wPct}% granted`, "success");
      setWStudent("");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Waiver failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function reverseInvoice(id: string, no: string) {
    const reason = await promptDialog({
      title: `Reverse ${no}?`,
      text: "An offsetting STUDENT_BILLING journal will be posted. This cannot be undone.",
      input: "textarea",
      placeholder: "e.g. Wrong fee head billed for October",
      confirmText: "Post reversal",
      icon: "warning",
      minLength: 3,
      danger: true,
    });
    if (reason === null) return;
    setActing(`rev:${id}`);
    try {
      await apiFetch(`/api/accounting/billing/invoices/${id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      toast(`${no} reversed`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reverse failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function lateFine(id: string, no: string) {
    const amt = await promptDialog({
      title: `Late fine — ${no}`,
      text: "Posts Dr 11401 Student AR / Cr 42103 Fine Revenue.",
      input: "number",
      inputValue: "200.00",
      placeholder: "Amount in BDT",
      confirmText: "Post fine",
      icon: "question",
    });
    if (amt === null) return;
    setActing(`fine:${id}`);
    try {
      await apiFetch(`/api/accounting/billing/invoices/${id}/late-fine`, {
        method: "POST",
        body: JSON.stringify({ fineAmount: Number(amt).toFixed(2), memo: "counter fine" }),
      });
      toast(`Fine posted to ${no}`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Fine failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function loadLedger() {
    if (!lStudent.trim()) {
      toast("Enter a student UUID.", "warning");
      return;
    }
    try {
      const data = await apiFetch<StudentLedger>(`/api/accounting/billing/ledger/${lStudent.trim()}`);
      setLedger(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ledger failed", "error");
    }
  }

  async function loadAging() {
    try {
      const data = await apiFetch<{ totalDue: string; counts: Record<string, number> }>(
        "/api/accounting/billing/dues/aging",
      );
      setAging(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Aging failed", "error");
    }
  }

  async function collectCaution() {
    if (!cStudent.trim() || !cGl || !cAmount.trim()) {
      toast("Student, 21401/21402 GL and amount are required.", "warning");
      return;
    }
    setActing("caution");
    try {
      await apiFetch("/api/accounting/billing/cautions", {
        method: "POST",
        body: JSON.stringify({
          studentId: cStudent.trim(),
          glAccountId: cGl,
          amount: Number(cAmount).toFixed(2),
        }),
      });
      toast("Caution deposit collected (Dr Cash / Cr 2140x)", "success");
      setCStudent("");
      setCAmount("");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Caution failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function deleteHead(id: string, code: string) {
    const ok = await confirmDialog({
      title: `Delete fee head "${code}"?`,
      text: "Only unused heads can be deleted. Once a head has billed even once, it is kept as audit history — deactivate it instead.",
      confirmText: "Yes, delete",
      icon: "warning",
      danger: true,
    });
    if (!ok) return;
    setActing(`del-head:${id}`);
    try {
      await apiFetch(`/api/accounting/billing/fee-heads/${id}`, { method: "DELETE" });
      toast(`Fee head ${code} deleted`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setActing(null);
    }
  }

  if (loading) return <AdminPageLoader />;

  return (
    <div>
      <DashPageHeader
        title="Billing & Invoices"
        description="Accrual billing — gross → waiver → net auto-posts Dr 11401 AR + Dr 4190x contra / Cr fee revenue. Duplicates per (student × period) are blocked."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xs px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-brand-600 text-white" : "border border-ink-200 bg-white text-ink-700 hover:bg-ink-100"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Invoices" && (
        <>
          <div className="mb-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setShowSingle((s) => !s); setShowBulk(false); }} className="flex items-center gap-1.5 rounded-xs bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" /> Single invoice
            </button>
            <button type="button" onClick={() => { setShowBulk((s) => !s); setShowSingle(false); }} className="flex items-center gap-1.5 rounded-xs border border-brand-300 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              <BookOpen className="h-4 w-4" /> Bulk generate
            </button>
          </div>

          {showSingle && (
            <DashCard title="New invoice (auto-posts accrual journal)" className="mb-4">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block font-medium text-ink-700">Student UUID (sub-ledger)</span>
                  <input value={sStudent} onChange={(e) => setSStudent(e.target.value)} placeholder="e.g. 550e8400-…" className={`${INPUT} font-mono`} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-700">Billing period</span>
                  <input value={sPeriod} onChange={(e) => setSPeriod(e.target.value)} placeholder="2026-10" className={INPUT} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <DatePickerField label="Issue date" value={sIssue} onChange={setSIssue} required />
                  <DatePickerField label="Due date" value={sDue} onChange={setSDue} required />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {sItems.map((it, idx) => {
                  const head = headById.get(it.feeHeadId);
                  return (
                    <div key={it.key} className="grid gap-2 rounded-xs border border-ink-200 bg-ink-50/50 p-2 md:grid-cols-[26px_1fr_130px_110px_40px]">
                      <span className="pt-2 text-center text-xs font-bold text-ink-400">{idx + 1}</span>
                      <select value={it.feeHeadId} onChange={(e) => setSItems((p) => p.map((x) => (x.key === it.key ? { ...x, feeHeadId: e.target.value } : x)))} className={INPUT}>
                        <option value="">Fee head…</option>
                        {heads.filter((h) => h.isActive).map((h) => (
                          <option key={h.id} value={h.id}>{h.headCode} — {h.headName} ({fmtMoney(h.defaultAmount)}){h.isCautionDeposit ? " [caution]" : ""}</option>
                        ))}
                      </select>
                      <input value={it.amount} onChange={(e) => setSItems((p) => p.map((x) => (x.key === it.key ? { ...x, amount: e.target.value } : x)))} placeholder={head ? `Default ${fmtMoney(head.defaultAmount)}` : "Override amt"} inputMode="decimal" className={`${INPUT} text-right`} />
                      <input value={it.creditHours} onChange={(e) => setSItems((p) => p.map((x) => (x.key === it.key ? { ...x, creditHours: e.target.value } : x)))} placeholder="Credit hrs" inputMode="decimal" className={`${INPUT} text-right`} disabled={head?.billingType !== "CREDIT_HOUR"} />
                      <button type="button" disabled={sItems.length <= 1} onClick={() => setSItems((p) => p.filter((x) => x.key !== it.key))} className="text-rose-600 hover:text-rose-800 disabled:opacity-40">✕</button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between">
                <button type="button" onClick={() => setSItems((p) => [...p, newItem()])} className="rounded-xs border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100">+ Add head</button>
                <button type="button" disabled={acting === "create-single"} onClick={createSingle} className="rounded-xs bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {acting === "create-single" ? "Posting…" : "Generate + post"}
                </button>
              </div>
            </DashCard>
          )}

          {showBulk && (
            <DashCard title="Bulk generate (one period → many students)" className="mb-4">
              <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-700">Student UUIDs (one per line / comma)</span>
                  <textarea value={bStudents} onChange={(e) => setBStudents(e.target.value)} rows={3} placeholder={"uuid-1\nuuid-2"} className={`${INPUT} font-mono`} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-700">Period</span>
                  <input value={bPeriod} onChange={(e) => setBPeriod(e.target.value)} className={INPUT} />
                </label>
                <DatePickerField label="Issue date" value={bIssue} onChange={setBIssue} required />
                <DatePickerField label="Due date" value={bDue} onChange={setBDue} required />
              </div>
              <div className="mt-3 space-y-2">
                {bItems.map((it, idx) => (
                  <div key={it.key} className="grid gap-2 rounded-xs border border-ink-200 bg-ink-50/50 p-2 md:grid-cols-[26px_1fr_130px_110px_40px]">
                    <span className="pt-2 text-center text-xs font-bold text-ink-400">{idx + 1}</span>
                    <select value={it.feeHeadId} onChange={(e) => setBItems((p) => p.map((x) => (x.key === it.key ? { ...x, feeHeadId: e.target.value } : x)))} className={INPUT}>
                      <option value="">Fee head…</option>
                      {heads.filter((h) => h.isActive).map((h) => (
                        <option key={h.id} value={h.id}>{h.headCode} — {h.headName}</option>
                      ))}
                    </select>
                    <input value={it.amount} onChange={(e) => setBItems((p) => p.map((x) => (x.key === it.key ? { ...x, amount: e.target.value } : x)))} placeholder="Override amt" inputMode="decimal" className={`${INPUT} text-right`} />
                    <input value={it.creditHours} onChange={(e) => setBItems((p) => p.map((x) => (x.key === it.key ? { ...x, creditHours: e.target.value } : x)))} placeholder="Credit hrs" inputMode="decimal" className={`${INPUT} text-right`} />
                    <button type="button" disabled={bItems.length <= 1} onClick={() => setBItems((p) => p.filter((x) => x.key !== it.key))} className="text-rose-600 disabled:opacity-40">✕</button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between">
                <button type="button" onClick={() => setBItems((p) => [...p, newItem()])} className="rounded-xs border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100">+ Add head</button>
                <button type="button" disabled={acting === "create-bulk"} onClick={createBulk} className="rounded-xs bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {acting === "create-bulk" ? "Posting…" : "Bulk generate"}
                </button>
              </div>
            </DashCard>
          )}

          <DashCard title={`Invoices (${filteredInvoices.length})`}>
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="relative min-w-52 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice no / student / period…" className={`${INPUT} pl-8`} />
              </div>
              <input value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} placeholder="Period e.g. 2026-10" className="rounded-xs cursor-pointer border border-ink-200 bg-white px-2 py-1 text-sm" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xs cursor-pointer border border-ink-200 bg-white px-2 py-1 text-sm">
                <option value="">All statuses</option>
                {["UNPAID", "PARTIAL", "OVERDUE", "PAID", "REVERSED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {filteredInvoices.map((inv) => {
                const open = expanded.has(inv.id);
                const due = dueOf(inv);
                return (
                  <div key={inv.id} className="rounded-xs border border-ink-200">
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <button type="button" onClick={() => setExpanded((p) => { const n = new Set(p); if (n.has(inv.id)) n.delete(inv.id); else n.add(inv.id); return n; })} className="font-mono text-sm font-bold text-ink-900">
                        {inv.invoiceNo}
                      </button>
                      <span className="text-xs text-ink-500">{inv.billingPeriod} · due {String(inv.dueDate).slice(0, 10)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[inv.status]}`}>{inv.status}</span>
                      <span className="ml-auto font-mono text-xs text-ink-700">
                        G {fmtMoney(inv.grossAmount)} − W {fmtMoney(inv.waiverAmount)} = N {fmtMoney(inv.netAmount)}
                        {Number(inv.lateFineAmount) > 0 && <span className="text-rose-600"> + F {fmtMoney(inv.lateFineAmount)}</span>}
                        {" · "}Paid {fmtMoney(inv.paidAmount)} · <span className={due > 0 ? "font-bold text-rose-700" : "text-emerald-700"}>Due {fmtMoney(due)}</span>
                      </span>
                      <span className="flex gap-1.5">
                        {!["PAID", "REVERSED"].includes(inv.status) && (
                          <button type="button" disabled={!!acting} onClick={() => lateFine(inv.id, inv.invoiceNo)} className="flex items-center gap-1 rounded-xs bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                            <Gavel className="h-3.5 w-3.5" /> Fine
                          </button>
                        )}
                        {!["REVERSED"].includes(inv.status) && Number(inv.paidAmount) === 0 && (
                          <button type="button" disabled={!!acting} onClick={() => reverseInvoice(inv.id, inv.invoiceNo)} className="flex items-center gap-1 rounded-xs border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                            <Undo2 className="h-3.5 w-3.5" /> Reverse
                          </button>
                        )}
                      </span>
                    </div>
                    {open && (
                      <div className="overflow-x-auto border-t border-ink-100 px-3 py-2">
                        <p className="mb-1 font-mono text-[11px] text-ink-500">student {inv.studentId} · journal {inv.journalEntryId ?? "—"}</p>
                        <table className="w-full min-w-[560px] text-xs">
                          <thead><tr className="text-left text-ink-500"><th className="py-1 pr-2">Head</th><th className="py-1 pr-2">GL / Fund</th><th className="py-1 pr-2 text-right">Gross</th><th className="py-1 pr-2 text-right">Waiver</th><th className="py-1 text-right">Net</th></tr></thead>
                          <tbody>
                            {(inv.lines ?? []).map((l) => (
                              <tr key={l.id} className="border-t border-ink-100">
                                <td className="py-1 pr-2">{l.feeHead ? `${l.feeHead.headCode}` : l.feeHeadId.slice(0, 8)}</td>
                                <td className="py-1 pr-2 font-mono">{l.glAccount ? l.glAccount.glCode : l.glAccountId.slice(0, 8)} · {l.fund ? l.fund.fundCode : ""}</td>
                                <td className="py-1 pr-2 text-right font-mono">{fmtMoney(l.grossAmount)}</td>
                                <td className="py-1 pr-2 text-right font-mono">{fmtMoney(l.waiverAmount)}</td>
                                <td className="py-1 text-right font-mono">{fmtMoney(l.netAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredInvoices.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No invoices yet — generate the first one above.</p>}
            </div>
          </DashCard>
        </>
      )}

      {tab === "Fee Heads" && (
        <DashCard title={`Fee heads (${heads.length}) — each maps to a CoA revenue / caution GL`}>
          {heads.length === 0 && (
            <div className="mb-3 rounded-xs bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No fee heads yet. Seed the standard catalogue (TUITION / EXAM / HOSTEL / CAUTION…) or create heads manually.
              <button type="button" disabled={acting === "seed"} onClick={seedDefaults} className="ml-2 rounded-xs bg-amber-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                {acting === "seed" ? "Seeding…" : "Seed defaults"}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-xs text-ink-500"><th className="py-1 pr-2">Code</th><th className="py-1 pr-2">Name</th><th className="py-1 pr-2">Type</th><th className="py-1 pr-2">GL</th><th className="py-1 pr-2 text-right">Amount</th><th className="py-1">Flags</th><th className="py-1 text-right">Action</th></tr></thead>
              <tbody>
                {heads.map((h) => (
                  <tr key={h.id} className="border-t border-ink-100">
                    <td className="py-1.5 pr-2 font-mono font-bold">{h.headCode}</td>
                    <td className="py-1.5 pr-2">{h.headName}</td>
                    <td className="py-1.5 pr-2 text-xs">{h.billingType}{h.billingType === "CREDIT_HOUR" && ` @ ${fmtMoney(h.perCreditRate)}/cr`}</td>
                    <td className="py-1.5 pr-2 font-mono text-xs">{h.revenueGl ? `${h.revenueGl.glCode}` : h.revenueGlId.slice(0, 8)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{fmtMoney(h.defaultAmount)}</td>
                    <td className="py-1.5 text-xs">{h.isCautionDeposit ? "caution→2140x" : ""}{!h.isActive ? " · inactive" : ""}</td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        disabled={acting === `del-head:${h.id}`}
                        onClick={() => deleteHead(h.id, h.headCode)}
                        title="Delete (only if never billed)"
                        className="rounded-xs border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {acting === `del-head:${h.id}` ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-2 rounded-xs border border-ink-200 bg-ink-50/50 p-3 md:grid-cols-[120px_1fr_140px_150px_1fr_auto]">
            <input value={hCode} onChange={(e) => setHCode(e.target.value)} placeholder="CODE" className={`${INPUT} font-mono`} />
            <input value={hName} onChange={(e) => setHName(e.target.value)} placeholder="Head name" className={INPUT} />
            <select value={hType} onChange={(e) => setHType(e.target.value as BillingType)} className={INPUT}>
              {(["MONTHLY", "TERM", "CREDIT_HOUR", "ONE_TIME"] as BillingType[]).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={hAmount} onChange={(e) => setHAmount(e.target.value)} placeholder={hType === "CREDIT_HOUR" ? "Unused" : "Default amount"} inputMode="decimal" className={`${INPUT} text-right`} />
            <select value={hGl} onChange={(e) => setHGl(e.target.value)} className={INPUT}>
              <option value="">Revenue GL…</option>
              {revenueAccounts.map((a) => <option key={a.id} value={a.id}>{a.glCode} — {a.accountName}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={hCaution} onChange={(e) => setHCaution(e.target.checked)} /> caution→2140x</label>
          </div>
          {hType === "CREDIT_HOUR" && (
            <input value={hRate} onChange={(e) => setHRate(e.target.value)} placeholder="Per-credit rate (BDT)" inputMode="decimal" className={`${INPUT} mt-2 max-w-56 text-right`} />
          )}
          <div className="mt-2 flex justify-end gap-2">
            {heads.length > 0 && <button type="button" disabled={acting === "seed"} onClick={seedDefaults} className="rounded-xs border border-ink-200 px-3 py-2 text-sm text-ink-600 hover:bg-ink-100 disabled:opacity-50">Ensure defaults</button>}
            <button type="button" disabled={acting === "create-head"} onClick={createHead} className="rounded-xs bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {acting === "create-head" ? "Saving…" : "Add fee head"}
            </button>
          </div>
          <p className="mt-1 text-right text-xs text-ink-500">Unused heads can be deleted (setup-time tailoring per institute). Once a head has billed, delete is blocked — deactivate it instead. Funds used: {funds.map((f) => `${f.fundCode} ${f.fundName}`).join(" · ") || "—"}</p>
        </DashCard>
      )}

      {tab === "Waivers" && (
        <DashCard title={`Waivers (${waivers.length}) — contra-revenue 41901–41904, never silent discounts`}>
          <div className="mb-3 flex flex-wrap gap-2">
            <input value={wFilter} onChange={(e) => setWFilter(e.target.value)} placeholder="Filter by student UUID…" className={`${INPUT} max-w-80 font-mono`} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-xs text-ink-500"><th className="py-1 pr-2">Student</th><th className="py-1 pr-2">Type</th><th className="py-1 pr-2 text-right">%</th><th className="py-1 pr-2">Active</th><th className="py-1">Remark</th></tr></thead>
              <tbody>
                {waivers.map((w) => (
                  <tr key={w.id} className="border-t border-ink-100">
                    <td className="py-1.5 pr-2 font-mono text-xs">{w.studentId.slice(0, 13)}…</td>
                    <td className="py-1.5 pr-2 text-xs">{WAIVER_LABELS[w.waiverType] ?? w.waiverType}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{Number(w.percent).toFixed(2)}%</td>
                    <td className="py-1.5 pr-2 text-xs">{w.isActive ? "yes" : "no"}{w.fixedCapAmount ? ` · cap ${fmtMoney(w.fixedCapAmount)}` : ""}</td>
                    <td className="py-1.5 text-xs text-ink-500">{w.remark ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {waivers.length === 0 && <p className="py-4 text-center text-sm text-ink-500">No waivers yet.</p>}
          </div>
          <div className="mt-4 grid gap-2 rounded-xs border border-ink-200 bg-ink-50/50 p-3 md:grid-cols-[1fr_220px_110px_auto]">
            <input value={wStudent} onChange={(e) => setWStudent(e.target.value)} placeholder="Student UUID" className={`${INPUT} font-mono`} />
            <select value={wType} onChange={(e) => setWType(e.target.value as (typeof WAIVER_TYPES)[number])} className={INPUT}>
              {WAIVER_TYPES.map((t) => <option key={t} value={t}>{WAIVER_LABELS[t]}</option>)}
            </select>
            <input value={wPct} onChange={(e) => setWPct(e.target.value)} placeholder="%" inputMode="decimal" className={`${INPUT} text-right`} />
            <button type="button" disabled={acting === "create-waiver"} onClick={createWaiver} className="rounded-xs bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {acting === "create-waiver" ? "Granting…" : "Grant waiver"}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-500">LILLAH 100% boarding lines post wholly in Fund 02 (shariah isolation). Cost centers: {centers.map((c) => c.centerCode).join(", ") || "—"}</p>
        </DashCard>
      )}

      {tab === "Ledger & Dues" && (
        <div className="grid gap-4">
          <DashCard title="Student ledger (accrual)">
            <div className="flex flex-wrap gap-2">
              <input value={lStudent} onChange={(e) => setLStudent(e.target.value)} placeholder="Student UUID" className={`${INPUT} max-w-96 flex-1 font-mono`} />
              <button type="button" onClick={loadLedger} className="flex items-center gap-1 rounded-xs bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                <Receipt className="h-4 w-4" /> Load ledger
              </button>
            </div>
            {ledger && (
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-2 rounded-xs bg-ink-900 p-3 font-mono text-xs text-white md:grid-cols-4">
                  <span>Gross {fmtMoney(ledger.summary.gross)}</span>
                  <span>Waiver {fmtMoney(ledger.summary.waiver)}</span>
                  <span>Net {fmtMoney(ledger.summary.net)} + Fine {fmtMoney(ledger.summary.lateFine)}</span>
                  <span className="font-bold text-amber-300">Receivable {fmtMoney(ledger.summary.receivable)}</span>
                  <span>Paid {fmtMoney(ledger.summary.paid)}</span>
                  <span>Caution held {fmtMoney(ledger.summary.cautionHeld)}</span>
                  <span>Open {ledger.summary.openInvoices}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {ledger.invoices.map((i) => (
                    <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-xs border border-ink-100 px-2 py-1.5 text-xs">
                      <span className="font-mono font-bold">{i.invoiceNo}</span>
                      <span className="text-ink-500">{i.billingPeriod}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[i.status]}`}>{i.status}</span>
                      <span className="ml-auto font-mono">N {fmtMoney(i.netAmount)} + F {fmtMoney(i.lateFineAmount)} − P {fmtMoney(i.paidAmount)} = <b>{fmtMoney(dueOf(i))}</b></span>
                    </div>
                  ))}
                  {ledger.invoices.length === 0 && <p className="py-3 text-center text-sm text-ink-500">No invoices for this student.</p>}
                </div>
              </div>
            )}
          </DashCard>
          <DashCard title="Defaulter aging (0–30 / 31–60 / 61–90 / 90+)">
            <button type="button" onClick={loadAging} className="flex items-center gap-1 rounded-xs border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100">
              <Wallet className="h-4 w-4" /> Refresh aging
            </button>
            {aging && (
              <div className="mt-2 rounded-xs bg-ink-900 p-3 font-mono text-xs text-white">
                Total due {fmtMoney(aging.totalDue)} · {Object.entries(aging.counts).map(([k, v]) => <span key={k} className="mr-3">{k}d: {v}</span>)}
              </div>
            )}
          </DashCard>
        </div>
      )}

      {tab === "Caution" && (
        <div className="grid gap-4">
          <DashCard title="Collect caution deposit (Dr Cash / Cr 21401-21402)">
            <div className="grid gap-2 md:grid-cols-[1fr_220px_140px_auto]">
              <input value={cStudent} onChange={(e) => setCStudent(e.target.value)} placeholder="Student UUID" className={`${INPUT} font-mono`} />
              <select value={cGl} onChange={(e) => setCGl(e.target.value)} className={INPUT}>
                <option value="">21401 / 21402…</option>
                {cautionAccounts.map((a) => <option key={a.id} value={a.id}>{a.glCode} — {a.accountName}</option>)}
              </select>
              <input value={cAmount} onChange={(e) => setCAmount(e.target.value)} placeholder="Amount" inputMode="decimal" className={`${INPUT} text-right`} />
              <button type="button" disabled={acting === "caution"} onClick={collectCaution} className="rounded-xs bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {acting === "caution" ? "Posting…" : "Collect"}
              </button>
            </div>
          </DashCard>
          <DashCard title={`Deposits (${cautions.length}) — settle on graduation (adjust to dues / refund)`}>
            <div className="space-y-1">
              {cautions.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xs border border-ink-100 px-2 py-1.5 text-xs">
                  <span className="font-mono">{c.studentId.slice(0, 13)}…</span>
                  <span className="font-mono">{c.glAccount ? c.glAccount.glCode : c.glAccountId.slice(0, 8)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${c.status === "HELD" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>{c.status}</span>
                  <span className="ml-auto font-mono font-bold">{fmtMoney(c.amount)}</span>
                </div>
              ))}
              {cautions.length === 0 && <p className="py-4 text-center text-sm text-ink-500">No deposits yet.</p>}
            </div>
            <p className="mt-2 text-xs text-ink-500">Settle via API: POST /api/accounting/billing/cautions/:id/settle with {"{ action: 'ADJUSTED' | 'REFUNDED', invoiceId? }"}. Caution GLs: {cautionAccounts.map((a) => a.glCode).join(", ") || "seed CoA first"}.</p>
          </DashCard>
        </div>
      )}
    </div>
  );
}
