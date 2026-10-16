import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PdfService } from './pdf.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const receiptRow = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  moneyReceiptNo: 'MR-1',
  studentId: 's1',
  invoiceId: 'i1',
  paymentChannel: 'CASH',
  gatewayTrxId: null,
  collectedGrossAmount: '2000.00',
  gatewayTdrFee: '0.00',
  netBankAmount: '2000.00',
  cashGlId: 'g1',
  fundId: null,
  reconciliationStatus: 'COLLECTED',
  glJournalId: null,
  settlementJournalId: null,
  bankReference: null,
  allocation: null,
  collectedByUserId: 'u1',
  remark: null,
  createdAt: new Date('2026-10-16T00:00:00.000Z'),
  updatedAt: new Date('2026-10-16T00:00:00.000Z'),
  studentInvoices: { invoiceNo: 'INV-1', billingPeriod: '2026-10' },
  chartOfAccounts: { glCode: '10101', accountName: 'Cash in Hand' },
  ...over,
});

const invoiceRow = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  invoiceNo: 'INV-1',
  studentId: 's1',
  billingPeriod: '2026-10',
  issueDate: new Date('2026-04-01T00:00:00.000Z'),
  dueDate: new Date('2026-05-01T00:00:00.000Z'),
  status: 'UNPAID',
  grossAmount: '6000.00',
  waiverAmount: '1000.00',
  netAmount: '5000.00',
  paidAmount: '2000.00',
  lateFineAmount: '100.00',
  narration: 'fixture',
  ...over,
});

const lineRow = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  invoiceId: 'i1',
  lineMemo: 'Tuition',
  grossAmount: '4000.00',
  waiverAmount: '500.00',
  netAmount: '3500.00',
  feeHeads: { headName: 'Tuition Fee' },
  chartOfAccounts: { glCode: '40101' },
  ...over,
});

describe('DocumentsService', () => {
  let prisma: PrismaMock;
  let pdf: { buildDocument: jest.Mock };
  let service: DocumentsService;

  const lastBuild = () => pdf.buildDocument.mock.calls[0][0] as Record<string, any>;

  beforeEach(() => {
    prisma = createPrismaMock();
    pdf = { buildDocument: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
    service = new DocumentsService(pdf as unknown as PdfService, asPrisma(prisma));
  });

  describe('moneyReceiptPdf', () => {
    it('throws NotFoundException when the receipt is missing', async () => {
      prisma.paymentCollections.findUnique.mockResolvedValue(null);
      await expect(service.moneyReceiptPdf('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(pdf.buildDocument).not.toHaveBeenCalled();
    });

    it('maps the invoice + cash GL relations and the allocation rows', async () => {
      prisma.paymentCollections.findUnique.mockResolvedValue(
        receiptRow({
          allocation: JSON.stringify([
            { label: 'Tuition', glCode: '40101', amount: '2000' },
          ]),
        }),
      );
      prisma.users.findUnique.mockResolvedValue({ id: 'u1', name: 'Cashier' });

      const out = await service.moneyReceiptPdf('c1');

      expect(out.filename).toBe('MR-1.pdf');
      const arg = lastBuild();
      expect(arg.meta).toContainEqual({ label: 'Invoice', value: 'INV-1' });
      expect(arg.meta).toContainEqual({ label: 'Billing Period', value: '2026-10' });
      expect(arg.meta).toContainEqual({
        label: 'Cash/Bank GL',
        value: '10101 - Cash in Hand',
      });
      expect(arg.meta).toContainEqual({ label: 'Collected By', value: 'Cashier' });
      expect(arg.rows).toEqual([['1', 'Tuition', '40101', '2000.00']]);
    });

    it('falls back to a single gross row when allocation is empty', async () => {
      prisma.paymentCollections.findUnique.mockResolvedValue(receiptRow());
      prisma.users.findUnique.mockResolvedValue({ id: 'u1', name: 'Cashier' });

      await service.moneyReceiptPdf('c1');

      expect(lastBuild().rows).toEqual([
        ['1', 'Tuition / fee collection', '10101', '2000.00'],
      ]);
    });

    it('adds the gateway TDR total only when the fee is positive', async () => {
      prisma.paymentCollections.findUnique.mockResolvedValue(
        receiptRow({ gatewayTdrFee: '150.00' }),
      );
      prisma.users.findUnique.mockResolvedValue({ id: 'u1', name: 'Cashier' });

      await service.moneyReceiptPdf('c1');

      expect(lastBuild().totals).toContainEqual({
        label: 'Less: Gateway TDR (54103)',
        value: '150.00 BDT',
      });
    });

    it('shows "-" for the collector when the user no longer exists', async () => {
      prisma.paymentCollections.findUnique.mockResolvedValue(receiptRow());
      prisma.users.findUnique.mockResolvedValue(null);

      await service.moneyReceiptPdf('c1');

      expect(lastBuild().meta).toContainEqual({ label: 'Collected By', value: '-' });
    });
  });

  describe('studentInvoicePdf', () => {
    it('throws NotFoundException when the invoice is missing', async () => {
      prisma.studentInvoices.findUnique.mockResolvedValue(null);
      await expect(service.studentInvoicePdf('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(pdf.buildDocument).not.toHaveBeenCalled();
    });

    it('maps fee-head/GL relations and computes the balance due', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(null);
      prisma.studentInvoices.findUnique.mockResolvedValue(invoiceRow());
      prisma.studentInvoiceLines.findMany.mockResolvedValue([lineRow()]);

      const out = await service.studentInvoicePdf('i1');

      expect(out.filename).toBe('INV-1.pdf');
      const arg = lastBuild();
      expect(arg.meta).toContainEqual({ label: 'Issue Date', value: '2026-04-01' });
      expect(arg.meta).toContainEqual({ label: 'Due Date', value: '2026-05-01' });
      expect(arg.rows).toEqual([
        ['1', 'Tuition Fee', '40101', '4000.00', '500.00', '3500.00'],
      ]);
      expect(arg.totals).toContainEqual({ label: 'Balance due', value: '3100.00 BDT' });
      expect(arg.notes).toEqual(['fixture']);
    });

    it('uses the fallback note when narration is empty', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(null);
      prisma.studentInvoices.findUnique.mockResolvedValue(invoiceRow({ narration: null }));
      prisma.studentInvoiceLines.findMany.mockResolvedValue([]);

      await service.studentInvoicePdf('i1');

      expect(lastBuild().notes).toHaveLength(1);
      expect(lastBuild().notes[0]).toMatch(/waivers never reduce/);
    });
  });

  describe('genericReportPdf', () => {
    it('slugifies the title and applies default signatures', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue({
        siteName: 'My School',
        phone: '123',
        email: 'a@b.c',
        eiin: '654321',
        tagline: null,
        address: null,
      });

      const out = await service.genericReportPdf({
        title: 'Trial Balance 2026',
        columns: [{ header: 'A', width: 1 }],
        rows: [['x']],
      });

      expect(out.filename).toMatch(/^trial-balance-2026-\d{4}-\d{2}-\d{2}\.pdf$/);
      const arg = lastBuild();
      expect(arg.schoolName).toBe('My School');
      expect(arg.contactLine).toBe('123  |  a@b.c  |  EIIN: 654321');
      expect(arg.signatures).toEqual(['Prepared By (Accountant)', 'Principal', 'Auditor']);
      expect(arg.columns).toEqual([{ header: 'A', width: 1, align: 'left' }]);
    });

    it('defaults the school name when site settings are absent', async () => {
      prisma.siteSettings.findFirst.mockResolvedValue(null);

      await service.genericReportPdf({
        title: 'Report',
        columns: [{ header: 'A', width: 1 }],
        rows: [],
      });

      expect(lastBuild().schoolName).toBe('My School');
    });
  });
});
