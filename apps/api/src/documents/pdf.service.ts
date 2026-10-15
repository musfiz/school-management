import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

/**
 * Thin A4 document builder on top of pdf-lib (pure JS — no native
 * dependencies, identical output on Windows / Linux / macOS).
 *
 * Why pdf-lib and not Puppeteer/Chromium:
 *  - zero browser download (~170MB) and no OS-level libs (libnss etc.),
 *  - deterministic offline output inside minimal Docker images,
 *  - works the same on a Windows dev laptop and a Linux VPS.
 *
 * Uses built-in Helvetica / Helvetica-Bold only, so no font files are
 * needed on any OS. (Trade-off: no Bangla glyphs — Bangla text is stripped
 * to a safe ASCII fallback. Embed a TTF such as NotoSansBengali when
 * Bangla PDFs are required.)
 */

export interface PdfMetaItem {
  label: string;
  value: string;
}

export interface PdfColumn {
  header: string;
  /** Relative width weight (columns share the table width by weight). */
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfDocumentOptions {
  schoolName: string;
  tagline?: string;
  address?: string;
  contactLine?: string;
  title: string;
  subtitle?: string;
  meta: PdfMetaItem[];
  columns: PdfColumn[];
  rows: string[][];
  totals?: PdfMetaItem[];
  notes?: string[];
  /** Signature blocks printed at the bottom (e.g. Accountant / Principal / Auditor). */
  signatures?: string[];
  /** Printed under the title, e.g. "Office copy | Student copy". */
  copiesLine?: string;
}

const PAGE_W = 595.28; // A4 portrait (pt)
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.09, 0.16, 0.29);
const MUTED = rgb(0.39, 0.45, 0.55);
const LINE = rgb(0.78, 0.82, 0.89);
const HEADER_BG = rgb(0.93, 0.95, 0.98);

/** Strip characters the built-in WinAnsi fonts cannot encode. */
export function safeText(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

@Injectable()
export class PdfService {
  private async fonts(doc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
    const [regular, bold] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
    ]);
    return { regular, bold };
  }

  private newPage(doc: PDFDocument): PDFPage {
    return doc.addPage([PAGE_W, PAGE_H]);
  }

  private footer(page: PDFPage, regular: PDFFont, pageNo: number, pageCount: () => number) {
    const stamp = `Page ${pageNo}  |  System generated — ${new Date().toISOString().slice(0, 10)}`;
    page.drawText(safeText(stamp), {
      x: MARGIN,
      y: 28,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    const total = `of ${pageCount()}`;
    const w = regular.widthOfTextAtSize(total, 7.5);
    page.drawText(total, { x: PAGE_W - MARGIN - w, y: 28, size: 7.5, font: regular, color: MUTED });
  }

  private wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = safeText(text).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth || !current) {
        current = trial;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  async buildDocument(opts: PdfDocumentOptions): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const { regular, bold } = await this.fonts(doc);

    let page = this.newPage(doc);
    let y = PAGE_H - MARGIN;
    const pageCount = () => doc.getPageCount();
    let pageNo = 1;

    const ensureSpace = (needed: number) => {
      if (y - needed < 60) {
        this.footer(page, regular, pageNo, pageCount);
        page = this.newPage(doc);
        pageNo = doc.getPageCount();
        y = PAGE_H - MARGIN;
      }
    };

    // ── Letterhead ──────────────────────────────────────────────
    page.drawText(safeText(opts.schoolName).toUpperCase(), {
      x: MARGIN,
      y,
      size: 15,
      font: bold,
      color: INK,
    });
    y -= 17;
    if (opts.tagline) {
      page.drawText(safeText(opts.tagline), { x: MARGIN, y, size: 9, font: regular, color: MUTED });
      y -= 13;
    }
    if (opts.address) {
      for (const line of this.wrap(opts.address, regular, 8.5, CONTENT_W)) {
        page.drawText(line, { x: MARGIN, y, size: 8.5, font: regular, color: MUTED });
        y -= 11;
      }
    }
    if (opts.contactLine) {
      page.drawText(safeText(opts.contactLine), {
        x: MARGIN,
        y,
        size: 8.5,
        font: regular,
        color: MUTED,
      });
      y -= 12;
    }
    y -= 2;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: INK });
    y -= 16;

    // ── Title block ─────────────────────────────────────────────
    page.drawText(safeText(opts.title), { x: MARGIN, y, size: 13, font: bold, color: INK });
    y -= 15;
    if (opts.subtitle) {
      page.drawText(safeText(opts.subtitle), { x: MARGIN, y, size: 9.5, font: regular, color: MUTED });
      y -= 13;
    }
    if (opts.copiesLine) {
      page.drawText(safeText(opts.copiesLine), { x: MARGIN, y, size: 8, font: regular, color: MUTED });
      y -= 12;
    }

    // ── Meta grid (2 columns) ───────────────────────────────────
    if (opts.meta.length > 0) {
      const colW = CONTENT_W / 2;
      let my = y;
      opts.meta.forEach((m, i) => {
        const col = i % 2;
        if (col === 0 && i > 0) my -= 13;
        ensureSpace(16);
        const x = MARGIN + col * colW;
        const label = safeText(`${m.label}: `);
        page.drawText(label, { x, y: my, size: 8.5, font: bold, color: INK });
        const lx = x + bold.widthOfTextAtSize(label, 8.5);
        const valueLines = this.wrap(m.value, regular, 8.5, colW - (lx - x) - 4);
        page.drawText(valueLines[0] ?? '', { x: lx, y: my, size: 8.5, font: regular, color: INK });
        if (valueLines.length > 1) my -= (valueLines.length - 1) * 10;
      });
      y = my - 16;
    }

    // ── Table ───────────────────────────────────────────────────
    const totalWeight = opts.columns.reduce((a, c) => a + c.width, 0) || 1;
    const colWidths = opts.columns.map((c) => (CONTENT_W * c.width) / totalWeight);
    const colX: number[] = [];
    let acc = MARGIN;
    for (const w of colWidths) {
      colX.push(acc);
      acc += w;
    }

    const drawHeaderRow = () => {
      ensureSpace(24);
      page.drawRectangle({
        x: MARGIN,
        y: y - 4,
        width: CONTENT_W,
        height: 18,
        color: HEADER_BG,
      });
      opts.columns.forEach((c, i) => {
        const label = safeText(c.header);
        const tw = bold.widthOfTextAtSize(label, 8.5);
        let tx = colX[i] + 5;
        if (c.align === 'right') tx = colX[i] + colWidths[i] - tw - 5;
        else if (c.align === 'center') tx = colX[i] + (colWidths[i] - tw) / 2;
        page.drawText(label, { x: tx, y: y, size: 8.5, font: bold, color: INK });
      });
      y -= 18;
    };

    drawHeaderRow();

    opts.rows.forEach((row, ri) => {
      const cellLines = row.map((cell, i) =>
        this.wrap(cell, regular, 8.5, colWidths[i] - 10),
      );
      const rowH = Math.max(15, Math.max(...cellLines.map((l) => l.length)) * 10.5);
      ensureSpace(rowH + 4);
      if (ri % 2 === 1) {
        page.drawRectangle({ x: MARGIN, y: y - rowH + 11, width: CONTENT_W, height: rowH, color: rgb(0.97, 0.98, 1) });
      }
      cellLines.forEach((lines, i) => {
        const align = opts.columns[i]?.align ?? 'left';
        lines.forEach((line, li) => {
          const tw = regular.widthOfTextAtSize(line, 8.5);
          let tx = colX[i] + 5;
          if (align === 'right') tx = colX[i] + colWidths[i] - tw - 5;
          else if (align === 'center') tx = colX[i] + (colWidths[i] - tw) / 2;
          page.drawText(line, { x: tx, y: y - li * 10.5, size: 8.5, font: regular, color: INK });
        });
      });
      y -= rowH;
      page.drawLine({
        start: { x: MARGIN, y: y + 3 },
        end: { x: PAGE_W - MARGIN, y: y + 3 },
        thickness: 0.5,
        color: LINE,
      });
    });

    // ── Totals ──────────────────────────────────────────────────
    if (opts.totals && opts.totals.length > 0) {
      y -= 6;
      for (const t of opts.totals) {
        ensureSpace(14);
        const label = safeText(t.label);
        const value = safeText(t.value);
        const vw = bold.widthOfTextAtSize(value, 9);
        page.drawText(label, { x: MARGIN, y, size: 9, font: bold, color: INK });
        page.drawText(value, { x: PAGE_W - MARGIN - vw, y, size: 9, font: bold, color: INK });
        y -= 13;
      }
    }

    // ── Notes ───────────────────────────────────────────────────
    if (opts.notes && opts.notes.length > 0) {
      y -= 4;
      ensureSpace(14);
      page.drawText('Notes:', { x: MARGIN, y, size: 8.5, font: bold, color: INK });
      y -= 12;
      for (const note of opts.notes) {
        for (const line of this.wrap(`- ${note}`, regular, 8, CONTENT_W - 10)) {
          ensureSpace(12);
          page.drawText(line, { x: MARGIN + 6, y, size: 8, font: regular, color: MUTED });
          y -= 10.5;
        }
      }
    }

    // ── Signature blocks ────────────────────────────────────────
    if (opts.signatures && opts.signatures.length > 0) {
      ensureSpace(90);
      y -= 26;
      const n = opts.signatures.length;
      const blockW = CONTENT_W / n;
      opts.signatures.forEach((sig, i) => {
        const cx = MARGIN + i * blockW + 8;
        page.drawLine({
          start: { x: cx, y },
          end: { x: cx + blockW - 16, y },
          thickness: 0.8,
          color: INK,
        });
        const label = safeText(sig);
        const tw = regular.widthOfTextAtSize(label, 8);
        page.drawText(label, {
          x: cx + Math.max(0, (blockW - 16 - tw) / 2),
          y: y - 12,
          size: 8,
          font: regular,
          color: INK,
        });
      });
      y -= 24;
    }

    this.footer(page, regular, pageNo, pageCount);
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}
