import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";

export default function AccountingReportsPage() {
  return (
    <div>
      <DashPageHeader
        title="Reports & Audit"
        description="Phase 7 + 8.5 — Statutory viewer: trial balance, DIA / UGC statements, aging."
      />
      <div className="grid gap-4">
        <DashCard title="What lives here">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
            <li>Trial balance by GL × fund × cost center (Dr must equal Cr under every filter).</li>
            <li>DIA Receipts & Payments (cash basis via is_cash_or_bank lines) with opening/closing reconciliation.</li>
            <li>Income & Expenditure (accrual, budget vs. actual) and Balance Sheet per fund.</li>
            <li>Student defaulter & aging buckets (0–30 / 31–60 / 61–90 / 90+ days); PDF + Excel/CSV export.</li>
          </ul>
        </DashCard>
        <DashCard title="Implementation status">
          <p className="text-sm text-ink-600">
            UI scaffold ready. Backend pending — Phase 7 FinancialReportsService under{" "}
            <code>apps/api/src/modules/accounting/reports-audit/</code>.
          </p>
        </DashCard>
      </div>
    </div>
  );
}
