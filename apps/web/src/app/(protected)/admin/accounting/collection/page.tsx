import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";

export default function CollectionPage() {
  return (
    <div>
      <DashPageHeader
        title="Fee Collection"
        description="Phase 4 + 8.3 — POS counter screen, bank challans and MFS settlement viewer."
      />
      <div className="grid gap-4">
        <DashCard title="What lives here">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
            <li>Instant search by Student ID / Roll / Phone / barcode challan; unpaid invoices, waivers, late fines.</li>
            <li>Partial-payment allocation (arrears → fine → tuition → other) with MR-YYYY-XXXXXX money receipt print.</li>
            <li>MFS webhooks (bKash / Nagad / SSLCommerz / EkPay) with idempotent gateway_trx_id handling.</li>
            <li>TDR split: Dr 11301 clearing (net) + Dr 54103 TDR expense / Cr 11401 AR (gross); CONTRA on bank settlement.</li>
          </ul>
        </DashCard>
        <DashCard title="Implementation status">
          <p className="text-sm text-ink-600">
            UI scaffold ready. Backend pending — Phase 4 FeeCollectionService +
            MfsWebhookService under <code>apps/api/src/modules/accounting/collections-mfs/</code>.
          </p>
        </DashCard>
      </div>
    </div>
  );
}
