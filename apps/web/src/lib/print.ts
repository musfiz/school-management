"use client";

/**
 * Global print & PDF utilities — single entry point for every
 * invoice / receipt / result / report print action in the dashboard.
 *
 * Two complementary paths (by design):
 *
 *  1. Browser print (`printElement` / `printHtml`) — instant, offline,
 *     zero server cost. Used for on-screen receipts and report tables.
 *     Isolation is done via a hidden <iframe> so dashboard chrome
 *     (sidebar / topbar / modals) never leaks onto the paper.
 *
 *  2. Server PDF (`fetchPdfBlob` / `downloadPdfUrl` / `printPdfUrl`) —
 *     byte-identical A4 documents from NestJS + pdf-lib
 *     (`GET /documents/.../pdf`, `POST /documents/report/pdf`), which is
 *     pure JS with no native deps, so output is identical on
 *     Windows / Linux / macOS with no Chromium install.
 */

function buildPrintCss(): string {
  return `
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; font-size: 11px; }
    th { background: #f1f5f9; font-weight: 700; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 16px 0 6px; }
    .print-header { text-align: center; border-bottom: 2px solid #0b1630; padding-bottom: 10px; margin-bottom: 12px; }
    .print-header p { margin: 2px 0; color: #475569; font-size: 11px; }
    .print-signatures { display: flex; gap: 24px; margin-top: 48px; }
    .print-signatures > div { flex: 1; border-top: 1px solid #0f172a; padding-top: 4px; text-align: center; font-size: 11px; }
    .text-right { text-align: right; }
    .font-mono { font-family: ui-monospace, Menlo, monospace; }
    @page { size: A4; margin: 12mm; }
  `;
}

function openPrintIframe(title: string): { frame: HTMLIFrameElement; doc: Document } {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);
  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    throw new Error("Print frame unavailable");
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>${title.replace(/</g, "&lt;")}</title>` +
      `<style>${buildPrintCss()}</style></head><body></body></html>`,
  );
  doc.close();
  return { frame, doc };
}

/** Browser-print an on-page element by id (isolated in an iframe). */
export function printElement(elementId: string, title = "Document"): void {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Printable area #${elementId} not found`);
  const { frame, doc } = openPrintIframe(title);
  doc.body.innerHTML = el.innerHTML;
  const win = frame.contentWindow;
  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  if (win) {
    win.addEventListener("afterprint", cleanup);
    win.focus();
    win.print();
    window.setTimeout(() => frame.isConnected && frame.remove(), 5000);
  } else {
    cleanup();
  }
}

/** Browser-print an arbitrary HTML string (receipts, cards, labels). */
export function printHtml(opts: { title?: string; header?: string; bodyHtml: string }): void {
  const { frame, doc } = openPrintIframe(opts.title ?? "Document");
  doc.body.innerHTML = `${opts.header ?? ""}${opts.bodyHtml}`;
  const win = frame.contentWindow;
  if (win) {
    win.addEventListener("afterprint", () => window.setTimeout(() => frame.remove(), 500));
    win.focus();
    win.print();
    window.setTimeout(() => frame.isConnected && frame.remove(), 5000);
  }
}

/** Fetch a server-generated PDF as a Blob (same-origin, session cookie). */
export async function fetchPdfBlob(url: string, init: RequestInit = {}): Promise<Blob> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  if (!res.ok) {
    let message = `PDF request failed (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data?.message) message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    } catch {
      /* binary error body — keep generic message */
    }
    throw new Error(message);
  }
  return await res.blob();
}

/** Download a Blob as a file (works on all desktop OS browsers). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Download a server PDF (`/api/documents/...`) to disk. */
export async function downloadPdfUrl(url: string, filename: string): Promise<void> {
  const blob = await fetchPdfBlob(url);
  downloadBlob(blob, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/**
 * Print a server PDF via a hidden iframe (Chrome / Edge / Firefox).
 * Safari / mobile fall back to opening the PDF in a new tab.
 */
export async function printPdfUrl(url: string): Promise<void> {
  const blob = await fetchPdfBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.setAttribute("aria-hidden", "true");
  const cleanup = () => {
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  };
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(objectUrl, "_blank");
    }
    window.setTimeout(() => frame.isConnected && cleanup(), 5000);
  };
  frame.src = objectUrl;
  document.body.appendChild(frame);
  // Safety net if onload never fires (blocked iframe PDF viewer).
  window.setTimeout(() => {
    if (frame.isConnected && !frame.contentWindow?.document?.body?.innerHTML) {
      window.open(objectUrl, "_blank");
      cleanup();
    }
  }, 8000);
}

/** POST a generic report payload and download the resulting PDF. */
export async function downloadReportPdf(
  payload: Record<string, unknown>,
  filename: string,
): Promise<void> {
  const blob = await fetchPdfBlob("/api/documents/report/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  downloadBlob(blob, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
