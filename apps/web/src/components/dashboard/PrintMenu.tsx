"use client";

import { useState } from "react";
import { Printer, Download, FileDown, ChevronDown, Loader2 } from "lucide-react";
import { printElement, printHtml, downloadPdfUrl, printPdfUrl } from "@/lib/print";
import { toast } from "@/lib/swal";

/**
 * Global print menu — one component for every invoice / receipt /
 * result / report print action.
 *
 * ```tsx
 * // Browser print of an on-page area:
 * <PrintMenu printTargetId="printable-report-area" title="Trial Balance" />
 *
 * // Server PDF (byte-identical on Windows / Linux / macOS):
 * <PrintMenu
 *   pdfUrl={`/api/documents/money-receipt/${receipt.id}/pdf`}
 *   fileName={`${receipt.moneyReceiptNo}.pdf`}
 *   printTargetId="receipt-preview"
 * />
 * ```
 */
export interface PrintMenuProps {
  /** Element id browser-printed via an isolated iframe. */
  printTargetId?: string;
  /** Raw HTML body browser-printed (receipts, cards). */
  htmlBody?: string;
  /** Server PDF endpoint (`/api/documents/...`). Enables PDF buttons. */
  pdfUrl?: string;
  /** Download filename for the server PDF. */
  fileName?: string;
  title?: string;
  className?: string;
  /**
   * Trigger size — `md` (30px, filter rows / cards) or `lg` (38px, modal
   * footers next to `text-sm py-2` buttons). Follows the button standard.
   */
  size?: "md" | "lg";
  /** Stretch the trigger to its container width (e.g. `flex-1` in footers). */
  fullWidth?: boolean;
}

type Busy = null | "print" | "pdf-print" | "pdf-download";

export default function PrintMenu({
  printTargetId,
  htmlBody,
  pdfUrl,
  fileName,
  title = "Document",
  className = "",
  size = "md",
  fullWidth = false,
}: PrintMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const canBrowserPrint = Boolean(printTargetId || htmlBody);
  const canPdf = Boolean(pdfUrl);

  const run = async (kind: Exclude<Busy, null>, fn: () => void | Promise<void> | null) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Print failed", "error");
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const doBrowserPrint = () =>
    run("print", () => {
      if (printTargetId) printElement(printTargetId, title);
      else if (htmlBody) printHtml({ title, bodyHtml: htmlBody });
    });

  const doPdfPrint = () => run("pdf-print", () => (pdfUrl ? printPdfUrl(pdfUrl) : null));
  const doPdfDownload = () =>
    run("pdf-download", () => (pdfUrl ? downloadPdfUrl(pdfUrl, fileName || `${title}.pdf`) : null));

  const triggerCls =
    size === "lg"
      ? "border border-brand-600 bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      : "border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50";
  const triggerWidth = fullWidth ? "w-full justify-center" : "";
  const triggerIcon = size === "lg" ? "h-4 w-4" : "h-3 w-3";

  // Single action → render a plain button instead of a dropdown.
  if ((canBrowserPrint && !canPdf) || (!canBrowserPrint && canPdf && false)) {
    return (
      <button
        type="button"
        onClick={doBrowserPrint}
        disabled={busy !== null}
        className={`flex cursor-pointer items-center gap-1 rounded-xs ${triggerCls} disabled:opacity-60 ${triggerWidth} ${className}`}
      >
        {busy === "print" ? <Loader2 className={`${triggerIcon} animate-spin`} /> : <Printer className={triggerIcon} />}
        <span>Print</span>
      </button>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className={`flex cursor-pointer items-center gap-1 rounded-xs ${triggerCls} ${triggerWidth}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Printer className={triggerIcon} />
        <span>Print / PDF</span>
        <ChevronDown className={triggerIcon} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-44 rounded-xs border border-ink-200 bg-white py-1 shadow-card"
        >
          {canBrowserPrint && (
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={doBrowserPrint}
              disabled={busy !== null}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-60"
            >
              {busy === "print" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              <span>Print (browser)</span>
            </button>
          )}
          {canPdf && (
            <>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={doPdfPrint}
                disabled={busy !== null}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-60"
              >
                {busy === "pdf-print" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                <span>Print PDF (A4)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={doPdfDownload}
                disabled={busy !== null}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-60"
              >
                {busy === "pdf-download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                <span>Download PDF</span>
              </button>
            </>
          )}
          {!canBrowserPrint && !canPdf && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-ink-400">
              <Download className="h-3.5 w-3.5" />
              <span>No print source</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
