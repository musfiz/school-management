# Global Print & PDF Design

One print system for invoices, money receipts, results, and statutory
reports — identical output on Windows, Linux, and macOS.

## Decision: pdf-lib (server) + isolated iframe (browser)

| Option | Verdict |
|---|---|
| Puppeteer / Playwright + Chromium | Rejected — ~170MB browser download, OS-level libs (`libnss`) break minimal Docker images, different behavior per OS. |
| `@react-pdf/renderer` | Workable, but React-bound and heavier; no advantage over pdf-lib for tabular documents. |
| **pdf-lib (pure JS, zero native deps)** | **Chosen** — runs anywhere Node runs, deterministic offline output, same bytes on a Windows laptop and a Linux VPS. Built-in Helvetica only, so no font files needed. |
| Browser `window.print()` on the full page | Rejected — prints sidebar/topbar/modal chrome. Replaced by iframe-isolated printing. |

Trade-off: built-in fonts have no Bangla glyphs (non-Latin chars are
stripped). When Bangla PDFs are required, embed a TTF (e.g.
NotoSansBengali) via `pdf-lib`'s `embedFont` — no other change needed.

## Backend (`apps/api/src/documents/`)

- `pdf.service.ts` — A4 builder: letterhead (from Site Settings),
  title/meta/table/totals/notes/signature blocks, auto-pagination,
  page numbers. Pure function of JSON → `Buffer`.
- `documents.service.ts` — builders:
  - Money receipt PDF (allocation legs, gross/TDR/net split),
  - Student invoice PDF (gross-to-net + balance due),
  - Generic report PDF (`{ title, columns, rows, totals, … }`).
- `documents.controller.ts` — `GET /documents/money-receipt/:id/pdf`,
  `GET /documents/student-invoice/:id/pdf`, `POST /documents/report/pdf`
  (guarded: admin / management / accountant / teacher).
- Wired in `AppModule` via `DocumentsModule`.

## Frontend

- `lib/print.ts` — the only import print code needs:
  - `printElement(id, title)` / `printHtml({ title, bodyHtml })` —
    browser print inside a hidden iframe (dashboard chrome never leaks).
  - `fetchPdfBlob` / `downloadPdfUrl` / `printPdfUrl` — server PDFs
    (same-origin, session cookie; iframe print with new-tab fallback).
  - `downloadReportPdf(payload, filename)` — generic report export.
- `app/api/documents/[...path]/route.ts` — binary-safe Next proxy
  (preserves Content-Type/Disposition; the JSON accounting proxy would
  corrupt PDFs).
- `components/dashboard/PrintMenu.tsx` — single dropdown used
  everywhere: Print (browser) / Print PDF (A4) / Download PDF.
- `globals.css` — `@media print`: A4 `@page`, table header repeats,
  UI portals (toasts, calendars) hidden.

## Adopted so far / adopt next

- Done: collection money-receipt modal (browser print + server PDF),
  reports viewer (browser print + per-tab server PDF), audit trail
  (isolated browser print).
- Next: billing invoice list → `PrintMenu` with
  `/api/documents/student-invoice/:id/pdf`; results report cards →
  `POST /api/documents/report/pdf` with columns
  (Subject / Full Marks / Obtained / Grade).
