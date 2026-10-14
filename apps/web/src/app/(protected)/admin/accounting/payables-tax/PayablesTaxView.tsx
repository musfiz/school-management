"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Landmark, ReceiptText, Trash2 } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { apiFetch } from "@/lib/api";
import { confirmDialog, toast } from "@/lib/swal";
import DatePickerField from "@/components/ui/DatePicker";
import type { ChartOfAccount, CostCenter, Fund } from "@/lib/accounting";
import { fmtMoney } from "@/lib/billing";
import {
  billOutstanding,
  billPendingTds,
  billPendingVds,
  calcBill,
  type PendingTaxLeg,
  type TaxChallan,
  type Vendor,
  type VendorBill,
} from "@/lib/payables";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BILL_BADGE: Record<string, string> = {
  DRAFT: "bg-zinc-200 text-zinc-700",
  APPROVED: "bg-sky-100 text-sky-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  REVERSED: "bg-zinc-200 text-zinc-500 line-through",
};

const TABS = ["Bills", "NBR Challan", "Vendors"] as const;
type Tab = (typeof TABS)[number];

const today = () => new Date().toISOString().slice(0, 10);
const num = (s: string) => (s.trim() === "" ? 0 : Number(s));

export default function PayablesTaxView() {
  const [tab, setTab] = useState<Tab>("Bills");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // masters
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  // bills
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [fVendor, setFVendor] = useState("");
  const [fStatus, setFStatus] = useState("");

  // new bill form
  const [bVendor, setBVendor] = useState("");
  const [bExpenseGl, setBExpenseGl] = useState("");
  const [bFund, setBFund] = useState("");
  const [bCostCenter, setBCostCenter] = useState("");
  const [bDate, setBDate] = useState(today());
  const [bDue, setBDue] = useState("");
  const [bSuppInv, setBSuppInv] = useState("");
  const [bGross, setBGross] = useState("");
  const [bTds, setBTds] = useState("10");
  const [bVds, setBVds] = useState("7.5");
  const [bMushak, setBMushak] = useState(false);
  const [bNarr, setBNarr] = useState("");

  // inline pay box
  const [payBillId, setPayBillId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payBankGl, setPayBankGl] = useState("");

  // challan
  const [pending, setPending] = useState<PendingTaxLeg[]>([]);
  const [pendingTotal, setPendingTotal] = useState("0.00");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [challans, setChallans] = useState<TaxChallan[]>([]);
  const [cNo, setCNo] = useState("");
  const [cDate, setCDate] = useState(today());
  const [cBankGl, setCBankGl] = useState("");
  const [cBankName, setCBankName] = useState("");
  const [openChallan, setOpenChallan] = useState<string | null>(null);

  // vendor form
  const [vName, setVName] = useState("");
  const [vCode, setVCode] = useState("");
  const [vBin, setVBin] = useState("");
  const [vTrade, setVTrade] = useState("");
  const [vPerson, setVPerson] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vAddr, setVAddr] = useState("");

  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.accountType === "EXPENSE" || a.glCode === "12101" || a.glCode.startsWith("1210"),
      ),
    [accounts],
  );
  const bankAccounts = useMemo(() => accounts.filter((a) => a.isCashOrBank), [accounts]);
  const defaultBankId = useMemo(
    () => bankAccounts.find((a) => a.glCode === "11201")?.id ?? bankAccounts[0]?.id ?? "",
    [bankAccounts],
  );

  const preview = useMemo(
    () => calcBill(num(bGross) || 0, num(bTds) || 0, num(bVds) || 0),
    [bGross, bTds, bVds],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fVendor) params.set("vendorId", fVendor);
      if (fStatus) params.set("status", fStatus);
      const [v, f, a, c, b] = await Promise.all([
        apiFetch<Vendor[]>("/api/accounting/procurement/vendors"),
        apiFetch<Fund[]>("/api/accounting/funds"),
        apiFetch<ChartOfAccount[]>("/api/accounting/chart-of-accounts?activeOnly=true"),
        apiFetch<CostCenter[]>("/api/accounting/cost-centers"),
        apiFetch<VendorBill[]>(`/api/accounting/procurement/bills?${params.toString()}`),
      ]);
      setVendors(v);
      setFunds(f.filter((x) => x.isActive));
      setAccounts(a);
      setCostCenters(c.filter((x) => x.isActive));
      setBills(b);
      if (!bFund) {
        const g = f.find((x) => x.fundCode === "01");
        if (g) setBFund(g.id);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load payables desk.", "error");
    } finally {
      setLoading(false);
    }
  }, [fVendor, fStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadChallanData = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        apiFetch<{ legs: PendingTaxLeg[]; totalPending: string }>(
          "/api/accounting/procurement/taxes/pending",
        ),
        apiFetch<TaxChallan[]>("/api/accounting/procurement/challans"),
      ]);
      setPending(p.legs);
      setPendingTotal(p.totalPending);
      setChallans(c);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load challan desk.", "error");
    }
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (tab === "NBR Challan" && accounts.length > 0) loadChallanData();
  }, [tab, accounts.length, loadChallanData]);

  const toggleLeg = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedTotal = useMemo(() => {
    let t = 0;
    for (const l of pending) {
      if (selected.has(`${l.billId}:${l.taxType}`)) t += Number(l.pending);
    }
    return Math.round(t * 100) / 100;
  }, [pending, selected]);

  /* ---------- actions ---------- */

  async function createBill() {
    if (!bVendor) return toast("Pick a vendor first.", "warning");
    if (!bExpenseGl) return toast("Pick the expense / asset GL.", "warning");
    if (!bFund) return toast("Pick a fund.", "warning");
    if (!(num(bGross) > 0)) return toast("Gross amount must be positive.", "warning");
    if (num(bTds) + num(bVds) > 100) return toast("TDS + VDS cannot exceed 100%.", "warning");
    if (bDue && bDue < bDate) return toast("Due date cannot precede bill date.", "warning");
    setActing("create-bill");
    try {
      const bill = await apiFetch<VendorBill>("/api/accounting/procurement/bills", {
        method: "POST",
        body: JSON.stringify({
          vendorId: bVendor,
          expenseGlId: bExpenseGl,
          fundId: bFund,
          ...(bCostCenter ? { costCenterId: bCostCenter } : {}),
          billDate: bDate,
          ...(bDue ? { dueDate: bDue } : {}),
          ...(bSuppInv.trim() ? { supplierInvoiceNo: bSuppInv.trim() } : {}),
          grossAmount: num(bGross).toFixed(2),
          tdsRate: (num(bTds) || 0).toString(),
          vdsRate: (num(bVds) || 0).toString(),
          mushak63Received: bMushak,
          ...(bNarr.trim() ? { narration: bNarr.trim() } : {}),
        }),
      });
      toast(`Draft ${bill.billNo} saved — approve to post.`);
      setBGross("");
      setBSuppInv("");
      setBNarr("");
      setBMushak(false);
      loadBase();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bill entry failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function approveBill(id: string, billNo: string) {
    const ok = await confirmDialog({
      title: `Approve ${billNo}?`,
      text: "The accrual journal posts immediately: Dr expense/asset (gross) / Cr vendor AP (net) + TDS + VDS.",
      confirmText: "Yes, approve & post",
      icon: "question",
    });
    if (!ok) return;
    setActing(`approve:${id}`);
    try {
      const bill = await apiFetch<VendorBill>(`/api/accounting/procurement/bills/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast(
        `${bill.billNo} posted — AP ${fmtMoney(bill.netPayable)}, TDS ${fmtMoney(bill.tdsAmount)}, VDS ${fmtMoney(bill.vdsAmount)}.`,
      );
      loadBase();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Approval failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function voidBill(id: string, billNo: string) {
    const ok = await confirmDialog({
      title: `Void draft ${billNo}?`,
      text: "This cannot be undone.",
      confirmText: "Yes, void",
      icon: "warning",
      danger: true,
    });
    if (!ok) return;
    setActing(`void:${id}`);
    try {
      await apiFetch(`/api/accounting/procurement/bills/${id}`, { method: "DELETE" });
      toast(`${billNo} voided.`);
      loadBase();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Void failed.", "error");
    } finally {
      setActing(null);
    }
  }

  function openPay(bill: VendorBill) {
    setPayBillId(bill.id);
    setPayAmount(billOutstanding(bill).toFixed(2));
    setPayBankGl(defaultBankId);
  }

  async function submitPay(bill: VendorBill) {
    const amt = num(payAmount);
    if (!(amt > 0)) return toast("Payment amount must be positive.", "warning");
    if (amt - billOutstanding(bill) > 0.005) {
      return toast(
        `Outstanding is ${fmtMoney(billOutstanding(bill))} — overpayment blocked.`,
        "warning",
      );
    }
    setActing(`pay:${bill.id}`);
    try {
      const updated = await apiFetch<VendorBill>(
        `/api/accounting/procurement/bills/${bill.id}/pay`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: amt.toFixed(2),
            ...(payBankGl ? { bankGlId: payBankGl } : {}),
            transactionDate: today(),
          }),
        },
      );
      toast(`${updated.billNo} paid ${fmtMoney(amt)} — now ${updated.status}.`);
      setPayBillId(null);
      loadBase();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Payment failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function remitChallan() {
    if (selected.size === 0) return toast("Tick at least one pending leg.", "warning");
    if (!cNo.trim()) return toast("Treasury challan no. is required.", "warning");
    if (!cDate) return toast("Challan date is required.", "warning");
    setActing("remit");
    try {
      const legs = Array.from(selected).map((key) => {
        const [billId, taxType] = key.split(":");
        return { billId, taxType };
      });
      const challan = await apiFetch<TaxChallan>("/api/accounting/procurement/challans", {
        method: "POST",
        body: JSON.stringify({
          challanNo: cNo.trim(),
          challanDate: cDate,
          ...(cBankGl ? { bankGlId: cBankGl } : {}),
          ...(cBankName.trim() ? { depositBankName: cBankName.trim() } : {}),
          remit: legs,
        }),
      });
      toast(`Challan ${challan.challanNo} deposited — ${fmtMoney(challan.totalAmount)}.`);
      setSelected(new Set());
      setCNo("");
      setCBankName("");
      loadChallanData();
      loadBase();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Remittance failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function createVendor() {
    if (!vName.trim()) return toast("Vendor name is required.", "warning");
    setActing("create-vendor");
    try {
      const v = await apiFetch<Vendor>("/api/accounting/procurement/vendors", {
        method: "POST",
        body: JSON.stringify({
          vendorName: vName.trim(),
          ...(vCode.trim() ? { vendorCode: vCode.trim() } : {}),
          ...(vBin.trim() ? { binNo: vBin.trim() } : {}),
          ...(vTrade.trim() ? { tradeLicenseNo: vTrade.trim() } : {}),
          ...(vPerson.trim() ? { contactPerson: vPerson.trim() } : {}),
          ...(vPhone.trim() ? { contactPhone: vPhone.trim() } : {}),
          ...(vAddr.trim() ? { address: vAddr.trim() } : {}),
        }),
      });
      toast(`${v.vendorName} added.`);
      setVName("");
      setVCode("");
      setVBin("");
      setVTrade("");
      setVPerson("");
      setVPhone("");
      setVAddr("");
      loadBase();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Vendor creation failed.", "error");
    } finally {
      setActing(null);
    }
  }

  if (loading) return <AdminPageLoader />;
  const expName = (id: string) => {
    const a = expenseAccounts.find((x) => x.id === id);
    return a ? `${a.glCode} — ${a.accountName}` : "";
  };

  return (
    <div>
      <DashPageHeader
        title="Payables & NBR Tax"
        description="Vendor bills, Gross → TDS → VDS → Net engine and Treasury Challan register."
      />

      <div className="mb-4 flex gap-1 border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`cursor-pointer px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {t}
            {t === "NBR Challan" && Number(pendingTotal) > 0 && (
              <span className="ml-1.5 rounded-xs bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                {fmtMoney(pendingTotal)}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Bills" && (
        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <DashCard title="New vendor bill">
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Vendor
                <select value={bVendor} onChange={(e) => setBVendor(e.target.value)} className={INPUT}>
                  <option value="">— select —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendorName}
                      {v.vendorCode ? ` (${v.vendorCode})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Expense / asset GL (Dr)
                <select
                  value={bExpenseGl}
                  onChange={(e) => setBExpenseGl(e.target.value)}
                  className={INPUT}
                >
                  <option value="">— select 5xxxx / 121xx —</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.glCode} — {a.accountName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Fund
                  <select value={bFund} onChange={(e) => setBFund(e.target.value)} className={INPUT}>
                    <option value="">— select —</option>
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.fundCode} — {f.fundName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Cost center
                  <select
                    value={bCostCenter}
                    onChange={(e) => setBCostCenter(e.target.value)}
                    className={INPUT}
                  >
                    <option value="">— none —</option>
                    {costCenters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.centerCode} — {c.centerName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DatePickerField label="Bill date" value={bDate} onChange={setBDate} required />
                <DatePickerField label="Due date" value={bDue} onChange={setBDue} minDate={bDate} />
              </div>
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Supplier invoice no.
                <input
                  value={bSuppInv}
                  onChange={(e) => setBSuppInv(e.target.value)}
                  className={INPUT}
                  placeholder="e.g. PRINT-2026/118"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Gross bill amount (৳)
                <input
                  value={bGross}
                  onChange={(e) => setBGross(e.target.value)}
                  className={`${INPUT} font-semibold`}
                  inputMode="decimal"
                  placeholder="100000.00"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  TDS rate %
                  <input
                    value={bTds}
                    onChange={(e) => setBTds(e.target.value)}
                    className={INPUT}
                    inputMode="decimal"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  VDS rate %
                  <input
                    value={bVds}
                    onChange={(e) => setBVds(e.target.value)}
                    className={INPUT}
                    inputMode="decimal"
                  />
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
                <input
                  type="checkbox"
                  checked={bMushak}
                  onChange={(e) => setBMushak(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-emerald-700"
                />
                Mushak 6.3 received from supplier
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Narration
                <input
                  value={bNarr}
                  onChange={(e) => setBNarr(e.target.value)}
                  className={INPUT}
                  placeholder="e.g. Q3 exam printing"
                />
              </label>

              <div className="rounded-xs border border-ink-200 bg-ink-50/60 p-2.5 text-sm">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Gross → TDS → VDS → Net
                </div>
                <dl className="grid gap-0.5">
                  <div className="flex justify-between">
                    <dt className="text-ink-600">Gross bill</dt>
                    <dd className="font-semibold">{fmtMoney(num(bGross) || 0)}</dd>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <dt>− TDS {num(bTds) || 0}% → 21302</dt>
                    <dd className="font-semibold">{fmtMoney(preview.tds)}</dd>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <dt>− VDS {num(bVds) || 0}% → 21304</dt>
                    <dd className="font-semibold">{fmtMoney(preview.vds)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-ink-200 pt-0.5 text-emerald-800">
                    <dt className="font-semibold">= Net payable → 21101</dt>
                    <dd className="font-bold">{fmtMoney(preview.net)}</dd>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                onClick={createBill}
                disabled={acting === "create-bill"}
                className="cursor-pointer rounded-xs bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {acting === "create-bill" ? "Saving…" : "Save draft bill"}
              </button>
            </div>
          </DashCard>

          <DashCard title="Vendor bills">
            <div className="mb-2 flex flex-wrap gap-2">
              <select
                value={fVendor}
                onChange={(e) => setFVendor(e.target.value)}
                className={`${INPUT} w-44`}
              >
                <option value="">All vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorName}
                  </option>
                ))}
              </select>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={`${INPUT} w-36`}>
                <option value="">All statuses</option>
                {["DRAFT", "APPROVED", "PARTIAL", "PAID"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {bills.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No bills yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-[11px] uppercase tracking-wide text-ink-500">
                      <th className="px-2 py-1.5">Bill</th>
                      <th className="px-2 py-1.5">Vendor / head</th>
                      <th className="px-2 py-1.5 text-right">Gross</th>
                      <th className="px-2 py-1.5 text-right">TDS / VDS</th>
                      <th className="px-2 py-1.5 text-right">Net → paid</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b) => (
                      <Fragment key={b.id}>
                        <tr className="border-b border-ink-100 hover:bg-ink-50/50">
                          <td className="px-2 py-1.5">
                            <div className="font-semibold">{b.billNo}</div>
                            <div className="text-[11px] text-ink-500">
                              {b.billDate}
                              {b.mushak63Received ? " · 6.3 ✓" : ""}
                              {b.glJournal ? ` · ${b.glJournal.voucherNo}` : ""}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div>{b.vendor?.vendorName ?? "—"}</div>
                            <div className="text-[11px] text-ink-500">
                              {b.expenseGl ? `${b.expenseGl.glCode} — ${b.expenseGl.accountName}` : expName(b.expenseGlId)}
                              {" · "}
                              {b.fund ? `${b.fund.fundCode}` : ""}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            {fmtMoney(b.grossAmount)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs">
                            <div className={billPendingTds(b) > 0 ? "text-rose-700" : "text-ink-400"}>
                              T {fmtMoney(b.tdsAmount)}
                              {billPendingTds(b) > 0 ? " (due)" : " (paid)"}
                            </div>
                            <div className={billPendingVds(b) > 0 ? "text-rose-700" : "text-ink-400"}>
                              V {fmtMoney(b.vdsAmount)}
                              {billPendingVds(b) > 0 ? " (due)" : " (paid)"}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="font-semibold">{fmtMoney(b.netPayable)}</div>
                            <div className="text-[11px] text-ink-500">
                              paid {fmtMoney(b.paidAmount)} · bal {fmtMoney(billOutstanding(b))}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`rounded-xs px-1.5 py-0.5 text-[11px] font-semibold ${BILL_BADGE[b.status] ?? ""}`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex justify-end gap-1">
                              {b.status === "DRAFT" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => approveBill(b.id, b.billNo)}
                                    disabled={acting === `approve:${b.id}`}
                                    className="cursor-pointer rounded-xs bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => voidBill(b.id, b.billNo)}
                                    disabled={acting === `void:${b.id}`}
                                    className="cursor-pointer rounded-xs border border-ink-200 px-2 py-1 text-xs text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                                    title="Void draft"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              {(b.status === "APPROVED" || b.status === "PARTIAL") && (
                                <button
                                  type="button"
                                  onClick={() => (payBillId === b.id ? setPayBillId(null) : openPay(b))}
                                  className="cursor-pointer rounded-xs bg-brand-600 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                                >
                                  Pay
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {payBillId === b.id && (
                          <tr key={`${b.id}-pay`} className="border-b border-ink-100 bg-sky-50/50">
                            <td colSpan={7} className="px-2 py-2">
                              <div className="flex flex-wrap items-end gap-2">
                                <label className="grid gap-1 text-xs font-medium text-ink-600">
                                  Amount (bal {fmtMoney(billOutstanding(b))})
                                  <input
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    className={`${INPUT} w-36`}
                                    inputMode="decimal"
                                  />
                                </label>
                                <label className="grid gap-1 text-xs font-medium text-ink-600">
                                  From bank
                                  <select
                                    value={payBankGl}
                                    onChange={(e) => setPayBankGl(e.target.value)}
                                    className={`${INPUT} w-56`}
                                  >
                                    {bankAccounts.map((a) => (
                                      <option key={a.id} value={a.id}>
                                        {a.glCode} — {a.accountName}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => submitPay(b)}
                                  disabled={acting === `pay:${b.id}`}
                                  className="cursor-pointer rounded-xs bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                                >
                                  {acting === `pay:${b.id}` ? "Posting…" : "Post payment"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPayBillId(null)}
                                  className="cursor-pointer rounded-xs border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashCard>
        </div>
      )}

      {tab === "NBR Challan" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <DashCard title="Pending withholding">
            <p className="mb-2 text-xs text-ink-500">
              Undeposited total {fmtMoney(pendingTotal)} · selected {fmtMoney(selectedTotal)}
            </p>
            {pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">
                Nothing pending — all withheld tax is deposited.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-[11px] uppercase tracking-wide text-ink-500">
                      <th className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={selected.size === pending.length}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? new Set(pending.map((l) => `${l.billId}:${l.taxType}`))
                                : new Set(),
                            )
                          }
                          className="h-3.5 w-3.5 cursor-pointer accent-emerald-700"
                        />
                      </th>
                      <th className="px-2 py-1.5">Bill</th>
                      <th className="px-2 py-1.5">Tax</th>
                      <th className="px-2 py-1.5 text-right">Deducted</th>
                      <th className="px-2 py-1.5 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((l) => {
                      const key = `${l.billId}:${l.taxType}`;
                      return (
                        <tr key={key} className="border-b border-ink-100 hover:bg-ink-50/50">
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={selected.has(key)}
                              onChange={() => toggleLeg(key)}
                              className="h-3.5 w-3.5 cursor-pointer accent-emerald-700"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="font-semibold">{l.billNo}</div>
                            <div className="text-[11px] text-ink-500">
                              {l.vendorName} · {l.billDate}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`rounded-xs px-1.5 py-0.5 text-[11px] font-semibold ${
                                l.taxType === "TDS"
                                  ? "bg-violet-100 text-violet-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {l.taxType} {l.rate}%
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right text-ink-500">
                            {fmtMoney(l.deducted)}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold">
                            {fmtMoney(l.pending)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DashCard>

          <div className="grid content-start gap-4">
            <DashCard title="Deposit via Treasury challan">
              <div className="grid gap-2">
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Treasury challan no.
                  <input
                    value={cNo}
                    onChange={(e) => setCNo(e.target.value)}
                    className={`${INPUT} font-semibold`}
                    placeholder="e.g. TR-2026/0417"
                  />
                </label>
                <DatePickerField label="Challan date" value={cDate} onChange={setCDate} required />
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Paid from bank
                  <select
                    value={cBankGl}
                    onChange={(e) => setCBankGl(e.target.value)}
                    className={INPUT}
                  >
                    <option value="">— default 11201 —</option>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.glCode} — {a.accountName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Deposit bank / branch
                  <input
                    value={cBankName}
                    onChange={(e) => setCBankName(e.target.value)}
                    className={INPUT}
                    placeholder="e.g. Sonali Bank, Court Station Branch"
                  />
                </label>
                <div className="rounded-xs border border-ink-200 bg-ink-50/60 p-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-600">{selected.size} leg(s) selected</span>
                    <span className="font-bold">{fmtMoney(selectedTotal)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-500">
                    Posts Dr 21302/21304 / Cr bank. Each leg remits in full.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={remitChallan}
                  disabled={acting === "remit" || selected.size === 0}
                  className="cursor-pointer rounded-xs bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {acting === "remit" ? "Posting…" : "Post challan deposit"}
                </button>
              </div>
            </DashCard>

            <DashCard title="Challan register">
              {challans.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-500">No deposits yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {challans.map((c) => (
                    <li key={c.id} className="rounded-xs border border-ink-200 p-2 text-sm">
                      <button
                        type="button"
                        onClick={() => setOpenChallan(openChallan === c.id ? null : c.id)}
                        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
                      >
                        <span>
                          <span className="font-semibold">{c.challanNo}</span>{" "}
                          <span className="text-xs text-ink-500">
                            {c.challanDate} · {c.items.length} leg(s)
                            {c.glJournal ? ` · ${c.glJournal.voucherNo}` : ""}
                          </span>
                        </span>
                        <span className="font-bold">{fmtMoney(c.totalAmount)}</span>
                      </button>
                      {openChallan === c.id && (
                        <ul className="mt-1.5 grid gap-1 border-t border-ink-100 pt-1.5 text-xs text-ink-600">
                          {c.depositBankName && <li>Via {c.depositBankName}</li>}
                          {c.items.map((i) => (
                            <li key={i.id} className="flex justify-between">
                              <span>
                                {i.taxType} · {i.vendorBill?.billNo ?? i.vendorBillId}
                              </span>
                              <span className="font-semibold">{fmtMoney(i.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </DashCard>
          </div>
        </div>
      )}

      {tab === "Vendors" && (
        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <DashCard title="New vendor">
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Vendor name *
                <input value={vName} onChange={(e) => setVName(e.target.value)} className={INPUT} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Code
                  <input
                    value={vCode}
                    onChange={(e) => setVCode(e.target.value)}
                    className={INPUT}
                    placeholder="VND-0007"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  BIN no.
                  <input value={vBin} onChange={(e) => setVBin(e.target.value)} className={INPUT} />
                </label>
              </div>
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Trade license no.
                <input value={vTrade} onChange={(e) => setVTrade(e.target.value)} className={INPUT} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Contact person
                  <input
                    value={vPerson}
                    onChange={(e) => setVPerson(e.target.value)}
                    className={INPUT}
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Phone
                  <input
                    value={vPhone}
                    onChange={(e) => setVPhone(e.target.value)}
                    className={INPUT}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Address
                <input value={vAddr} onChange={(e) => setVAddr(e.target.value)} className={INPUT} />
              </label>
              <button
                type="button"
                onClick={createVendor}
                disabled={acting === "create-vendor"}
                className="cursor-pointer rounded-xs bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {acting === "create-vendor" ? "Saving…" : "Add vendor"}
              </button>
            </div>
          </DashCard>

          <DashCard title={`Vendors (${vendors.length})`}>
            {vendors.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No vendors yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-[11px] uppercase tracking-wide text-ink-500">
                      <th className="px-2 py-1.5">Vendor</th>
                      <th className="px-2 py-1.5">BIN / trade license</th>
                      <th className="px-2 py-1.5">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => (
                      <tr key={v.id} className="border-b border-ink-100">
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <Building2 className="h-3.5 w-3.5 text-ink-400" />
                            {v.vendorName}
                          </div>
                          <div className="text-[11px] text-ink-500">
                            {v.vendorCode ?? "no code"}
                            {v.address ? ` · ${v.address}` : ""}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-xs text-ink-600">
                          {v.binNo ? `BIN ${v.binNo}` : "—"}
                          {v.tradeLicenseNo ? ` · TL ${v.tradeLicenseNo}` : ""}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-ink-600">
                          {v.contactPerson ?? "—"}
                          {v.contactPhone ? ` · ${v.contactPhone}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashCard>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 text-xs text-ink-500">
        <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Approval posts Dr 5xxxx/121xx (gross) / Cr 21101 AP (net) + Cr 21302 TDS + Cr 21304 VDS
          within one fund. Challan deposits post Dr 21302/21304 / Cr operating bank.{" "}
          <span className="inline-flex items-center gap-1">
            <ReceiptText className="h-3 w-3" /> Voucher numbers appear beside each posted row.
          </span>
        </p>
      </div>
    </div>
  );
}
