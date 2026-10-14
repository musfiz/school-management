import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";

export default function PayrollPage() {
  return (
    <div>
      <DashPageHeader
        title="Payroll & MPO"
        description="Phase 6 — Monthly salary sheet (MPO / institutional split), honorarium, PF ledger."
      />
      <div className="grid gap-4">
        <DashCard title="What lives here">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
            <li>MPO isolation: government EFT shown on payslips, only institutional amounts hit the GL.</li>
            <li>Institutional post: Dr 51101 salary + Dr 51104 employer PF / Cr 22101 PF liability + Cr 21301 AIT + Cr 21102 payable.</li>
            <li>Adjunct / guest-faculty honorarium with 10–15% TDS into 21303, credited to 21103.</li>
            <li>PF trust ledger and staff advance/loan (11403) deductions.</li>
          </ul>
        </DashCard>
        <DashCard title="Implementation status">
          <p className="text-sm text-ink-600">
            UI scaffold ready. Backend pending — Phase 6 PayrollAccountingService under{" "}
            <code>apps/api/src/modules/accounting/payroll-mpo/</code>.
          </p>
        </DashCard>
      </div>
    </div>
  );
}
