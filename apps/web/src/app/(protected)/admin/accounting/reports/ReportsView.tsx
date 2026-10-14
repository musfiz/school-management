"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Printer,
  Scale,
  BookOpen,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import { printElement, downloadReportPdf } from "@/lib/print";
import DatePickerField from "@/components/ui/DatePicker";
import SearchSelect from "@/components/ui/SearchSelect";
import type { ChartOfAccount, CostCenter, Fund } from "@/lib/accounting";
import {
  downloadCsv,
  type BalanceSheetReport,
  type DefaulterAgingReport,
  type GeneralLedgerReport,
  type IncomeExpenditureReport,
  type ReceiptsPaymentsReport,
  type TrialBalanceReport,
} from "@/lib/reports";

const TABS = [
  { id: "trial-balance", label: "Trial Balance", icon: Scale },
  { id: "dia-receipts", label: "DIA Receipts & Payments", icon: DollarSign },
  { id: "income-expenditure", label: "Income & Expenditure", icon: TrendingUp },
  { id: "balance-sheet", label: "Balance Sheet", icon: BookOpen },
  { id: "defaulter-aging", label: "Student Aging", icon: Clock },
  { id: "general-ledger", label: "General Ledger", icon: FileSpreadsheet },
] as const;

type TabId = (typeof TABS)[number]["id"];

const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => `${new Date().getFullYear()}-01-01`;

const fmtMoney = (val: string | number | undefined) => {
  if (val == null || val === "") return "0.00";
  const num = typeof val === "number" ? val : parseFloat(val);
  return isNaN(num) ? "0.00" : num.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ReportsView() {
  const [activeTab, setActiveTab] = useState<TabId>("trial-balance");
  const [loading, setLoading] = useState(false);

  // Filter masters
  const [funds, setFunds] = useState<Fund[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);

  // Filter state
  const [startDate, setStartDate] = useState(startOfYear());
  const [endDate, setEndDate] = useState(today());
  const [selectedFund, setSelectedFund] = useState<string>("");
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>("");
  const [selectedGlId, setSelectedGlId] = useState<string>("");

  // Report data states
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [receiptsPayments, setReceiptsPayments] = useState<ReceiptsPaymentsReport | null>(null);
  const [incomeExp, setIncomeExp] = useState<IncomeExpenditureReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [defaulterAging, setDefaulterAging] = useState<DefaulterAgingReport | null>(null);
  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerReport | null>(null);

  // Load dropdown masters
  useEffect(() => {
    (async () => {
      try {
        const [f, c, a] = await Promise.all([
          apiFetch<Fund[]>("/api/accounting/funds"),
          apiFetch<CostCenter[]>("/api/accounting/cost-centers"),
          apiFetch<ChartOfAccount[]>("/api/accounting/chart-of-accounts?activeOnly=true"),
        ]);
        setFunds(f || []);
        setCostCenters(c || []);
        setAccounts(a || []);
        if (a && a.length > 0 && !selectedGlId) {
          setSelectedGlId(a[0].id);
        }
      } catch (e) {
        toast("Failed to load filter options", "error");
      }
    })();
  }, []);

  // Quick date presets
  const applyPreset = (preset: "this-month" | "this-fy" | "last-fy" | "ytd") => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === "this-month") {
      const s = new Date(y, m, 1).toISOString().slice(0, 10);
      const e = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      setStartDate(s);
      setEndDate(e);
    } else if (preset === "this-fy") {
      // BD Fiscal Year runs July 1 to June 30
      const fyStartYear = m >= 6 ? y : y - 1;
      setStartDate(`${fyStartYear}-07-01`);
      setEndDate(`${fyStartYear + 1}-06-30`);
    } else if (preset === "last-fy") {
      const fyStartYear = m >= 6 ? y - 1 : y - 2;
      setStartDate(`${fyStartYear}-07-01`);
      setEndDate(`${fyStartYear + 1}-06-30`);
    } else if (preset === "ytd") {
      setStartDate(`${y}-01-01`);
      setEndDate(today());
    }
  };

  // Fetch report data based on active tab
  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (selectedFund) params.set("fundId", selectedFund);
    if (selectedCostCenter) params.set("costCenterId", selectedCostCenter);

    try {
      if (activeTab === "trial-balance") {
        const data = await apiFetch<TrialBalanceReport>(`/api/accounting/reports/trial-balance?${params.toString()}`);
        setTrialBalance(data);
      } else if (activeTab === "dia-receipts") {
        const data = await apiFetch<ReceiptsPaymentsReport>(`/api/accounting/reports/receipts-payments?${params.toString()}`);
        setReceiptsPayments(data);
      } else if (activeTab === "income-expenditure") {
        const data = await apiFetch<IncomeExpenditureReport>(`/api/accounting/reports/income-expenditure?${params.toString()}`);
        setIncomeExp(data);
      } else if (activeTab === "balance-sheet") {
        const bsParams = new URLSearchParams();
        if (endDate) bsParams.set("asOfDate", endDate);
        if (selectedFund) bsParams.set("fundId", selectedFund);
        const data = await apiFetch<BalanceSheetReport>(`/api/accounting/reports/balance-sheet?${bsParams.toString()}`);
        setBalanceSheet(data);
      } else if (activeTab === "defaulter-aging") {
        const agParams = new URLSearchParams();
        if (endDate) agParams.set("asOfDate", endDate);
        if (selectedCostCenter) agParams.set("costCenterId", selectedCostCenter);
        const data = await apiFetch<DefaulterAgingReport>(`/api/accounting/reports/defaulter-aging?${agParams.toString()}`);
        setDefaulterAging(data);
      } else if (activeTab === "general-ledger") {
        if (!selectedGlId) return;
        params.set("glAccountId", selectedGlId);
        const data = await apiFetch<GeneralLedgerReport>(`/api/accounting/reports/general-ledger?${params.toString()}`);
        setGeneralLedger(data);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to generate report", "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, selectedFund, selectedCostCenter, selectedGlId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // CSV Export handler
  const handleExportCsv = () => {
    const ts = new Date().toISOString().slice(0, 10);
    if (activeTab === "trial-balance" && trialBalance) {
      const rows = trialBalance.rows.map((r) => ({
        "GL Code": r.glCode,
        "Account Name": r.accountName,
        Type: r.accountType,
        "Opening Debit": r.openingDebit,
        "Opening Credit": r.openingCredit,
        "Period Debit": r.periodDebit,
        "Period Credit": r.periodCredit,
        "Closing Debit": r.closingDebit,
        "Closing Credit": r.closingCredit,
      }));
      downloadCsv(`Trial_Balance_${startDate}_to_${endDate}_${ts}`, rows);
    } else if (activeTab === "dia-receipts" && receiptsPayments) {
      const rows = [
        ...receiptsPayments.openingBalances.map((o) => ({
          Category: "Opening Balance",
          Code: o.glCode,
          Head: o.accountName,
          Amount: o.balance,
        })),
        ...receiptsPayments.receipts.map((r) => ({
          Category: "Receipts",
          Code: r.glCode,
          Head: r.name,
          Amount: r.amount,
        })),
        ...receiptsPayments.payments.map((p) => ({
          Category: "Payments",
          Code: p.glCode,
          Head: p.name,
          Amount: p.amount,
        })),
        ...receiptsPayments.closingBalances.map((c) => ({
          Category: "Closing Balance",
          Code: c.glCode,
          Head: c.accountName,
          Amount: c.balance,
        })),
      ];
      downloadCsv(`DIA_Receipts_Payments_${startDate}_to_${endDate}_${ts}`, rows);
    } else if (activeTab === "income-expenditure" && incomeExp) {
      const rows = [
        ...incomeExp.revenues.map((r) => ({ Section: "Revenue", Code: r.glCode, Head: r.accountName, Amount: r.amount })),
        ...incomeExp.contraRevenues.map((c) => ({ Section: "Contra-Revenue", Code: c.glCode, Head: c.accountName, Amount: `-${c.amount}` })),
        ...incomeExp.expenses.map((e) => ({ Section: "Expenditure", Code: e.glCode, Head: e.accountName, Amount: e.amount })),
      ];
      downloadCsv(`Income_Expenditure_${startDate}_to_${endDate}_${ts}`, rows);
    } else if (activeTab === "defaulter-aging" && defaulterAging) {
      const rows = defaulterAging.items.map((i) => ({
        "Student ID": i.studentId,
        "Student Name": i.studentName,
        "Invoice No": i.invoiceNo,
        Period: i.billingPeriod,
        "Due Date": i.dueDate,
        "Days Overdue": i.daysOverdue,
        Bucket: i.agingBucket,
        "Net Amount": i.netAmount,
        "Paid Amount": i.paidAmount,
        "Due Balance": i.dueBalance,
      }));
      downloadCsv(`Student_Defaulter_Aging_${endDate}_${ts}`, rows);
    } else if (activeTab === "general-ledger" && generalLedger) {
      const rows = generalLedger.lines.map((l) => ({
        Date: l.transactionDate,
        "Voucher No": l.voucherNo,
        Type: l.voucherType,
        Narration: l.narration,
        Debit: l.debitAmount,
        Credit: l.creditAmount,
        "Running Balance": l.runningBalance,
      }));
      downloadCsv(`General_Ledger_${generalLedger.account.glCode}_${ts}`, rows);
    }
  };

  // Server-side A4 PDF via the global documents endpoint (pdf-lib — same
  // bytes on Windows / Linux / macOS). Builds a tabular payload from the
  // currently loaded tab.
  const handleDownloadPdf = async () => {
    const ts = new Date().toISOString().slice(0, 10);
    const period = `Period: ${startDate} to ${endDate}`;
    try {
      if (activeTab === "trial-balance" && trialBalance) {
        await downloadReportPdf(
          {
            title: "Trial Balance",
            subtitle: period,
            columns: [
              { header: "GL Code", width: 1.4 },
              { header: "Account Head", width: 3.4 },
              { header: "Op. Dr", width: 1.5, align: "right" },
              { header: "Op. Cr", width: 1.5, align: "right" },
              { header: "Period Dr", width: 1.5, align: "right" },
              { header: "Period Cr", width: 1.5, align: "right" },
              { header: "Closing Dr", width: 1.5, align: "right" },
              { header: "Closing Cr", width: 1.5, align: "right" },
            ],
            rows: trialBalance.rows.map((r) => [
              r.glCode, r.accountName,
              fmtMoney(r.openingDebit), fmtMoney(r.openingCredit),
              fmtMoney(r.periodDebit), fmtMoney(r.periodCredit),
              fmtMoney(r.closingDebit), fmtMoney(r.closingCredit),
            ]),
            totals: [
              { label: "Closing Dr (BDT)", value: fmtMoney(trialBalance.totals.closingDebit) },
              { label: "Closing Cr (BDT)", value: fmtMoney(trialBalance.totals.closingCredit) },
              { label: "Status", value: trialBalance.totals.isBalanced ? "BALANCED" : `UNBALANCED (Diff ${trialBalance.totals.difference})` },
            ],
          },
          `Trial_Balance_${startDate}_to_${endDate}_${ts}.pdf`,
        );
      } else if (activeTab === "income-expenditure" && incomeExp) {
        await downloadReportPdf(
          {
            title: "Statement of Income & Expenditure",
            subtitle: period,
            columns: [
              { header: "Section", width: 2 },
              { header: "Head", width: 4 },
              { header: "Amount (BDT)", width: 2, align: "right" },
            ],
            rows: [
              ...incomeExp.revenues.map((r) => ["Revenue", `${r.glCode} — ${r.accountName}`, fmtMoney(r.amount)]),
              ...incomeExp.contraRevenues.map((c) => ["Less: Waiver", `${c.glCode} — ${c.accountName}`, `(${fmtMoney(c.amount)})`]),
              ...incomeExp.expenses.map((e) => ["Expenditure", `${e.glCode} — ${e.accountName}`, fmtMoney(e.amount)]),
            ],
            totals: [{ label: incomeExp.isSurplus ? "Net Surplus (BDT)" : "Net Deficit (BDT)", value: fmtMoney(incomeExp.netSurplusDeficit) }],
          },
          `Income_Expenditure_${startDate}_to_${endDate}_${ts}.pdf`,
        );
      } else if (activeTab === "defaulter-aging" && defaulterAging) {
        await downloadReportPdf(
          {
            title: "Student Defaulter & Aging",
            subtitle: `As of ${endDate}`,
            columns: [
              { header: "Student", width: 2.6 },
              { header: "Invoice", width: 1.8 },
              { header: "Due Date", width: 1.4 },
              { header: "Bucket", width: 1.2 },
              { header: "Due (BDT)", width: 1.4, align: "right" },
            ],
            rows: defaulterAging.items.map((i) => [
              i.studentName, i.invoiceNo, i.dueDate, i.agingBucket, fmtMoney(i.dueBalance),
            ]),
            totals: [{ label: "Total Outstanding (BDT)", value: fmtMoney(defaulterAging.summary.totalOutstanding) }],
          },
          `Student_Defaulter_Aging_${endDate}_${ts}.pdf`,
        );
      } else if (activeTab === "general-ledger" && generalLedger) {
        await downloadReportPdf(
          {
            title: `General Ledger — ${generalLedger.account.glCode} ${generalLedger.account.accountName}`,
            subtitle: period,
            columns: [
              { header: "Date", width: 1.4 },
              { header: "Voucher", width: 1.8 },
              { header: "Narration", width: 3.6 },
              { header: "Debit", width: 1.4, align: "right" },
              { header: "Credit", width: 1.4, align: "right" },
              { header: "Balance", width: 1.4, align: "right" },
            ],
            rows: generalLedger.lines.map((l) => [
              l.transactionDate, l.voucherNo, l.narration,
              fmtMoney(l.debitAmount), fmtMoney(l.creditAmount), fmtMoney(l.runningBalance),
            ]),
            totals: [
              { label: "Opening", value: fmtMoney(generalLedger.openingBalance) },
              { label: "Closing", value: fmtMoney(generalLedger.closingBalance) },
            ],
          },
          `General_Ledger_${generalLedger.account.glCode}_${ts}.pdf`,
        );
      } else if (activeTab === "balance-sheet" && balanceSheet) {
        await downloadReportPdf(
          {
            title: "Statement of Financial Position",
            subtitle: `As of ${endDate}`,
            columns: [
              { header: "Section", width: 2 },
              { header: "Head", width: 4 },
              { header: "Amount (BDT)", width: 2, align: "right" },
            ],
            rows: [
              ...balanceSheet.assets.current.map((a) => ["Asset (Current)", `${a.glCode} — ${a.accountName}`, fmtMoney(a.amount)]),
              ...balanceSheet.assets.fixed.map((a) => ["Asset (Fixed)", `${a.glCode} — ${a.accountName}`, fmtMoney(a.amount)]),
              ...balanceSheet.liabilities.current.map((l) => ["Liability", `${l.glCode} — ${l.accountName}`, fmtMoney(l.amount)]),
              ...balanceSheet.fundBalance.accounts.map((e) => ["Fund Balance", `${e.glCode} — ${e.accountName}`, fmtMoney(e.amount)]),
            ],
            totals: [
              { label: "Total Assets (BDT)", value: fmtMoney(balanceSheet.assets.total) },
              { label: "Total Liab. + Funds (BDT)", value: fmtMoney(balanceSheet.totalLiabilitiesAndEquity) },
              { label: "Status", value: balanceSheet.isBalanced ? "BALANCED" : `OUT OF BALANCE (${balanceSheet.discrepancy})` },
            ],
          },
          `Balance_Sheet_${endDate}_${ts}.pdf`,
        );
      } else if (activeTab === "dia-receipts" && receiptsPayments) {
        await downloadReportPdf(
          {
            title: "DIA Receipts & Payments Account",
            subtitle: period,
            columns: [
              { header: "Category", width: 2 },
              { header: "Head", width: 4 },
              { header: "Amount (BDT)", width: 2, align: "right" },
            ],
            rows: [
              ...receiptsPayments.openingBalances.map((o) => ["Opening", `${o.glCode} — ${o.accountName}`, fmtMoney(o.balance)]),
              ...receiptsPayments.receipts.map((r) => ["Receipt", `${r.glCode} — ${r.name}`, fmtMoney(r.amount)]),
              ...receiptsPayments.payments.map((p) => ["Payment", `${p.glCode} — ${p.name}`, fmtMoney(p.amount)]),
              ...receiptsPayments.closingBalances.map((c) => ["Closing", `${c.glCode} — ${c.accountName}`, fmtMoney(c.balance)]),
            ],
            totals: [
              { label: "Total Receipts (BDT)", value: fmtMoney(receiptsPayments.totalReceipts) },
              { label: "Total Payments (BDT)", value: fmtMoney(receiptsPayments.totalPayments) },
              { label: "Status", value: receiptsPayments.isReconciled ? "RECONCILED" : `DISCREPANCY (${receiptsPayments.reconciliationDiscrepancy})` },
            ],
          },
          `DIA_Receipts_Payments_${startDate}_to_${endDate}_${ts}.pdf`,
        );
      } else {
        toast("Run the report first — no data loaded for PDF export", "warning");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "PDF export failed", "error");
    }
  };

  const glOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.glCode} — ${a.accountName} (${a.accountType})`,
      })),
    [accounts],
  );

  const fundOptions = useMemo(
    () =>
      funds.map((f) => ({
        value: f.id,
        label: `${f.fundCode} — ${f.fundName}${f.isRestricted ? " (Restricted)" : ""}`,
      })),
    [funds],
  );

  const centerOptions = useMemo(
    () =>
      costCenters.map((c) => ({
        value: c.id,
        label: `${c.centerCode} — ${c.centerName}`,
      })),
    [costCenters],
  );

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Statutory & Financial Reports"
        description="Phase 7 & 8.5 — DIA Directorate of Inspection & Audit, UGC, and NBR statutory financial statements with cash/accrual dual-basis extractors."
      />

      {/* Tabs navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-100 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-xs border border-transparent px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <DashCard title="Filter & Period Selection">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6 items-end">
          {activeTab !== "balance-sheet" && (
            <DatePickerField
              label="From Date"
              value={startDate}
              onChange={setStartDate}
              placeholder="From date"
              maxDate={endDate || undefined}
            />
          )}

          <DatePickerField
            label={activeTab === "balance-sheet" ? "As of Date" : "To Date"}
            value={endDate}
            onChange={setEndDate}
            placeholder={activeTab === "balance-sheet" ? "As of date" : "To date"}
            minDate={activeTab === "balance-sheet" ? undefined : startDate || undefined}
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Fund</label>
            <SearchSelect
              options={fundOptions}
              value={selectedFund}
              onChange={(val) => setSelectedFund(val || "")}
              placeholder="All Funds (Consolidated)"
              ariaLabel="Fund"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Cost Center / Dept</label>
            <SearchSelect
              options={centerOptions}
              value={selectedCostCenter}
              onChange={(val) => setSelectedCostCenter(val || "")}
              placeholder="All Cost Centers"
              ariaLabel="Cost Center"
            />
          </div>

          {activeTab === "general-ledger" && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-ink-700">GL Account</label>
              <SearchSelect
                options={glOptions}
                value={selectedGlId}
                onChange={(val) => setSelectedGlId(val || "")}
                placeholder="Select GL Account..."
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 md:col-span-2">
            <button
              type="button"
              onClick={() => fetchReport()}
              className="cursor-pointer rounded-xs border border-brand-500 bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
            >
              Run Report
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex cursor-pointer items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              <Download className="h-3 w-3" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  printElement("printable-report-area", TABS.find((t) => t.id === activeTab)?.label ?? "Report");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Print failed", "error");
                }
              }}
              className="flex cursor-pointer items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              <Printer className="h-3 w-3" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              className="flex cursor-pointer items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              <FileSpreadsheet className="h-3 w-3" />
              <span>PDF (A4)</span>
            </button>
          </div>
        </div>

        {/* Quick Date Range Presets */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-2 text-xs text-ink-500">
          <span className="font-medium text-ink-700">Quick Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset("this-month")}
            className="cursor-pointer rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => applyPreset("this-fy")}
            className="cursor-pointer rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            This Fiscal Year (July-June)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("last-fy")}
            className="cursor-pointer rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            Last Fiscal Year
          </button>
          <button
            type="button"
            onClick={() => applyPreset("ytd")}
            className="cursor-pointer rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            Year to Date
          </button>
        </div>
      </DashCard>

      {/* Main Report Display Container */}
      <div id="printable-report-area">
        {loading ? (
          <AdminPageLoader variant="inline" />
        ) : (
          <>
            {/* Header for printouts */}
            <div className="hidden print:block mb-4 text-center border-b pb-3">
              <h1 className="text-xl font-bold uppercase tracking-wide">Bangladesh Educational ERP Accounting</h1>
              <h2 className="text-sm font-semibold uppercase text-ink-600">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-ink-500">
                Period: {startDate} to {endDate}
              </p>
            </div>

            {/* TAB 1: TRIAL BALANCE */}
            {activeTab === "trial-balance" && trialBalance && (
              <DashCard
                title="Trial Balance (General Ledger Balances)"
                action={
                  <div className="flex items-center gap-2">
                    {trialBalance.totals.isBalanced ? (
                      <span className="flex items-center gap-1 rounded-xs bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        BALANCED (Diff: 0.00 BDT)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-xs bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                        <AlertCircle className="h-3.5 w-3.5" />
                        UNBALANCED (Diff: {trialBalance.totals.difference} BDT)
                      </span>
                    )}
                  </div>
                }
              >
                <div className="overflow-x-auto rounded-xs border border-ink-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 text-ink-700">
                      <tr>
                        <th className="px-2.5 py-1.5 font-semibold">GL Code</th>
                        <th className="px-2.5 py-1.5 font-semibold">Account Head</th>
                        <th className="px-2.5 py-1.5 font-semibold">Type</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Opening Dr</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Opening Cr</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Period Dr</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Period Cr</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Closing Dr</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Closing Cr</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 bg-white">
                      {trialBalance.rows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-ink-400">
                            No ledger activity found for selected filters.
                          </td>
                        </tr>
                      ) : (
                        trialBalance.rows.map((r) => (
                          <tr key={r.glAccountId} className="hover:bg-ink-50">
                            <td className="px-2.5 py-1 font-mono font-medium text-ink-900">{r.glCode}</td>
                            <td className="px-2.5 py-1 text-ink-800">{r.accountName}</td>
                            <td className="px-2.5 py-1">
                              <span className="rounded-xs bg-ink-100 px-1.5 py-0.2 text-[10px] font-medium text-ink-700">
                                {r.accountType}
                              </span>
                            </td>
                            <td className="px-2.5 py-1 text-right font-mono text-ink-700">{fmtMoney(r.openingDebit)}</td>
                            <td className="px-2.5 py-1 text-right font-mono text-ink-700">{fmtMoney(r.openingCredit)}</td>
                            <td className="px-2.5 py-1 text-right font-mono text-brand-700">{fmtMoney(r.periodDebit)}</td>
                            <td className="px-2.5 py-1 text-right font-mono text-brand-700">{fmtMoney(r.periodCredit)}</td>
                            <td className="px-2.5 py-1 text-right font-mono font-semibold text-ink-900">{fmtMoney(r.closingDebit)}</td>
                            <td className="px-2.5 py-1 text-right font-mono font-semibold text-ink-900">{fmtMoney(r.closingCredit)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="border-t-2 border-ink-300 bg-ink-100 font-semibold text-ink-900">
                      <tr>
                        <td colSpan={3} className="px-2.5 py-1.5 text-right uppercase">
                          Grand Totals (BDT):
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(trialBalance.totals.openingDebit)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(trialBalance.totals.openingCredit)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(trialBalance.totals.periodDebit)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(trialBalance.totals.periodCredit)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-emerald-800">{fmtMoney(trialBalance.totals.closingDebit)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-emerald-800">{fmtMoney(trialBalance.totals.closingCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </DashCard>
            )}

            {/* TAB 2: DIA RECEIPTS & PAYMENTS */}
            {activeTab === "dia-receipts" && receiptsPayments && (
              <DashCard
                title="Directorate of Inspection & Audit (DIA) Receipts & Payments Account"
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-500 font-medium">Dual-Basis Cash Extractor</span>
                    {receiptsPayments.isReconciled ? (
                      <span className="rounded-xs bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        RECONCILED (0.00 BDT)
                      </span>
                    ) : (
                      <span className="rounded-xs bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                        DISCREPANCY: {receiptsPayments.reconciliationDiscrepancy} BDT
                      </span>
                    )}
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Opening Balance & Receipts */}
                  <div className="rounded-xs border border-ink-200 bg-white p-3 space-y-3">
                    <h3 className="border-b border-ink-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Receipts & Inflows
                    </h3>

                    {/* Opening Balances */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Opening Cash & Bank Balances:</div>
                      {receiptsPayments.openingBalances.map((o) => (
                        <div key={o.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                          <span>{o.glCode} — {o.accountName}</span>
                          <span className="font-mono">{fmtMoney(o.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-semibold pt-1 text-ink-900 border-t border-ink-200">
                        <span>Total Opening Balance</span>
                        <span className="font-mono">{fmtMoney(receiptsPayments.totalOpening)}</span>
                      </div>
                    </div>

                    {/* Receipts during period */}
                    <div className="space-y-1 pt-2">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Itemized Revenue Receipts:</div>
                      {receiptsPayments.receipts.length === 0 ? (
                        <div className="text-xs text-ink-400 py-2 text-center">No cash receipts recorded in period.</div>
                      ) : (
                        receiptsPayments.receipts.map((r, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                            <span>{r.glCode} — {r.name}</span>
                            <span className="font-mono text-emerald-700">{fmtMoney(r.amount)}</span>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 text-ink-900 border-t border-ink-200">
                        <span>Total Revenue Receipts</span>
                        <span className="font-mono text-emerald-800">{fmtMoney(receiptsPayments.totalReceipts)}</span>
                      </div>
                    </div>

                    {/* Left Grand Total */}
                    <div className="flex justify-between text-xs font-bold border-t-2 border-emerald-600 pt-2 text-emerald-900 bg-emerald-50 px-2 py-1 rounded-xs">
                      <span>Total Available Funds</span>
                      <span className="font-mono">
                        {fmtMoney(
                          (parseFloat(receiptsPayments.totalOpening) + parseFloat(receiptsPayments.totalReceipts)).toFixed(2)
                        )} BDT
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Payments & Closing Balance */}
                  <div className="rounded-xs border border-ink-200 bg-white p-3 space-y-3">
                    <h3 className="border-b border-ink-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-rose-800">
                      Payments & Outflows
                    </h3>

                    {/* Itemized Payments */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Itemized Expenditures Paid:</div>
                      {receiptsPayments.payments.length === 0 ? (
                        <div className="text-xs text-ink-400 py-2 text-center">No cash payments recorded in period.</div>
                      ) : (
                        receiptsPayments.payments.map((p, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                            <span>{p.glCode} — {p.name}</span>
                            <span className="font-mono text-rose-700">{fmtMoney(p.amount)}</span>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 text-ink-900 border-t border-ink-200">
                        <span>Total Expenditures Paid</span>
                        <span className="font-mono text-rose-800">{fmtMoney(receiptsPayments.totalPayments)}</span>
                      </div>
                    </div>

                    {/* Closing Balances */}
                    <div className="space-y-1 pt-2">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Closing Cash & Bank Balances:</div>
                      {receiptsPayments.closingBalances.map((c) => (
                        <div key={c.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                          <span>{c.glCode} — {c.accountName}</span>
                          <span className="font-mono">{fmtMoney(c.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-semibold pt-1 text-ink-900 border-t border-ink-200">
                        <span>Total Closing Balance</span>
                        <span className="font-mono">{fmtMoney(receiptsPayments.totalClosing)}</span>
                      </div>
                    </div>

                    {/* Right Grand Total */}
                    <div className="flex justify-between text-xs font-bold border-t-2 border-rose-600 pt-2 text-rose-900 bg-rose-50 px-2 py-1 rounded-xs">
                      <span>Total Accounted Payments & Closing</span>
                      <span className="font-mono">
                        {fmtMoney(
                          (parseFloat(receiptsPayments.totalPayments) + parseFloat(receiptsPayments.totalClosing)).toFixed(2)
                        )} BDT
                      </span>
                    </div>
                  </div>
                </div>
              </DashCard>
            )}

            {/* TAB 3: STATEMENT OF INCOME & EXPENDITURE */}
            {activeTab === "income-expenditure" && incomeExp && (
              <DashCard
                title="Statement of Income & Expenditure (Accrual P&L)"
                action={
                  <span
                    className={`rounded-xs px-2.5 py-0.5 text-xs font-bold ${
                      incomeExp.isSurplus ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {incomeExp.isSurplus ? "NET SURPLUS" : "NET DEFICIT"}: {fmtMoney(incomeExp.netSurplusDeficit)} BDT
                  </span>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Incomes & Contra-Revenue */}
                  <div className="rounded-xs border border-ink-200 bg-white p-3 space-y-3">
                    <h3 className="border-b border-ink-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Revenues & Incomes
                    </h3>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Gross Operating Revenues:</div>
                      {incomeExp.revenues.length === 0 ? (
                        <div className="text-xs text-ink-400 py-2 text-center">No operating revenues recorded.</div>
                      ) : (
                        incomeExp.revenues.map((r) => (
                          <div key={r.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                            <span>{r.glCode} — {r.accountName}</span>
                            <span className="font-mono text-emerald-700">{fmtMoney(r.amount)}</span>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 text-ink-900 border-t border-ink-200">
                        <span>Total Gross Revenue</span>
                        <span className="font-mono">{fmtMoney(incomeExp.grossRevenue)}</span>
                      </div>
                    </div>

                    {/* Contra-revenues / waivers */}
                    <div className="space-y-1 pt-2">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Less: Waivers & Boarding Subsidies:</div>
                      {incomeExp.contraRevenues.length === 0 ? (
                        <div className="text-xs text-ink-400 py-1 text-center">No student waivers granted in period.</div>
                      ) : (
                        incomeExp.contraRevenues.map((c) => (
                          <div key={c.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                            <span>{c.glCode} — {c.accountName}</span>
                            <span className="font-mono text-rose-600">({fmtMoney(c.amount)})</span>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 text-ink-900 border-t border-ink-200">
                        <span>Total Contra-Revenues</span>
                        <span className="font-mono text-rose-700">({fmtMoney(incomeExp.totalContraRevenue)})</span>
                      </div>
                    </div>

                    {/* Net Revenue */}
                    <div className="flex justify-between text-xs font-bold border-t-2 border-emerald-600 pt-2 text-emerald-900 bg-emerald-50 px-2 py-1 rounded-xs">
                      <span>Net Operating Revenue</span>
                      <span className="font-mono">{fmtMoney(incomeExp.netOperatingRevenue)} BDT</span>
                    </div>
                  </div>

                  {/* Expenditures */}
                  <div className="rounded-xs border border-ink-200 bg-white p-3 space-y-3">
                    <h3 className="border-b border-ink-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-rose-800">
                      Operating Expenditures
                    </h3>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Itemized Expenses:</div>
                      {incomeExp.expenses.length === 0 ? (
                        <div className="text-xs text-ink-400 py-2 text-center">No expenditures recorded in period.</div>
                      ) : (
                        incomeExp.expenses.map((e) => (
                          <div key={e.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                            <span>{e.glCode} — {e.accountName}</span>
                            <span className="font-mono text-rose-700">{fmtMoney(e.amount)}</span>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 text-ink-900 border-t border-ink-200">
                        <span>Total Operating Expenditure</span>
                        <span className="font-mono text-rose-800">{fmtMoney(incomeExp.totalExpense)}</span>
                      </div>
                    </div>

                    {/* Net Surplus / Deficit summary block */}
                    <div
                      className={`flex justify-between text-xs font-bold border-t-2 pt-2 px-2 py-1.5 rounded-xs ${
                        incomeExp.isSurplus
                          ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                          : "border-rose-600 bg-rose-100 text-rose-900"
                      }`}
                    >
                      <span>{incomeExp.isSurplus ? "Net Operating Surplus" : "Net Operating Deficit"}</span>
                      <span className="font-mono">{fmtMoney(incomeExp.netSurplusDeficit)} BDT</span>
                    </div>
                  </div>
                </div>
              </DashCard>
            )}

            {/* TAB 4: BALANCE SHEET */}
            {activeTab === "balance-sheet" && balanceSheet && (
              <DashCard
                title="Statement of Financial Position (Balance Sheet)"
                action={
                  <div className="flex items-center gap-2">
                    {balanceSheet.isBalanced ? (
                      <span className="rounded-xs bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        BALANCED (Assets == Liab + Equity)
                      </span>
                    ) : (
                      <span className="rounded-xs bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                        OUT OF BALANCE (Diff: {balanceSheet.discrepancy} BDT)
                      </span>
                    )}
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: ASSETS */}
                  <div className="rounded-xs border border-ink-200 bg-white p-3 space-y-3">
                    <h3 className="border-b border-ink-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-ink-800">
                      ASSETS
                    </h3>

                    {/* Current Assets */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Current Assets:</div>
                      {balanceSheet.assets.current.map((a) => (
                        <div key={a.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                          <span>{a.glCode} — {a.accountName}</span>
                          <span className="font-mono">{fmtMoney(a.amount)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Fixed Assets */}
                    <div className="space-y-1 pt-2">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Non-Current & Fixed Assets:</div>
                      {balanceSheet.assets.fixed.map((f) => (
                        <div key={f.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                          <span>{f.glCode} — {f.accountName}</span>
                          <span className="font-mono">{fmtMoney(f.amount)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total Assets */}
                    <div className="flex justify-between text-xs font-bold border-t-2 border-brand-500 pt-2 text-brand-900 bg-brand-50 px-2 py-1 rounded-xs">
                      <span>TOTAL ASSETS</span>
                      <span className="font-mono">{fmtMoney(balanceSheet.assets.total)} BDT</span>
                    </div>
                  </div>

                  {/* Right: LIABILITIES & FUND BALANCES */}
                  <div className="rounded-xs border border-ink-200 bg-white p-3 space-y-3">
                    <h3 className="border-b border-ink-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-ink-800">
                      LIABILITIES & FUND BALANCES
                    </h3>

                    {/* Current Liabilities */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Current Liabilities:</div>
                      {balanceSheet.liabilities.current.map((l) => (
                        <div key={l.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                          <span>{l.glCode} — {l.accountName}</span>
                          <span className="font-mono">{fmtMoney(l.amount)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Long-Term Liabilities */}
                    {balanceSheet.liabilities.longTerm.length > 0 && (
                      <div className="space-y-1 pt-2">
                        <div className="text-[11px] font-semibold text-ink-600 uppercase">Long-Term Liabilities:</div>
                        {balanceSheet.liabilities.longTerm.map((lt) => (
                          <div key={lt.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                            <span>{lt.glCode} — {lt.accountName}</span>
                            <span className="font-mono">{fmtMoney(lt.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between text-xs font-semibold pt-1 text-ink-900 border-t border-ink-200">
                      <span>Total Liabilities</span>
                      <span className="font-mono">{fmtMoney(balanceSheet.liabilities.total)}</span>
                    </div>

                    {/* Fund Balances / Net Assets */}
                    <div className="space-y-1 pt-2">
                      <div className="text-[11px] font-semibold text-ink-600 uppercase">Fund Balances & Accumulated Surplus:</div>
                      {balanceSheet.fundBalance.accounts.map((e) => (
                        <div key={e.glAccountId} className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50">
                          <span>{e.glCode} — {e.accountName}</span>
                          <span className="font-mono">{fmtMoney(e.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs py-0.5 pl-2 text-ink-700 border-b border-ink-50 font-medium">
                        <span>Current Period Net Surplus / (Deficit)</span>
                        <span className="font-mono">{fmtMoney(balanceSheet.fundBalance.currentPeriodSurplusDeficit)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold pt-1 text-ink-900 border-t border-ink-200">
                        <span>Total Fund Balances</span>
                        <span className="font-mono">{fmtMoney(balanceSheet.fundBalance.totalFundBalance)}</span>
                      </div>
                    </div>

                    {/* Total Liabilities & Equity */}
                    <div className="flex justify-between text-xs font-bold border-t-2 border-brand-500 pt-2 text-brand-900 bg-brand-50 px-2 py-1 rounded-xs">
                      <span>TOTAL LIABILITIES & FUND BALANCES</span>
                      <span className="font-mono">{fmtMoney(balanceSheet.totalLiabilitiesAndEquity)} BDT</span>
                    </div>
                  </div>
                </div>
              </DashCard>
            )}

            {/* TAB 5: STUDENT DEFAULTERS & AGING */}
            {activeTab === "defaulter-aging" && defaulterAging && (
              <div className="space-y-4">
                {/* 4 Aging Tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xs border border-ink-200 bg-white p-3">
                    <div className="text-[11px] font-medium uppercase text-ink-500">0–30 Days Overdue</div>
                    <div className="mt-1 text-base font-bold font-mono text-amber-700">
                      {fmtMoney(defaulterAging.summary.buckets["0–30 days"])} BDT
                    </div>
                  </div>
                  <div className="rounded-xs border border-ink-200 bg-white p-3">
                    <div className="text-[11px] font-medium uppercase text-ink-500">31–60 Days Overdue</div>
                    <div className="mt-1 text-base font-bold font-mono text-orange-700">
                      {fmtMoney(defaulterAging.summary.buckets["31–60 days"])} BDT
                    </div>
                  </div>
                  <div className="rounded-xs border border-ink-200 bg-white p-3">
                    <div className="text-[11px] font-medium uppercase text-ink-500">61–90 Days Overdue</div>
                    <div className="mt-1 text-base font-bold font-mono text-rose-700">
                      {fmtMoney(defaulterAging.summary.buckets["61–90 days"])} BDT
                    </div>
                  </div>
                  <div className="rounded-xs border border-ink-200 bg-white p-3">
                    <div className="text-[11px] font-medium uppercase text-ink-500">90+ Days (Defaulters)</div>
                    <div className="mt-1 text-base font-bold font-mono text-red-800">
                      {fmtMoney(defaulterAging.summary.buckets["90+ days"])} BDT
                    </div>
                  </div>
                </div>

                <DashCard
                  title={`Outstanding Student Defaulters (${defaulterAging.summary.totalDefaulters} invoices)`}
                  action={
                    <span className="text-xs font-semibold text-rose-700">
                      Total Due: {fmtMoney(defaulterAging.summary.totalOutstanding)} BDT
                    </span>
                  }
                >
                  <div className="overflow-x-auto rounded-xs border border-ink-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-ink-50 text-ink-700">
                        <tr>
                          <th className="px-2.5 py-1.5 font-semibold">Student Name</th>
                          <th className="px-2.5 py-1.5 font-semibold">Invoice No</th>
                          <th className="px-2.5 py-1.5 font-semibold">Period</th>
                          <th className="px-2.5 py-1.5 font-semibold">Due Date</th>
                          <th className="px-2.5 py-1.5 text-center font-semibold">Overdue Days</th>
                          <th className="px-2.5 py-1.5 font-semibold">Bucket</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Net Billed</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Paid</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Outstanding Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 bg-white">
                        {defaulterAging.items.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-ink-400">
                              No overdue invoices found! All student fees are cleared.
                            </td>
                          </tr>
                        ) : (
                          defaulterAging.items.map((it) => (
                            <tr key={it.invoiceId} className="hover:bg-ink-50">
                              <td className="px-2.5 py-1 font-medium text-ink-900">
                                {it.studentName}
                                {it.studentPhone && <span className="block text-[10px] text-ink-400">{it.studentPhone}</span>}
                              </td>
                              <td className="px-2.5 py-1 font-mono text-ink-700">{it.invoiceNo}</td>
                              <td className="px-2.5 py-1 text-ink-600">{it.billingPeriod}</td>
                              <td className="px-2.5 py-1 text-ink-600">{it.dueDate}</td>
                              <td className="px-2.5 py-1 text-center font-mono font-medium">{it.daysOverdue} d</td>
                              <td className="px-2.5 py-1">
                                <span
                                  className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                                    it.agingBucket === "0–30 days"
                                      ? "bg-amber-100 text-amber-800"
                                      : it.agingBucket === "31–60 days"
                                      ? "bg-orange-100 text-orange-800"
                                      : it.agingBucket === "61–90 days"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-red-200 text-red-900"
                                  }`}
                                >
                                  {it.agingBucket}
                                </span>
                              </td>
                              <td className="px-2.5 py-1 text-right font-mono text-ink-600">{fmtMoney(it.netAmount)}</td>
                              <td className="px-2.5 py-1 text-right font-mono text-emerald-700">{fmtMoney(it.paidAmount)}</td>
                              <td className="px-2.5 py-1 text-right font-mono font-bold text-rose-700">{fmtMoney(it.dueBalance)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </DashCard>
              </div>
            )}

            {/* TAB 6: GENERAL LEDGER */}
            {activeTab === "general-ledger" && generalLedger && (
              <DashCard
                title={`General Ledger Statement: ${generalLedger.account.glCode} — ${generalLedger.account.accountName}`}
                action={
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span>Opening: <b>{fmtMoney(generalLedger.openingBalance)}</b></span>
                    <span>Closing: <b className="text-brand-700">{fmtMoney(generalLedger.closingBalance)}</b></span>
                  </div>
                }
              >
                <div className="overflow-x-auto rounded-xs border border-ink-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 text-ink-700">
                      <tr>
                        <th className="px-2.5 py-1.5 font-semibold">Date</th>
                        <th className="px-2.5 py-1.5 font-semibold">Voucher No</th>
                        <th className="px-2.5 py-1.5 font-semibold">Type</th>
                        <th className="px-2.5 py-1.5 font-semibold">Narration / Memo</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Debit</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Credit</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 bg-white">
                      <tr className="bg-ink-50/50 font-semibold text-ink-700">
                        <td className="px-2.5 py-1">{startDate}</td>
                        <td className="px-2.5 py-1 font-mono">—</td>
                        <td className="px-2.5 py-1">—</td>
                        <td className="px-2.5 py-1 uppercase text-ink-500">Opening Balance Brought Forward</td>
                        <td className="px-2.5 py-1 text-right font-mono">—</td>
                        <td className="px-2.5 py-1 text-right font-mono">—</td>
                        <td className="px-2.5 py-1 text-right font-mono text-ink-900">{fmtMoney(generalLedger.openingBalance)}</td>
                      </tr>
                      {generalLedger.lines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-ink-400">
                            No journal transactions in this period.
                          </td>
                        </tr>
                      ) : (
                        generalLedger.lines.map((l) => (
                          <tr key={l.lineId} className="hover:bg-ink-50">
                            <td className="px-2.5 py-1 text-ink-600">{l.transactionDate}</td>
                            <td className="px-2.5 py-1 font-mono font-medium text-brand-700">{l.voucherNo}</td>
                            <td className="px-2.5 py-1">
                              <span className="rounded-xs bg-ink-100 px-1 py-0.2 text-[10px] font-medium text-ink-700">
                                {l.voucherType}
                              </span>
                            </td>
                            <td className="px-2.5 py-1 text-ink-800">
                              {l.narration}
                              {l.lineMemo && <span className="block text-[10px] text-ink-500 italic">{l.lineMemo}</span>}
                            </td>
                            <td className="px-2.5 py-1 text-right font-mono text-ink-800">
                              {parseFloat(l.debitAmount) > 0 ? fmtMoney(l.debitAmount) : "—"}
                            </td>
                            <td className="px-2.5 py-1 text-right font-mono text-ink-800">
                              {parseFloat(l.creditAmount) > 0 ? fmtMoney(l.creditAmount) : "—"}
                            </td>
                            <td className="px-2.5 py-1 text-right font-mono font-semibold text-ink-900">
                              {fmtMoney(l.runningBalance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="border-t-2 border-ink-300 bg-ink-100 font-semibold text-ink-900">
                      <tr>
                        <td colSpan={4} className="px-2.5 py-1.5 text-right uppercase">
                          Period Movements & Final Balance:
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(generalLedger.totalDebit)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(generalLedger.totalCredit)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-brand-800">{fmtMoney(generalLedger.closingBalance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </DashCard>
            )}

            {/* Official DIA Institutional Signature Block (visible during print) */}
            <div className="hidden print:block mt-16 pt-8 border-t border-ink-300">
              <div className="grid grid-cols-4 gap-6 text-center text-xs text-ink-700">
                <div className="border-t border-ink-400 pt-1">
                  <div className="font-semibold">Prepared by</div>
                  <div className="text-[10px] text-ink-500">Accountant / Cashier</div>
                </div>
                <div className="border-t border-ink-400 pt-1">
                  <div className="font-semibold">Verified by</div>
                  <div className="text-[10px] text-ink-500">Accounts Officer</div>
                </div>
                <div className="border-t border-ink-400 pt-1">
                  <div className="font-semibold">Approved by</div>
                  <div className="text-[10px] text-ink-500">Principal / Head of Inst.</div>
                </div>
                <div className="border-t border-ink-400 pt-1">
                  <div className="font-semibold">Statutory Audit</div>
                  <div className="text-[10px] text-ink-500">DIA / Govt. Auditor</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
