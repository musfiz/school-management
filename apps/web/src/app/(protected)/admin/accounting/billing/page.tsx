import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";

export default function BillingPage() {
  return (
    <div>
      <DashPageHeader
        title="Billing & Invoices"
        description="Phase 3 + 8 — Fee setup, waiver assignment, bulk invoice generation, student ledger."
      />
      <div className="grid gap-4">
        <DashCard title="What lives here">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
            <li>Fee heads & structures (monthly / term / credit-hour) with gross → waiver → net math.</li>
            <li>Gross-to-net waiver posting: Dr AR (net) + Dr Contra-Revenue (waiver) / Cr Fee Revenue (gross).</li>
            <li>Bulk invoice generator, student ledger, advance-fee (21201) amortization, caution-deposit (21401) settlement.</li>
            <li>Late-fine automation: Dr 11401 AR / Cr 42103 fine revenue on overdue invoices.</li>
          </ul>
        </DashCard>
        <DashCard title="Implementation status">
          <p className="text-sm text-ink-600">
            UI scaffold ready. Backend pending — Phase 3 StudentBillingService under{" "}
            <code>apps/api/src/modules/accounting/student-billing/</code>.
          </p>
        </DashCard>
      </div>
    </div>
  );
}
