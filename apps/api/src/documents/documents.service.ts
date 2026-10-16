import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';

export interface GenericReportPdfDto {
  title: string;
  subtitle?: string;
  meta?: Array<{ label: string; value: string }>;
  columns: Array<{ header: string; width?: number; align?: 'left' | 'right' | 'center' }>;
  rows: string[][];
  totals?: Array<{ label: string; value: string }>;
  notes?: string[];
  signatures?: string[];
  copiesLine?: string;
}

const money = (v: unknown): string => {
  try {
    return new Decimal(v == null || v === '' ? '0' : String(v)).toFixed(2);
  } catch {
    return '0.00';
  }
};

const dateOnly = (v: string | Date | null | undefined): string => {
  if (!v) return '-';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly pdf: PdfService,
    private readonly prisma: PrismaService,
  ) {}

  private async letterhead(): Promise<{
    schoolName: string;
    tagline?: string;
    address?: string;
    contactLine?: string;
  }> {
    try {
      // TypeORM's `find({ take: 1 })`; Prisma's `findFirst()` is the same
      // single-row read.
      const s = await this.prisma.siteSettings.findFirst();
      if (!s) return { schoolName: 'My School' };
      const contact = [s.phone, s.email, s.eiin ? `EIIN: ${s.eiin}` : '']
        .filter(Boolean)
        .join('  |  ');
      return {
        schoolName: s.siteName || 'My School',
        tagline: s.tagline || undefined,
        address: s.address || undefined,
        contactLine: contact || undefined,
      };
    } catch {
      return { schoolName: 'My School' };
    }
  }

  private async actorName(id?: string | null): Promise<string> {
    if (!id) return '-';
    try {
      const u = await this.prisma.users.findUnique({ where: { id } });
      return u?.name || '-';
    } catch {
      return '-';
    }
  }

  /* ── Money receipt (POS collection) ─────────────────────────── */
  async moneyReceiptPdf(id: string): Promise<{ filename: string; buffer: Buffer }> {
    // Entity relations invoice / cashGl → Prisma relations studentInvoices /
    // chartOfAccounts (fund was loaded by the old query but never read).
    const receipt = await this.prisma.paymentCollections.findUnique({
      where: { id },
      include: { studentInvoices: true, chartOfAccounts: true },
    });
    if (!receipt) throw new NotFoundException(`Money receipt ${id} not found`);

    const head = await this.letterhead();
    const collectedBy = await this.actorName(receipt.collectedByUserId);

    let allocation: Array<{ label: string; glCode: string; amount: string }> = [];
    try {
      const raw = receipt.allocation ? JSON.parse(receipt.allocation) : [];
      if (Array.isArray(raw)) {
        allocation = raw.map((a) => ({
          label: String(a.label ?? a.feeHeadCode ?? 'Fee'),
          glCode: String(a.glCode ?? ''),
          amount: money(a.amount),
        }));
      }
    } catch {
      allocation = [];
    }

    const rows =
      allocation.length > 0
        ? allocation.map((a, i) => [String(i + 1), a.label, a.glCode, a.amount])
        : [['1', 'Tuition / fee collection', receipt.chartOfAccounts?.glCode ?? '', money(receipt.collectedGrossAmount)]];

    const buffer = await this.pdf.buildDocument({
      ...head,
      title: 'Money Receipt',
      subtitle: `${receipt.moneyReceiptNo}  |  ${receipt.paymentChannel}  |  ${receipt.reconciliationStatus}`,
      meta: [
        { label: 'Receipt No', value: receipt.moneyReceiptNo },
        { label: 'Date', value: dateOnly(receipt.createdAt) },
        { label: 'Invoice', value: receipt.studentInvoices?.invoiceNo ?? receipt.invoiceId },
        { label: 'Billing Period', value: receipt.studentInvoices?.billingPeriod ?? '-' },
        { label: 'Student ID', value: receipt.studentId },
        { label: 'Cash/Bank GL', value: receipt.chartOfAccounts ? `${receipt.chartOfAccounts.glCode} - ${receipt.chartOfAccounts.accountName}` : '-' },
        { label: 'Gateway Trx', value: receipt.gatewayTrxId || '-' },
        { label: 'Bank Ref', value: receipt.bankReference || '-' },
        { label: 'Collected By', value: collectedBy },
        { label: 'Voucher', value: receipt.glJournalId || '-' },
      ],
      columns: [
        { header: '#', width: 1, align: 'center' },
        { header: 'Particulars', width: 6 },
        { header: 'GL', width: 2, align: 'center' },
        { header: 'Amount (BDT)', width: 3, align: 'right' },
      ],
      rows,
      totals: [
        { label: 'Gross received', value: `${money(receipt.collectedGrossAmount)} BDT` },
        ...(new Decimal(receipt.gatewayTdrFee || '0').gt(0)
          ? [{ label: 'Less: Gateway TDR (54103)', value: `${money(receipt.gatewayTdrFee)} BDT` }]
          : []),
        { label: 'Net to cash/bank', value: `${money(receipt.netBankAmount)} BDT` },
      ],
      notes: [
        'Student ledger is credited with the full gross amount; TDR is booked as gateway commission expense.',
        ...(receipt.remark ? [`Remark: ${receipt.remark}`] : []),
      ],
      signatures: ['Received By (Cashier)', 'Checked By (Accountant)', 'Principal'],
      copiesLine: 'Office copy  |  Student copy  |  Audit copy',
    });

    return { filename: `${receipt.moneyReceiptNo}.pdf`, buffer };
  }

  /* ── Student invoice / bill ─────────────────────────────────── */
  async studentInvoicePdf(id: string): Promise<{ filename: string; buffer: Buffer }> {
    const invoice = await this.prisma.studentInvoices.findUnique({
      where: { id },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);

    // Entity relations feeHead / glAccount → Prisma feeHeads / chartOfAccounts.
    const lines = await this.prisma.studentInvoiceLines.findMany({
      where: { invoiceId: id },
      include: { feeHeads: true, chartOfAccounts: true },
    });

    const head = await this.letterhead();
    const rows = lines.map((l, i) => [
      String(i + 1),
      l.feeHeads?.headName ?? l.lineMemo ?? 'Fee',
      l.chartOfAccounts?.glCode ?? '',
      money(l.grossAmount),
      money(l.waiverAmount),
      money(l.netAmount),
    ]);

    const due = new Decimal(invoice.netAmount || '0')
      .plus(invoice.lateFineAmount || '0')
      .minus(invoice.paidAmount || '0')
      .toFixed(2);

    const buffer = await this.pdf.buildDocument({
      ...head,
      title: 'Student Invoice',
      subtitle: `${invoice.invoiceNo}  |  ${invoice.billingPeriod}  |  ${invoice.status}`,
      meta: [
        { label: 'Invoice No', value: invoice.invoiceNo },
        { label: 'Billing Period', value: invoice.billingPeriod },
        { label: 'Issue Date', value: dateOnly(invoice.issueDate) },
        { label: 'Due Date', value: dateOnly(invoice.dueDate) },
        { label: 'Student ID', value: invoice.studentId },
        { label: 'Status', value: invoice.status },
      ],
      columns: [
        { header: '#', width: 1, align: 'center' },
        { header: 'Fee Head', width: 5 },
        { header: 'GL', width: 2, align: 'center' },
        { header: 'Gross', width: 2.5, align: 'right' },
        { header: 'Waiver', width: 2.5, align: 'right' },
        { header: 'Net', width: 2.5, align: 'right' },
      ],
      rows,
      totals: [
        { label: 'Gross amount', value: `${money(invoice.grossAmount)} BDT` },
        { label: 'Less: Waiver', value: `${money(invoice.waiverAmount)} BDT` },
        { label: 'Net payable', value: `${money(invoice.netAmount)} BDT` },
        { label: 'Late fine', value: `${money(invoice.lateFineAmount)} BDT` },
        { label: 'Paid', value: `${money(invoice.paidAmount)} BDT` },
        { label: 'Balance due', value: `${due} BDT` },
      ],
      notes: invoice.narration ? [invoice.narration] : ['Gross-to-net waiver accounting: waivers never reduce the billed gross.'],
      signatures: ['Prepared By (Accountant)', 'Checked By', 'Principal'],
    });

    return { filename: `${invoice.invoiceNo}.pdf`, buffer };
  }

  /* ── Generic tabular report (trial balance, aging, audit …) ── */
  async genericReportPdf(dto: GenericReportPdfDto): Promise<{ filename: string; buffer: Buffer }> {
    const head = await this.letterhead();
    const buffer = await this.pdf.buildDocument({
      ...head,
      title: dto.title || 'Report',
      subtitle: dto.subtitle,
      meta: (dto.meta || []).map((m) => ({ label: m.label, value: m.value })),
      columns: dto.columns.map((c) => ({
        header: c.header,
        width: c.width && c.width > 0 ? c.width : 1,
        align: c.align ?? 'left',
      })),
      rows: (dto.rows || []).map((r) => r.map((c) => String(c ?? ''))),
      totals: dto.totals,
      notes: dto.notes,
      signatures: dto.signatures?.length
        ? dto.signatures
        : ['Prepared By (Accountant)', 'Principal', 'Auditor'],
      copiesLine: dto.copiesLine,
    });

    const slug = (dto.title || 'report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'report';
    return { filename: `${slug}-${new Date().toISOString().slice(0, 10)}.pdf`, buffer };
  }
}
