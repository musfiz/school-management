"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Printer, Search, Undo2, ArrowRightLeft, Receipt } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import PrintMenu from "@/components/dashboard/PrintMenu";
import { apiFetch } from "@/lib/api";
import { confirmDialog, promptDialog, toast } from "@/lib/swal";
import DatePickerField from "@/components/ui/DatePicker";
import type { ChartOfAccount } from "@/lib/accounting";
import { dueOf, fmtMoney, type StudentInvoice } from "@/lib/billing";
import {
  CHANNEL_LABELS,
  PAYMENT_CHANNELS,
  invoiceDue,
  isMfs,
  parseAllocation,
  tdrFor,
  type DuesResponse,
  type PaymentChannel,
  type PaymentCollection,
} from "@/lib/collection";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const STATUS_BADGE: Record<string, string> = {
  COLLECTED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  SETTLED: "bg-sky-100 text-sky-800",
  REVERSED: "bg-zinc-200 text-zinc-500 line-through",
};

const TABS = ["Collect", "Receipts", "Settlement"] as const;
type Tab = (typeof TABS)[number];

const today = () => new Date().toISOString().slice(0, 10);

export default function CollectionView() {
  const [tab, setTab] = useState<Tab>("Collect");
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [receipts, setReceipts] = useState<PaymentCollection[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  // POS lookup
  const [studentId, setStudentId] = useState("");
  const [dues, setDues] = useState<DuesResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loadingDues, setLoadingDues] = useState(false);

  // payment panel
  const [channel, setChannel] = useState<PaymentChannel>("CASH");
  const [cashGl, setCashGl] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [gatewayTrx, setGatewayTrx] = useState("");
  const [txnDate, setTxnDate] = useState(today());
  const [tdrOverride, setTdrOverride] = useState("");

  // receipts filter
  const [rStudent, setRStudent] = useState("");
  const [rStatus, setRStatus] = useState("");
  const [rChannel, setRChannel] = useState("");

  // print modal
  const [printReceipt, setPrintReceipt] = useState<PaymentCollection | null>(null);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (rStudent.trim()) params.set("studentId", rStudent.trim());
      if (rStatus) params.set("status", rStatus);
      if (rChannel) params.set("channel", rChannel);
      const [a, r] = await Promise.all([
        apiFetch<ChartOfAccount[]>("/api/accounting/chart-of-accounts?activeOnly=true"),
        apiFetch<PaymentCollection[]>(`/api/accounting/collection/receipts?${params.toString()}`),
      ]);
      setAccounts(Array.isArray(a) ? a : []);
      setReceipts(Array.isArray(r) ? r : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load collection", "error");
    } finally {
      setLoading(false);
    }
  }, [rStudent, rStatus, rChannel]);

  useEffect(() => {
    const t = setTimeout(loadBase, 350);
    return () => clearTimeout(t);
  }, [loadBase]);

  const cashAccounts = useMemo(() => accounts.filter((a) => a.isCashOrBank), [accounts]);
  const defaultCashGl = useMemo(() => {
    const pick = (code: string) => cashAccounts.find((a) => a.glCode === code)?.id ?? "";
    if (channel === "BANK_CHALLAN") return pick("11201");
    if (channel === "BKASH") return pick("11301");
    if (channel === "NAGAD" || channel === "ROCKET") return pick("11302");
    if (channel === "SSLCOMMERZ" || channel === "UPAY" || channel === "EKPAY") return pick("11303");
    return pick("11101");
  }, [cashAccounts, channel]);
  const effectiveCashGl = cashGl || defaultCashGl;

  const cart: { inv: StudentInvoice; amount: number; tdr: number; net: number }[] = useMemo(() => {
    if (!dues) return [];
    const picked = dues.open.filter((i) => selected.has(i.id));
    // TDR override is a cart total — split it across receipts with the
    // rounding remainder on the last one so the sum is exact.
    const overrideTotal = tdrOverride.trim() ? Number(tdrOverride) : NaN;
    const hasOverride = Number.isFinite(overrideTotal) && overrideTotal >= 0;
    let assigned = 0;
    return picked.map((inv, idx) => {
      const due = invoiceDue(inv);
      const raw = amounts[inv.id]?.trim();
      const amount = raw ? Math.round(Number(raw) * 100) / 100 : due;
      let tdr: number;
      if (hasOverride) {
        tdr =
          idx === picked.length - 1
            ? Math.round((overrideTotal - assigned) * 100) / 100
            : Math.round((overrideTotal / picked.length) * 100) / 100;
        assigned = Math.round((assigned + tdr) * 100) / 100;
      } else {
        tdr = tdrFor(channel, amount);
      }
      return { inv, amount, tdr, net: Math.round((amount - tdr) * 100) / 100 };
    });
  }, [dues, selected, amounts, channel, tdrOverride]);

  const cartGross = cart.reduce((t, c) => t + (Number.isFinite(c.amount) ? c.amount : 0), 0);
  const cartTdr = cart.reduce((t, c) => t + (Number.isFinite(c.tdr) ? c.tdr : 0), 0);

  async function loadDues() {
    if (!studentId.trim()) {
      toast("Enter a student UUID to load dues.", "warning");
      return;
    }
    setLoadingDues(true);
    try {
      const data = await apiFetch<DuesResponse>(
        `/api/accounting/collection/dues/${studentId.trim()}`,
      );
      setDues(data);
      const all = new Set(data.open.map((i) => i.id));
      setSelected(all);
      setAmounts(Object.fromEntries(data.open.map((i) => [i.id, invoiceDue(i).toFixed(2)])));
      if (data.open.length === 0) toast("No open invoices — student is fully paid.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Dues lookup failed", "error");
    } finally {
      setLoadingDues(false);
    }
  }

  async function collect() {
    if (cart.length === 0) {
      toast("Select at least one invoice.", "warning");
      return;
    }
    if (isMfs(channel) && !gatewayTrx.trim()) {
      toast(`${CHANNEL_LABELS[channel]} needs a gateway transaction id (idempotency key).`, "warning");
      return;
    }
    for (const c of cart) {
      if (!(c.amount > 0)) {
        toast(`Amount for ${c.inv.invoiceNo} must be positive.`, "warning");
        return;
      }
      if (c.amount - invoiceDue(c.inv) > 0.005) {
        toast(`${c.inv.invoiceNo} due is ${fmtMoney(invoiceDue(c.inv))} — overpayment blocked.`, "warning");
        return;
      }
      if (!(c.tdr >= 0) || c.tdr - c.amount > 0.005) {
        toast(`TDR for ${c.inv.invoiceNo} must be 0 ≤ TDR < gross.`, "warning");
        return;
      }
    }
    if (tdrOverride.trim() && (!Number.isFinite(Number(tdrOverride)) || Number(tdrOverride) < 0)) {
      toast("TDR override must be a non-negative number.", "warning");
      return;
    }
    setActing("collect");
    try {
      const done: PaymentCollection[] = [];
      const baseTrx = gatewayTrx.trim();
      for (let idx = 0; idx < cart.length; idx++) {
        const c = cart[idx];
        // One receipt per invoice, each needing its own idempotency key —
        // suffix the counter trx id so replays stay idempotent per receipt.
        const trxId = isMfs(channel)
          ? cart.length === 1
            ? baseTrx
            : `${baseTrx}-${idx + 1}`
          : undefined;
        try {
          const receipt = await apiFetch<PaymentCollection>("/api/accounting/collection/collect", {
            method: "POST",
            body: JSON.stringify({
              studentId: dues!.studentId,
              invoiceId: c.inv.id,
              amount: c.amount.toFixed(2),
              paymentChannel: channel,
              ...(effectiveCashGl ? { cashGlId: effectiveCashGl } : {}),
              ...(isMfs(channel) ? { tdrFee: c.tdr.toFixed(2), gatewayTrxId: trxId } : {}),
              ...(bankRef.trim() ? { bankReference: bankRef.trim() } : {}),
              transactionDate: txnDate,
            }),
          });
          done.push(receipt);
        } catch (e) {
          // Earlier receipts in this cart already posted — report exactly
          // where the batch stopped instead of a bare failure.
          if (done.length === 0) throw e;
          toast(
            `Stopped at ${c.inv.invoiceNo}: ${e instanceof Error ? e.message : "failed"}. ${done.length} receipt${done.length > 1 ? "s" : ""} posted (${done.map((d) => d.moneyReceiptNo).join(", ")}).`,
            "warning",
          );
          setPrintReceipt(done[done.length - 1]);
          loadBase();
          if (studentId.trim()) loadDues();
          return;
        }
      }
      toast(
        `${done.length} receipt${done.length > 1 ? "s" : ""} posted (${done.map((d) => d.moneyReceiptNo).join(", ")})`,
        "success",
      );
      setPrintReceipt(done[done.length - 1]);
      setGatewayTrx("");
      setBankRef("");
      setTdrOverride("");
      loadBase();
      if (studentId.trim()) loadDues();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Collection failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function settleReceipt(id: string, no: string) {
    const ref = await promptDialog({
      title: `Settle ${no} → bank?`,
      text: "Posts CONTRA Dr 11201 Mother Bank / Cr 1130x Clearing (net).",
      input: "text",
      placeholder: "Bank scroll / settlement ref (optional)",
      confirmText: "Post settlement",
      icon: "question",
    });
    if (ref === null) return;
    setActing(`settle:${id}`);
    try {
      await apiFetch(`/api/accounting/collection/receipts/${id}/settle`, {
        method: "POST",
        body: JSON.stringify({
          ...(ref.trim() ? { settlementRef: ref.trim() } : {}),
          transactionDate: today(),
        }),
      });
      toast(`${no} settled to bank`, "success");
      loadBase();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Settlement failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function reverseReceipt(id: string, no: string) {
    const ok = await confirmDialog({
      title: `Reverse ${no}?`,
      text: "An offsetting MFS_COLLECTION journal is posted and the invoice due is restored. Settled receipts must reverse their CONTRA voucher first.",
      confirmText: "Yes, reverse",
      icon: "warning",
      danger: true,
    });
    if (!ok) return;
    setActing(`rev:${id}`);
    try {
      await apiFetch(`/api/accounting/collection/receipts/${id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: `Counter correction of ${no}` }),
      });
      toast(`${no} reversed`, "success");
      loadBase();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reverse failed", "error");
    } finally {
      setActing(null);
    }
  }

  const pending = receipts.filter((r) => r.reconciliationStatus === "PENDING");

  if (loading) return <AdminPageLoader />;

  return (
    <div>
      <DashPageHeader
        title="Fee Collection (POS)"
        description="Counter cash, bank challan and MFS — gross credits the student ledger, TDR splits to 54103, clearing settles via CONTRA. Receipts are MR-YYYY-XXXXXX."
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
            {t === "Settlement" && pending.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[11px] text-ink-900">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Collect" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <DashCard title="1 — Find student dues">
            <div className="flex flex-wrap gap-2">
              <input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Student UUID (sub-ledger)"
                className={`${INPUT} min-w-56 flex-1 font-mono`}
              />
              <button
                type="button"
                disabled={loadingDues}
                onClick={loadDues}
                className="flex items-center gap-1 rounded-xs bg-brand-600 px-3 py-1 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Search className="h-4 w-4" /> {loadingDues ? "Loading…" : "Load dues"}
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Roll / phone / barcode-challan search lights up once the People phase ships a Student
              master — the UUID sub-ledger is the key until then.
            </p>
            {dues && (
              <div className="mt-3">
                <div className="mb-2 rounded-xs bg-ink-900 p-2.5 font-mono text-xs text-white">
                  Open {dues.summary.openCount} · Total due{" "}
                  <span className="font-bold text-amber-300">{fmtMoney(dues.summary.totalDue)}</span>
                </div>
                <div className="space-y-2">
                  {dues.open.map((inv) => {
                    const due = invoiceDue(inv);
                    const checked = selected.has(inv.id);
                    return (
                      <div
                        key={inv.id}
                        className={`rounded-xs border p-2 ${checked ? "border-brand-300 bg-brand-50/40" : "border-ink-200"}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              className="cursor-pointer"
                              checked={checked}
                              onChange={() =>
                                setSelected((p) => {
                                  const n = new Set(p);
                                  if (n.has(inv.id)) n.delete(inv.id);
                                  else n.add(inv.id);
                                  return n;
                                })
                              }
                            />
                            <span className="font-mono text-sm font-bold">{inv.invoiceNo}</span>
                          </label>
                          <span className="text-xs text-ink-500">
                            {inv.billingPeriod} · due {String(inv.dueDate).slice(0, 10)}
                          </span>
                          <span className="ml-auto font-mono text-xs">
                            N {fmtMoney(inv.netAmount)}
                            {Number(inv.lateFineAmount) > 0 && (
                              <span className="text-rose-600"> + F {fmtMoney(inv.lateFineAmount)}</span>
                            )}{" "}
                            − P {fmtMoney(inv.paidAmount)} ={" "}
                            <b className="text-rose-700">{fmtMoney(due)}</b>
                          </span>
                        </div>
                        {checked && (
                          <div className="mt-1.5 flex items-center gap-2 pl-6">
                            <span className="text-xs text-ink-500">Collect</span>
                            <input
                              value={amounts[inv.id] ?? ""}
                              onChange={(e) =>
                                setAmounts((p) => ({ ...p, [inv.id]: e.target.value }))
                              }
                              inputMode="decimal"
                              className={`${INPUT} max-w-36 text-right font-mono`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setAmounts((p) => ({ ...p, [inv.id]: due.toFixed(2) }))
                              }
                              className="rounded-xs border border-ink-200 px-2 py-1 text-xs text-ink-600 hover:bg-ink-100"
                            >
                              Full
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dues.open.length === 0 && (
                    <p className="py-4 text-center text-sm text-ink-500">
                      Nothing due — all invoices PAID.
                    </p>
                  )}
                </div>
              </div>
            )}
          </DashCard>

          <DashCard title="2 — Payment & receipt">
            <div className="grid gap-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-ink-700">Method</span>
                <select value={channel} onChange={(e) => { setChannel(e.target.value as PaymentChannel); setCashGl(""); }} className={INPUT}>
                  {PAYMENT_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABELS[c]}
                      {isMfs(c) ? ` (TDR ${tdrFor(c, 100) > 0 ? `${(tdrFor(c, 100)).toFixed(2)}/100` : ""})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-ink-700">
                  Debit account {effectiveCashGl ? "" : "(seed CoA first)"}
                </span>
                <select value={cashGl} onChange={(e) => setCashGl(e.target.value)} className={INPUT}>
                  <option value="">Auto ({cashAccounts.find((a) => a.id === defaultCashGl)?.glCode ?? "…"})</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.glCode} — {a.accountName}
                    </option>
                  ))}
                </select>
              </label>
              {isMfs(channel) && (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-ink-700">Gateway trx id *</span>
                    <input
                      value={gatewayTrx}
                      onChange={(e) => setGatewayTrx(e.target.value)}
                      placeholder={cart.length > 1 ? "e.g. 9HXK2M4PQR (suffixed -1, -2 per receipt)" : "e.g. 9HXK2M4PQR"}
                      className={`${INPUT} font-mono`}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-ink-700">
                      TDR override (total, auto {fmtMoney(cartTdr)})
                    </span>
                    <input
                      value={tdrOverride}
                      onChange={(e) => setTdrOverride(e.target.value)}
                      placeholder="Leave blank for channel %"
                      inputMode="decimal"
                      className={`${INPUT} text-right font-mono`}
                    />
                  </label>
                </>
              )}
              {(channel === "BANK_CHALLAN") && (
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-700">Challan / scroll no.</span>
                  <input value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="e.g. SC-2026-88412" className={`${INPUT} font-mono`} />
                </label>
              )}
              <DatePickerField label="Transaction date" value={txnDate} onChange={setTxnDate} required />
              <div className="rounded-xs bg-ink-900 p-2.5 font-mono text-xs text-white">
                <div className="flex justify-between"><span>Gross (ledger credit)</span><b>{fmtMoney(cartGross)}</b></div>
                {isMfs(channel) && (
                  <div className="flex justify-between text-amber-300"><span>TDR → 54103</span><span>{fmtMoney(cartTdr)}</span></div>
                )}
                <div className="flex justify-between border-t border-white/20 pt-1 text-sm">
                  <span>{isMfs(channel) ? "Net → 1130x clearing" : "Net → cash/bank"}</span>
                  <b className="text-emerald-300">{fmtMoney(Math.round((cartGross - cartTdr) * 100) / 100)}</b>
                </div>
              </div>
              <button
                type="button"
                disabled={acting === "collect" || cart.length === 0}
                onClick={collect}
                className="flex items-center justify-center gap-1.5 rounded-xs bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Banknote className="h-4 w-4" />
                {acting === "collect" ? "Posting…" : `Collect ${cart.length} invoice${cart.length === 1 ? "" : "s"} → print MR`}
              </button>
              <p className="text-xs text-ink-500">
                Allocation priority per receipt: late fine → tuition → other heads. Partial
                payments flip invoices to PARTIAL; full payment to PAID.
              </p>
            </div>
          </DashCard>
        </div>
      )}

      {tab === "Receipts" && (
        <DashCard title={`Money receipts (${receipts.length})`}>
          <div className="mb-3 flex flex-wrap gap-2">
            <input value={rStudent} onChange={(e) => setRStudent(e.target.value)} placeholder="Filter by student UUID…" className={`${INPUT} max-w-72 font-mono`} />
            <select value={rStatus} onChange={(e) => setRStatus(e.target.value)} className="rounded-xs cursor-pointer border border-ink-200 bg-white px-2 py-1 text-sm">
              <option value="">All statuses</option>
              {["COLLECTED", "PENDING", "SETTLED", "REVERSED"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={rChannel} onChange={(e) => setRChannel(e.target.value)} className="rounded-xs cursor-pointer border border-ink-200 bg-white px-2 py-1 text-sm">
              <option value="">All channels</option>
              {PAYMENT_CHANNELS.map((c) => (
                <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {receipts.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xs border border-ink-200 px-3 py-2">
                <button type="button" onClick={() => setPrintReceipt(r)} className="font-mono text-sm font-bold text-brand-700 hover:underline">
                  {r.moneyReceiptNo}
                </button>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[r.reconciliationStatus]}`}>
                  {r.reconciliationStatus}
                </span>
                <span className="text-xs text-ink-500">
                  {CHANNEL_LABELS[r.paymentChannel]} · inv {r.invoice?.invoiceNo ?? r.invoiceId.slice(0, 8)}
                  {r.gatewayTrxId ? ` · trx ${r.gatewayTrxId}` : ""}
                  {r.bankReference ? ` · ${r.bankReference}` : ""}
                </span>
                <span className="ml-auto font-mono text-xs">
                  G {fmtMoney(r.collectedGrossAmount)}
                  {Number(r.gatewayTdrFee) > 0 && <span className="text-amber-700"> − TDR {fmtMoney(r.gatewayTdrFee)}</span>}
                  {" = "}N <b>{fmtMoney(r.netBankAmount)}</b>
                  <span className="text-ink-500"> → {r.cashGl ? r.cashGl.glCode : ""}</span>
                </span>
                <span className="flex gap-1.5">
                  <button type="button" onClick={() => setPrintReceipt(r)} title="Print money receipt" className="flex items-center gap-1 rounded-xs border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-100">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </button>
                  {r.reconciliationStatus === "PENDING" && (
                    <button type="button" disabled={!!acting} onClick={() => settleReceipt(r.id, r.moneyReceiptNo)} className="flex items-center gap-1 rounded-xs bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Settle
                    </button>
                  )}
                  {!["REVERSED", "SETTLED"].includes(r.reconciliationStatus) && (
                    <button type="button" disabled={!!acting} onClick={() => reverseReceipt(r.id, r.moneyReceiptNo)} className="flex items-center gap-1 rounded-xs border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                      <Undo2 className="h-3.5 w-3.5" /> Reverse
                    </button>
                  )}
                </span>
              </div>
            ))}
            {receipts.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-500">No receipts yet — collect the first one in the Collect tab.</p>
            )}
          </div>
        </DashCard>
      )}

      {tab === "Settlement" && (
        <DashCard title={`MFS settlement queue (${pending.length} pending) — bank scroll reconciliation`}>
          <p className="mb-3 text-sm text-ink-600">
            Gateway money lands in 1130x clearing first. When the bank scroll confirms the payout,
            settle each receipt: <code>Dr 11201 Mother Bank / Cr 1130x Clearing</code> (CONTRA).
            Instant channels (cash / challan) never appear here.
          </p>
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xs border border-amber-200 bg-amber-50/50 px-3 py-2">
                <span className="font-mono text-sm font-bold">{r.moneyReceiptNo}</span>
                <span className="text-xs text-ink-600">
                  {CHANNEL_LABELS[r.paymentChannel]} · trx {r.gatewayTrxId ?? "—"} · net{" "}
                  <b className="font-mono">{fmtMoney(r.netBankAmount)}</b> in {r.cashGl ? `${r.cashGl.glCode} ${r.cashGl.accountName}` : "clearing"}
                </span>
                <button
                  type="button"
                  disabled={!!acting}
                  onClick={() => settleReceipt(r.id, r.moneyReceiptNo)}
                  className="ml-auto flex items-center gap-1 rounded-xs bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  {acting === `settle:${r.id}` ? "Settling…" : "Settle → 11201"}
                </button>
              </div>
            ))}
            {pending.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-500">Clearing is clean — nothing pending settlement.</p>
            )}
          </div>
        </DashCard>
      )}

      {printReceipt && (
        <ReceiptModal receipt={printReceipt} onClose={() => setPrintReceipt(null)} />
      )}
    </div>
  );
}

function ReceiptModal({ receipt, onClose }: { receipt: PaymentCollection; onClose: () => void }) {
  const legs = parseAllocation(receipt.allocation);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xs bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="receipt-print-area">
        <div className="border-b-2 border-dashed border-ink-200 pb-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-lg font-bold">
            <Receipt className="h-5 w-5" /> MONEY RECEIPT
          </p>
          <p className="font-mono text-xl font-bold text-brand-700">{receipt.moneyReceiptNo}</p>
          <p className="text-xs text-ink-500">
            {String(receipt.createdAt ?? "").slice(0, 10)} · {CHANNEL_LABELS[receipt.paymentChannel]}
          </p>
        </div>
        <dl className="mt-3 space-y-1 font-mono text-sm">
          <div className="flex justify-between"><dt className="text-ink-500">Invoice</dt><dd className="font-bold">{receipt.invoice?.invoiceNo ?? receipt.invoiceId.slice(0, 13)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Student</dt><dd>{receipt.studentId.slice(0, 13)}…</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Gross received</dt><dd className="font-bold">{fmtMoney(receipt.collectedGrossAmount)}</dd></div>
          {Number(receipt.gatewayTdrFee) > 0 && (
            <div className="flex justify-between"><dt className="text-ink-500">TDR (→ 54103)</dt><dd>{fmtMoney(receipt.gatewayTdrFee)}</dd></div>
          )}
          <div className="flex justify-between border-t border-dashed border-ink-200 pt-1 text-base">
            <dt className="text-ink-700">Net → {receipt.cashGl ? receipt.cashGl.glCode : "cash"}</dt>
            <dd className="font-bold">{fmtMoney(receipt.netBankAmount)}</dd>
          </div>
          {receipt.gatewayTrxId && (
            <div className="flex justify-between"><dt className="text-ink-500">Gateway trx</dt><dd>{receipt.gatewayTrxId}</dd></div>
          )}
          {receipt.bankReference && (
            <div className="flex justify-between"><dt className="text-ink-500">Ref</dt><dd>{receipt.bankReference}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-ink-500">Status</dt><dd>{receipt.reconciliationStatus}</dd></div>
        </dl>
        {legs.length > 0 && (
          <div className="mt-2 rounded-xs bg-ink-50 p-2 text-xs">
            <p className="mb-1 font-semibold text-ink-600">Allocation (fine → tuition → other)</p>
            {legs.map((l, i) => (
              <div key={i} className="flex justify-between font-mono">
                <span>{l.label} · {l.glCode}</span><span>{fmtMoney(l.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-center font-mono text-[11px] text-ink-400">
          System receipt · voucher {receipt.glJournalId?.slice(0, 13) ?? "—"} · due now {receipt.invoice ? fmtMoney(dueOf(receipt.invoice)) : "—"}
        </p>
        </div>
        <div className="mt-4 flex gap-2">
          <PrintMenu
            title={`Money Receipt ${receipt.moneyReceiptNo}`}
            printTargetId="receipt-print-area"
            pdfUrl={`/api/documents/money-receipt/${receipt.id}/pdf`}
            fileName={`${receipt.moneyReceiptNo}.pdf`}
            className="flex-1"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xs border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
