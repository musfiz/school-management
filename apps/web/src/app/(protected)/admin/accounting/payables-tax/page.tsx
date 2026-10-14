import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";

export default function PayablesTaxPage() {
  return (
    <div>
      <DashPageHeader
        title="Payables & NBR Tax"
        description="Phase 5 + 8.4 — Vendor bills, VDS/TDS engine and Treasury Challan register."
      />
      <div className="grid gap-4">
        <DashCard title="What lives here">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
            <li>Vendor bill entry with Gross → TDS → VDS → Net Payable calculator (Mushak 6.3 flag).</li>
            <li>Auto-post: Dr 5xxxx/121xx (gross) / Cr 21101 AP (net) + Cr 21302 TDS + Cr 21304 VDS.</li>
            <li>Pending NBR Treasury Challan tab — batch withheld taxes by challan no. + date.</li>
            <li>Remittance post: Dr 21302/21304 / Cr 11201 operating bank.</li>
          </ul>
        </DashCard>
        <DashCard title="Implementation status">
          <p className="text-sm text-ink-600">
            UI scaffold ready. Backend pending — Phase 5 VendorBillService under{" "}
            <code>apps/api/src/modules/accounting/procurement-tax/</code>.
          </p>
        </DashCard>
      </div>
    </div>
  );
}
