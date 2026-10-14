import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";

export default function VouchersPage() {
  return (
    <div>
      <DashPageHeader
        title="Vouchers"
        description="Phase 8.2 — Double-entry voucher workbench (JOURNAL / RECEIVE / PAYMENT / CONTRA / REVERSAL)."
      />
      <div className="grid gap-4">
        <DashCard title="What lives here">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
            <li>Dynamic multi-row entry form with live Total Debit / Total Credit / Difference bar.</li>
            <li>Per-fund balance indicator — every fund_id in the voucher must zero-sum (Zakat isolation).</li>
            <li>Maker → Checker → Approver queue; APPROVED entries are immutable (REVERSAL only).</li>
            <li>Period-lock guard against posting into a closed fiscal period.</li>
          </ul>
        </DashCard>
        <DashCard title="Implementation status">
          <p className="text-sm text-ink-600">
            UI scaffold ready. Backend pending — Phase 2 JournalPostingService +
            VoucherSequenceService + reversal engine under{" "}
            <code>apps/api/src/modules/accounting/core-gl/</code>.
          </p>
        </DashCard>
      </div>
    </div>
  );
}
