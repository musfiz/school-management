"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark, Trash2 } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { apiFetch } from "@/lib/api";
import { confirmDialog, toast } from "@/lib/swal";
import DatePickerField from "@/components/ui/DatePicker";
import type { ChartOfAccount, CostCenter, Fund } from "@/lib/accounting";
import { fmtMoney } from "@/lib/billing";
import {
  calcHonorarium,
  calcPayslipNet,
  type HonorariumBill,
  type PayrollRun,
} from "@/lib/payroll";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const RUN_BADGE: Record<string, string> = {
  DRAFT: "bg-zinc-200 text-zinc-700",
  APPROVED: "bg-sky-100 text-sky-800",
  PAID: "bg-emerald-100 text-emerald-800",
  REVERSED: "bg-zinc-200 text-zinc-500 line-through",
};

const TABS = ["Salary Runs", "Honorarium"] as const;
type Tab = (typeof TABS)[number];

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
const int = (s: string) => (s.trim() === "" ? 0 : Math.floor(Number(s)));

export default function PayrollView() {
  const [tab, setTab] = useState<Tab>("Salary Runs");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const [funds, setFunds] = useState<Fund[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [bills, setBills] = useState<HonorariumBill[]>([]);

  // new run
  const [rMonth, setRMonth] = useState(thisMonth());
  const [rPayDate, setRPayDate] = useState(today());
  const [rFund, setRFund] = useState("");
  const [rCostCenter, setRCostCenter] = useState("");
  const [rNarr, setRNarr] = useState("");

  // run detail
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [payBankGl, setPayBankGl] = useState("");

  // payslip form (per open run)
  const [sName, setSName] = useState("");
  const [sDesig, setSDesig] = useState("");
  const [sEmpId, setSEmpId] = useState("");
  const [sMpo, setSMpo] = useState("");
  const [sGross, setSGross] = useState("");
  const [sPfEmp, setSPfEmp] = useState("");
  const [sPfEr, setSPfEr] = useState("");
  const [sAit, setSAit] = useState("");
  const [sLoan, setSLoan] = useState("");

  // honorarium form
  const [hName, setHName] = useState("");
  const [hMonth, setHMonth] = useState(thisMonth());
  const [hClasses, setHClasses] = useState("");
  const [hScripts, setHScripts] = useState("");
  const [hViva, setHViva] = useState("");
  const [hRateC, setHRateC] = useState("1000");
  const [hRateS, setHRateS] = useState("250");
  const [hRateV, setHRateV] = useState("500");
  const [hTds, setHTds] = useState("10");
  const [hFund, setHFund] = useState("");
  const [hCostCenter, setHCostCenter] = useState("");
  const [hNarr, setHNarr] = useState("");

  const bankAccounts = useMemo(() => accounts.filter((a) => a.isCashOrBank), [accounts]);

  const slipNet = useMemo(
    () => calcPayslipNet(num(sGross), num(sPfEmp), num(sAit), num(sLoan)),
    [sGross, sPfEmp, sAit, sLoan],
  );
  const honPreview = useMemo(
    () =>
      calcHonorarium(
        int(hClasses),
        int(hScripts),
        int(hViva),
        num(hRateC),
        num(hRateS),
        num(hRateV),
        num(hTds),
      ),
    [hClasses, hScripts, hViva, hRateC, hRateS, hRateV, hTds],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [f, a, c, r, h] = await Promise.all([
        apiFetch<Fund[]>("/api/accounting/funds"),
        apiFetch<ChartOfAccount[]>("/api/accounting/chart-of-accounts?activeOnly=true"),
        apiFetch<CostCenter[]>("/api/accounting/cost-centers"),
        apiFetch<PayrollRun[]>("/api/accounting/payroll/runs"),
        apiFetch<HonorariumBill[]>("/api/accounting/payroll/honoraria"),
      ]);
      const active = f.filter((x) => x.isActive);
      setFunds(active);
      setAccounts(a);
      setCostCenters(c.filter((x) => x.isActive));
      setRuns(r);
      setBills(h);
      const g = active.find((x) => x.fundCode === "01");
      if (g) {
        if (!rFund) setRFund(g.id);
        if (!hFund) setHFund(g.id);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load payroll desk.", "error");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  const refreshRuns = useCallback(async () => {
    try {
      const r = await apiFetch<PayrollRun[]>("/api/accounting/payroll/runs");
      setRuns(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to refresh runs.", "error");
    }
  }, []);

  const openRunData = openRun ? runs.find((r) => r.id === openRun) ?? null : null;

  /* ---------- salary run actions ---------- */

  async function createRun() {
    if (!rMonth) return toast("Payroll month is required.", "warning");
    if (!rPayDate) return toast("Pay date is required.", "warning");
    if (!rFund) return toast("Pick a fund.", "warning");
    setActing("create-run");
    try {
      const run = await apiFetch<PayrollRun>("/api/accounting/payroll/runs", {
        method: "POST",
        body: JSON.stringify({
          payrollMonth: rMonth,
          payDate: rPayDate,
          fundId: rFund,
          ...(rCostCenter ? { costCenterId: rCostCenter } : {}),
          ...(rNarr.trim() ? { narration: rNarr.trim() } : {}),
        }),
      });
      toast(`${run.runNo} opened.`);
      setRNarr("");
      setOpenRun(run.id);
      refreshRuns();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Run creation failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function addPayslip(run: PayrollRun) {
    if (!sName.trim()) return toast("Employee name is required.", "warning");
    if (!(num(sGross) > 0)) return toast("Institutional gross must be positive.", "warning");
    if (slipNet < 0) return toast("Deductions exceed gross — net would be negative.", "warning");
    if (sEmpId.trim() && !/^[0-9a-fA-F-]{36}$/.test(sEmpId.trim())) {
      return toast("Employee ID must be a UUID (or leave blank).", "warning");
    }
    setActing("add-slip");
    try {
      await apiFetch(`/api/accounting/payroll/runs/${run.id}/payslips`, {
        method: "POST",
        body: JSON.stringify({
          employeeName: sName.trim(),
          ...(sDesig.trim() ? { designation: sDesig.trim() } : {}),
          ...(sEmpId.trim() ? { employeeId: sEmpId.trim() } : {}),
          ...(sMpo.trim() ? { mpoGovtAmount: num(sMpo).toFixed(2) } : {}),
          institutionalGrossAmount: num(sGross).toFixed(2),
          ...(sPfEmp.trim() ? { pfEmployeeDeduction: num(sPfEmp).toFixed(2) } : {}),
          ...(sPfEr.trim() ? { pfEmployerContribution: num(sPfEr).toFixed(2) } : {}),
          ...(sAit.trim() ? { aitTdsDeduction: num(sAit).toFixed(2) } : {}),
          ...(sLoan.trim() ? { loanDeduction: num(sLoan).toFixed(2) } : {}),
        }),
      });
      toast(`Payslip for ${sName.trim()} added — net ${fmtMoney(slipNet)}.`);
      setSName("");
      setSDesig("");
      setSEmpId("");
      setSMpo("");
      setSGross("");
      setSPfEmp("");
      setSPfEr("");
      setSAit("");
      setSLoan("");
      refreshRuns();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Payslip failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function removePayslip(run: PayrollRun, slipId: string, name: string) {
    const ok = await confirmDialog({
      title: `Remove ${name}?`,
      text: "The payslip is deleted from this draft run.",
      confirmText: "Yes, remove",
      icon: "warning",
      danger: true,
    });
    if (!ok) return;
    setActing(`rm-slip:${slipId}`);
    try {
      await apiFetch(`/api/accounting/payroll/runs/${run.id}/payslips/${slipId}`, {
        method: "DELETE",
      });
      toast("Payslip removed.");
      refreshRuns();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Remove failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function approveRun(run: PayrollRun) {
    const ok = await confirmDialog({
      title: `Approve ${run.runNo}?`,
      text: `Posts Dr 51101 ${fmtMoney(run.institutionalGrossTotal)} + Dr 51104 ${fmtMoney(run.pfEmployerTotal)}. MPO ${fmtMoney(run.mpoGovtTotal)} stays informational — never posted.`,
      confirmText: "Yes, approve & post",
      icon: "question",
    });
    if (!ok) return;
    setActing(`approve:${run.id}`);
    try {
      await apiFetch(`/api/accounting/payroll/runs/${run.id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast(`${run.runNo} posted.`);
      refreshRuns();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Approval failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function payRun(run: PayrollRun) {
    const ok = await confirmDialog({
      title: `Disburse ${run.runNo}?`,
      text: `Pays the full net ${fmtMoney(run.netPayableTotal)} to ${(run.lines ?? []).length} employee(s).`,
      confirmText: "Yes, disburse",
      icon: "question",
    });
    if (!ok) return;
    setActing(`pay:${run.id}`);
    try {
      await apiFetch(`/api/accounting/payroll/runs/${run.id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          ...(payBankGl ? { bankGlId: payBankGl } : {}),
          transactionDate: today(),
        }),
      });
      toast(`${run.runNo} disbursed.`);
      refreshRuns();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Disbursement failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function voidRun(run: PayrollRun) {
    const ok = await confirmDialog({
      title: `Void draft ${run.runNo}?`,
      text: "This cannot be undone.",
      confirmText: "Yes, void",
      icon: "warning",
      danger: true,
    });
    if (!ok) return;
    setActing(`void:${run.id}`);
    try {
      await apiFetch(`/api/accounting/payroll/runs/${run.id}`, { method: "DELETE" });
      toast(`${run.runNo} voided.`);
      if (openRun === run.id) setOpenRun(null);
      refreshRuns();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Void failed.", "error");
    } finally {
      setActing(null);
    }
  }

  /* ---------- honorarium actions ---------- */

  async function createHonorarium() {
    if (!hName.trim()) return toast("Adjunct name is required.", "warning");
    if (!hMonth) return toast("Work month is required.", "warning");
    if (honPreview.gross <= 0) return toast("Workload is zero — nothing to bill.", "warning");
    const tds = num(hTds);
    if (!(tds >= 10 && tds <= 15)) return toast("Honorarium TDS must be 10–15%.", "warning");
    if (!hFund) return toast("Pick a fund.", "warning");
    setActing("create-hon");
    try {
      const bill = await apiFetch<HonorariumBill>("/api/accounting/payroll/honoraria", {
        method: "POST",
        body: JSON.stringify({
          adjunctName: hName.trim(),
          workMonth: hMonth,
          classesCount: int(hClasses),
          scriptsCount: int(hScripts),
          vivaCount: int(hViva),
          ratePerClass: num(hRateC).toFixed(2),
          ratePerScript: num(hRateS).toFixed(2),
          ratePerViva: num(hRateV).toFixed(2),
          tdsRate: tds.toString(),
          fundId: hFund,
          ...(hCostCenter ? { costCenterId: hCostCenter } : {}),
          ...(hNarr.trim() ? { narration: hNarr.trim() } : {}),
        }),
      });
      toast(`Draft ${bill.billNo} saved — net ${fmtMoney(bill.netPayable)}.`);
      setHName("");
      setHClasses("");
      setHScripts("");
      setHViva("");
      setHNarr("");
      const h = await apiFetch<HonorariumBill[]>("/api/accounting/payroll/honoraria");
      setBills(h);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Honorarium entry failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function approveHonorarium(bill: HonorariumBill) {
    const ok = await confirmDialog({
      title: `Approve ${bill.billNo}?`,
      text: `Posts Dr 51103 ${fmtMoney(bill.grossAmount)} / Cr 21103 ${fmtMoney(bill.netPayable)} + Cr 21303 ${fmtMoney(bill.tdsAmount)}.`,
      confirmText: "Yes, approve & post",
      icon: "question",
    });
    if (!ok) return;
    setActing(`approve-hon:${bill.id}`);
    try {
      await apiFetch(`/api/accounting/payroll/honoraria/${bill.id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast(`${bill.billNo} posted.`);
      const h = await apiFetch<HonorariumBill[]>("/api/accounting/payroll/honoraria");
      setBills(h);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Approval failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function payHonorarium(bill: HonorariumBill) {
    setActing(`pay-hon:${bill.id}`);
    try {
      await apiFetch(`/api/accounting/payroll/honoraria/${bill.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ transactionDate: today() }),
      });
      toast(`${bill.billNo} paid ${fmtMoney(bill.netPayable)}.`);
      const h = await apiFetch<HonorariumBill[]>("/api/accounting/payroll/honoraria");
      setBills(h);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Payment failed.", "error");
    } finally {
      setActing(null);
    }
  }

  async function voidHonorarium(bill: HonorariumBill) {
    const ok = await confirmDialog({
      title: `Void draft ${bill.billNo}?`,
      text: "This cannot be undone.",
      confirmText: "Yes, void",
      icon: "warning",
      danger: true,
    });
    if (!ok) return;
    setActing(`void-hon:${bill.id}`);
    try {
      await apiFetch(`/api/accounting/payroll/honoraria/${bill.id}`, { method: "DELETE" });
      toast(`${bill.billNo} voided.`);
      const h = await apiFetch<HonorariumBill[]>("/api/accounting/payroll/honoraria");
      setBills(h);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Void failed.", "error");
    } finally {
      setActing(null);
    }
  }

  if (loading) return <AdminPageLoader />;

  return (
    <div>
      <DashPageHeader
        title="Payroll & MPO"
        description="Monthly salary runs with MPO isolation, adjunct honorarium and PF tracking."
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
          </button>
        ))}
      </div>

      {tab === "Salary Runs" && (
        <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
          <DashCard title="New salary run">
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Payroll month
                <input
                  type="month"
                  value={rMonth}
                  onChange={(e) => setRMonth(e.target.value)}
                  className={INPUT}
                />
              </label>
              <DatePickerField label="Pay date" value={rPayDate} onChange={setRPayDate} required />
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Fund
                <select value={rFund} onChange={(e) => setRFund(e.target.value)} className={INPUT}>
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
                  value={rCostCenter}
                  onChange={(e) => setRCostCenter(e.target.value)}
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
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Narration
                <input
                  value={rNarr}
                  onChange={(e) => setRNarr(e.target.value)}
                  className={INPUT}
                  placeholder="e.g. October regular staff"
                />
              </label>
              <button
                type="button"
                onClick={createRun}
                disabled={acting === "create-run"}
                className="cursor-pointer rounded-xs bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {acting === "create-run" ? "Opening…" : "Open draft run"}
              </button>
            </div>
          </DashCard>

          <DashCard title={`Salary runs (${runs.length})`}>
            {runs.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No runs yet.</p>
            ) : (
              <ul className="grid gap-2">
                {runs.map((r) => (
                  <li key={r.id} className="rounded-xs border border-ink-200 p-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenRun(openRun === r.id ? null : r.id)}
                      className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 text-left"
                    >
                      <span className="text-sm">
                        <span className="font-bold">{r.runNo}</span>{" "}
                        <span className="text-ink-500">
                          {r.payrollMonth} · {(r.lines ?? []).length} slip(s)
                          {r.glJournal ? ` · ${r.glJournal.voucherNo}` : ""}
                          {r.paymentJournal ? ` · paid ${r.paymentJournal.voucherNo}` : ""}
                        </span>{" "}
                        <span
                          className={`rounded-xs px-1.5 py-0.5 text-[11px] font-semibold ${RUN_BADGE[r.status] ?? ""}`}
                        >
                          {r.status}
                        </span>
                      </span>
                      <span className="text-right text-sm">
                        <span className="font-bold">Net {fmtMoney(r.netPayableTotal)}</span>{" "}
                        <span className="text-[11px] text-ink-500">
                          (MPO {fmtMoney(r.mpoGovtTotal)} informational)
                        </span>
                      </span>
                    </button>

                    {openRun === r.id && openRunData && (
                      <div className="mt-2 grid gap-2 border-t border-ink-100 pt-2">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
                          <span>
                            Institutional gross <b>{fmtMoney(r.institutionalGrossTotal)}</b>
                          </span>
                          <span>
                            PF emp <b>{fmtMoney(r.pfEmployeeTotal)}</b> · PF er{" "}
                            <b>{fmtMoney(r.pfEmployerTotal)}</b>
                          </span>
                          <span>
                            AIT <b>{fmtMoney(r.aitTdsTotal)}</b>
                          </span>
                          <span>
                            Loans <b>{fmtMoney(r.loanDeductionTotal)}</b>
                          </span>
                          <span className="text-ink-400">
                            MPO govt {fmtMoney(r.mpoGovtTotal)} — shown, never posted
                          </span>
                        </div>

                        {(r.lines ?? []).length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-left text-xs">
                              <thead>
                                <tr className="border-b border-ink-200 uppercase tracking-wide text-[10px] text-ink-500">
                                  <th className="px-1.5 py-1">Employee</th>
                                  <th className="px-1.5 py-1 text-right">MPO</th>
                                  <th className="px-1.5 py-1 text-right">Gross</th>
                                  <th className="px-1.5 py-1 text-right">PF−/er+</th>
                                  <th className="px-1.5 py-1 text-right">AIT</th>
                                  <th className="px-1.5 py-1 text-right">Loan</th>
                                  <th className="px-1.5 py-1 text-right">Net</th>
                                  {r.status === "DRAFT" && <th className="px-1.5 py-1" />}
                                </tr>
                              </thead>
                              <tbody>
                                {(r.lines ?? []).map((l) => (
                                  <tr key={l.id} className="border-b border-ink-100">
                                    <td className="px-1.5 py-1">
                                      <div className="font-semibold">{l.employeeName}</div>
                                      {l.designation && (
                                        <div className="text-[10px] text-ink-500">{l.designation}</div>
                                      )}
                                    </td>
                                    <td className="px-1.5 py-1 text-right text-ink-400">
                                      {fmtMoney(l.mpoGovtAmount)}
                                    </td>
                                    <td className="px-1.5 py-1 text-right">
                                      {fmtMoney(l.institutionalGrossAmount)}
                                    </td>
                                    <td className="px-1.5 py-1 text-right">
                                      {fmtMoney(l.pfEmployeeDeduction)}/
                                      {fmtMoney(l.pfEmployerContribution)}
                                    </td>
                                    <td className="px-1.5 py-1 text-right">
                                      {fmtMoney(l.aitTdsDeduction)}
                                    </td>
                                    <td className="px-1.5 py-1 text-right">
                                      {fmtMoney(l.loanDeduction)}
                                    </td>
                                    <td className="px-1.5 py-1 text-right font-bold">
                                      {fmtMoney(l.netInstitutionalPayable)}
                                    </td>
                                    {r.status === "DRAFT" && (
                                      <td className="px-1.5 py-1 text-right">
                                        <button
                                          type="button"
                                          onClick={() => removePayslip(r, l.id, l.employeeName)}
                                          disabled={acting === `rm-slip:${l.id}`}
                                          className="cursor-pointer rounded-xs border border-ink-200 px-1.5 py-0.5 text-ink-500 hover:bg-ink-50 disabled:opacity-50"
                                          title="Remove payslip"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {r.status === "DRAFT" && (
                          <div className="rounded-xs bg-ink-50/60 p-2">
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                              Add payslip
                            </div>
                            <div className="grid gap-1.5 sm:grid-cols-3">
                              <input
                                value={sName}
                                onChange={(e) => setSName(e.target.value)}
                                className={INPUT}
                                placeholder="Employee name *"
                              />
                              <input
                                value={sDesig}
                                onChange={(e) => setSDesig(e.target.value)}
                                className={INPUT}
                                placeholder="Designation"
                              />
                              <input
                                value={sEmpId}
                                onChange={(e) => setSEmpId(e.target.value)}
                                className={INPUT}
                                placeholder="Staff UUID (optional)"
                              />
                              <input
                                value={sMpo}
                                onChange={(e) => setSMpo(e.target.value)}
                                className={INPUT}
                                inputMode="decimal"
                                placeholder="MPO govt (info only)"
                                title="Government EFT — displayed on payslip, never posted"
                              />
                              <input
                                value={sGross}
                                onChange={(e) => setSGross(e.target.value)}
                                className={`${INPUT} font-semibold`}
                                inputMode="decimal"
                                placeholder="Institutional gross *"
                              />
                              <input
                                value={sPfEmp}
                                onChange={(e) => setSPfEmp(e.target.value)}
                                className={INPUT}
                                inputMode="decimal"
                                placeholder="PF employee"
                              />
                              <input
                                value={sPfEr}
                                onChange={(e) => setSPfEr(e.target.value)}
                                className={INPUT}
                                inputMode="decimal"
                                placeholder="PF employer"
                              />
                              <input
                                value={sAit}
                                onChange={(e) => setSAit(e.target.value)}
                                className={INPUT}
                                inputMode="decimal"
                                placeholder="AIT deduction"
                              />
                              <input
                                value={sLoan}
                                onChange={(e) => setSLoan(e.target.value)}
                                className={INPUT}
                                inputMode="decimal"
                                placeholder="Loan recovery"
                              />
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-ink-600">
                                Net payable <b>{fmtMoney(slipNet)}</b>
                                {num(sMpo) > 0 && (
                                  <span className="text-ink-400">
                                    {" "}
                                    (+ MPO {fmtMoney(num(sMpo))} on slip only)
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => addPayslip(r)}
                                disabled={acting === "add-slip"}
                                className="cursor-pointer rounded-xs bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                              >
                                {acting === "add-slip" ? "Adding…" : "Add payslip"}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {r.status === "DRAFT" && (
                            <>
                              <button
                                type="button"
                                onClick={() => approveRun(r)}
                                disabled={acting === `approve:${r.id}` || (r.lines ?? []).length === 0}
                                className="cursor-pointer rounded-xs bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                              >
                                {acting === `approve:${r.id}` ? "Posting…" : "Approve & post"}
                              </button>
                              <button
                                type="button"
                                onClick={() => voidRun(r)}
                                disabled={acting === `void:${r.id}`}
                                className="cursor-pointer rounded-xs border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                              >
                                Void draft
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <>
                              <select
                                value={payBankGl}
                                onChange={(e) => setPayBankGl(e.target.value)}
                                className={`${INPUT} w-56`}
                              >
                                <option value="">— default 11201 —</option>
                                {bankAccounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.glCode} — {a.accountName}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => payRun(r)}
                                disabled={acting === `pay:${r.id}`}
                                className="cursor-pointer rounded-xs bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                              >
                                {acting === `pay:${r.id}`
                                  ? "Disbursing…"
                                  : `Disburse ${fmtMoney(r.netPayableTotal)}`}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </DashCard>
        </div>
      )}

      {tab === "Honorarium" && (
        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <DashCard title="New honorarium bill">
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Adjunct / guest faculty *
                <input value={hName} onChange={(e) => setHName(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Work month
                <input
                  type="month"
                  value={hMonth}
                  onChange={(e) => setHMonth(e.target.value)}
                  className={INPUT}
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Classes
                  <input
                    value={hClasses}
                    onChange={(e) => setHClasses(e.target.value)}
                    className={INPUT}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Scripts
                  <input
                    value={hScripts}
                    onChange={(e) => setHScripts(e.target.value)}
                    className={INPUT}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Viva
                  <input
                    value={hViva}
                    onChange={(e) => setHViva(e.target.value)}
                    className={INPUT}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  ৳/class
                  <input
                    value={hRateC}
                    onChange={(e) => setHRateC(e.target.value)}
                    className={INPUT}
                    inputMode="decimal"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  ৳/script
                  <input
                    value={hRateS}
                    onChange={(e) => setHRateS(e.target.value)}
                    className={INPUT}
                    inputMode="decimal"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  ৳/viva
                  <input
                    value={hRateV}
                    onChange={(e) => setHRateV(e.target.value)}
                    className={INPUT}
                    inputMode="decimal"
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                TDS rate % (10–15)
                <input
                  value={hTds}
                  onChange={(e) => setHTds(e.target.value)}
                  className={INPUT}
                  inputMode="decimal"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-medium text-ink-600">
                  Fund
                  <select value={hFund} onChange={(e) => setHFund(e.target.value)} className={INPUT}>
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
                    value={hCostCenter}
                    onChange={(e) => setHCostCenter(e.target.value)}
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
              <label className="grid gap-1 text-xs font-medium text-ink-600">
                Narration
                <input value={hNarr} onChange={(e) => setHNarr(e.target.value)} className={INPUT} />
              </label>

              <div className="rounded-xs border border-ink-200 bg-ink-50/60 p-2.5 text-sm">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Workload → gross → TDS → net
                </div>
                <dl className="grid gap-0.5">
                  <div className="flex justify-between">
                    <dt className="text-ink-600">Gross</dt>
                    <dd className="font-semibold">{fmtMoney(honPreview.gross)}</dd>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <dt>− TDS {num(hTds) || 0}% → 21303</dt>
                    <dd className="font-semibold">{fmtMoney(honPreview.tds)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-ink-200 pt-0.5 text-emerald-800">
                    <dt className="font-semibold">= Net → 21103</dt>
                    <dd className="font-bold">{fmtMoney(honPreview.net)}</dd>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                onClick={createHonorarium}
                disabled={acting === "create-hon"}
                className="cursor-pointer rounded-xs bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {acting === "create-hon" ? "Saving…" : "Save draft bill"}
              </button>
            </div>
          </DashCard>

          <DashCard title={`Honorarium bills (${bills.length})`}>
            {bills.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No bills yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-[11px] uppercase tracking-wide text-ink-500">
                      <th className="px-2 py-1.5">Bill</th>
                      <th className="px-2 py-1.5">Workload</th>
                      <th className="px-2 py-1.5 text-right">Gross</th>
                      <th className="px-2 py-1.5 text-right">TDS → net</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b) => (
                      <tr key={b.id} className="border-b border-ink-100 hover:bg-ink-50/50">
                        <td className="px-2 py-1.5">
                          <div className="font-semibold">{b.billNo}</div>
                          <div className="text-[11px] text-ink-500">
                            {b.adjunctName} · {b.workMonth}
                            {b.glJournal ? ` · ${b.glJournal.voucherNo}` : ""}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-xs text-ink-600">
                          {b.classesCount} cls · {b.scriptsCount} scr · {b.vivaCount} viva
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium">
                          {fmtMoney(b.grossAmount)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs">
                          <div className="text-rose-700">
                            TDS {b.tdsRate}% {fmtMoney(b.tdsAmount)}
                          </div>
                          <div className="font-semibold text-emerald-800">
                            Net {fmtMoney(b.netPayable)}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`rounded-xs px-1.5 py-0.5 text-[11px] font-semibold ${RUN_BADGE[b.status] ?? ""}`}
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
                                  onClick={() => approveHonorarium(b)}
                                  disabled={acting === `approve-hon:${b.id}`}
                                  className="cursor-pointer rounded-xs bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => voidHonorarium(b)}
                                  disabled={acting === `void-hon:${b.id}`}
                                  className="cursor-pointer rounded-xs border border-ink-200 px-2 py-1 text-xs text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                                  title="Void draft"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            {b.status === "APPROVED" && (
                              <button
                                type="button"
                                onClick={() => payHonorarium(b)}
                                disabled={acting === `pay-hon:${b.id}`}
                                className="cursor-pointer rounded-xs bg-brand-600 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                              >
                                Pay
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
      )}

      <div className="mt-4 flex items-start gap-2 text-xs text-ink-500">
        <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Run approval posts Dr 51101 (institutional gross) + Dr 51104 (employer PF) / Cr 22101 (PF
          liability) + Cr 21301 (AIT) + Cr 11403 (loans) + Cr 21102 (net payable). MPO government
          EFT appears on payslips only — it never touches the ledger. Honorarium posts Dr 51103 /
          Cr 21103 + Cr 21303 (10–15% TDS).
        </p>
      </div>
    </div>
  );
}
