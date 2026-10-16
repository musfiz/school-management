import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Prisma as PrismaTypes } from '../generated/prisma/client';
import { toDateOnly, toDateValue } from '../prisma/wire';
import { WAIVER_DEFAULT_GL } from '../database/entities/student-waiver.entity';
import { JournalPostingService } from './journal-posting.service';
import type { JournalLineDto } from './vouchers.dto';
import {
  ApplyLateFineDto,
  BulkInvoiceDto,
  CreateCautionDepositDto,
  CreateFeeHeadDto,
  CreateInvoiceDto,
  CreateWaiverDto,
  InvoiceItemDto,
  SettleCautionDepositDto,
  UpdateFeeHeadDto,
  UpdateWaiverDto,
} from './billing.dto';

/* ---------------- relation includes + wire reshaping ---------------- */

const HEAD_INCLUDE = {
  chartOfAccounts: true,
  funds: true,
  costCenters: true,
} satisfies Prisma.FeeHeadsInclude;

const WAIVER_INCLUDE = {
  chartOfAccounts: true,
  funds: true,
} satisfies Prisma.StudentWaiversInclude;

/** detail include — `lines.feeHead`, `lines.glAccount`, `lines.fund`, `journalEntry`, `fiscalPeriod`. */
const INVOICE_INCLUDE = {
  studentInvoiceLines: {
    include: { feeHeads: true, chartOfAccounts: true, funds: true },
  },
  journalEntries: true,
  fiscalPeriods: true,
} satisfies Prisma.StudentInvoicesInclude;

const INVOICE_LIST_INCLUDE = {
  studentInvoiceLines: {
    include: { feeHeads: true, chartOfAccounts: true, funds: true },
  },
} satisfies Prisma.StudentInvoicesInclude;

const INVOICE_LEDGER_INCLUDE = {
  studentInvoiceLines: { include: { feeHeads: true, chartOfAccounts: true } },
  journalEntries: true,
} satisfies Prisma.StudentInvoicesInclude;

type HeadPayload = Prisma.FeeHeadsGetPayload<{ include: typeof HEAD_INCLUDE }>;
type WaiverPayload = Prisma.StudentWaiversGetPayload<{ include: typeof WAIVER_INCLUDE }>;
type InvoicePayload = Prisma.StudentInvoicesGetPayload<{ include: typeof INVOICE_INCLUDE }>;
type InvoiceListPayload = Prisma.StudentInvoicesGetPayload<{ include: typeof INVOICE_LIST_INCLUDE }>;
type InvoiceLedgerPayload = Prisma.StudentInvoicesGetPayload<{
  include: typeof INVOICE_LEDGER_INCLUDE;
}>;

function headToWire(h: HeadPayload) {
  const { chartOfAccounts, funds, costCenters, ...rest } = h;
  return { ...rest, revenueGl: chartOfAccounts, fund: funds, costCenter: costCenters };
}

function waiverToWire(w: WaiverPayload) {
  const { chartOfAccounts, funds, ...rest } = w;
  return { ...rest, contraGl: chartOfAccounts, fund: funds };
}

function lineToWire<T extends { feeHeads?: unknown; chartOfAccounts?: unknown; funds?: unknown }>(
  l: T,
) {
  const { feeHeads, chartOfAccounts, funds, ...rest } = l;
  return { ...rest, feeHead: feeHeads, glAccount: chartOfAccounts, fund: funds };
}

function invoiceToWire(inv: InvoicePayload | InvoiceListPayload) {
  const { studentInvoiceLines, ...rest } = inv as InvoicePayload;
  const extra = rest as Record<string, unknown>;
  return {
    ...extra,
    lines: (studentInvoiceLines ?? []).map(lineToWire),
  };
}

function ledgerInvoiceToWire(inv: InvoiceLedgerPayload) {
  const { studentInvoiceLines, journalEntries, ...rest } = inv;
  return {
    ...rest,
    journalEntry: journalEntries,
    lines: studentInvoiceLines.map(lineToWire),
  };
}

/** Recompute invoice status from paid vs. due (mirrors TypeORM `refreshStatus`). */
function refreshedStatus(
  current: string,
  net: Decimal.Value,
  fine: Decimal.Value,
  paid: Decimal.Value,
): string {
  const due = new Decimal(net).plus(new Decimal(fine));
  const p = new Decimal(paid);
  if (p.gte(due) && due.gt(0)) return 'PAID';
  if (p.gt(0)) return 'PARTIAL';
  if (current === 'PAID') return 'UNPAID';
  return current;
}

/**
 * Phase 3 — student billing, waivers, invoices & liability engine
 * (docs/AGENT_IMPLEMENTATION_PLAN.md Phase 3, spec §1.2–1.3).
 *
 * Gross-to-net waiver posting per invoice:
 *   Dr 11401 Student AR (STUDENT sub-ledger)      = net
 *   Dr 4190x Contra-Revenue (per waiver type)     = waiver
 *   Cr 4110x/4210x Fee Revenue (per head)         = gross
 *   Cr 2140x Caution liability (caution heads)    = gross (no waiver)
 * Every line's three legs share ONE fund so the Phase-2 per-fund
 * isolation rule always holds; 100% LILLAH boarding lines post wholly
 * in Fund 02 (spec §1.1 shariah isolation).
 *
 * AD-P5/AD-P7: repositories → `PrismaService`; the transaction handle is a
 * `Prisma.TransactionClient`; relation names are remapped to the legacy wire
 * shape (`revenueGl`, `contraGl`, `lines`, `journalEntry`, `fiscalPeriod`).
 */
@Injectable()
export class StudentBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: JournalPostingService,
  ) {}

  /* ================= fee heads ================= */

  async listHeads(activeOnly = false) {
    const heads = await this.prisma.feeHeads.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: HEAD_INCLUDE,
      orderBy: { headCode: 'asc' },
    });
    return heads.map(headToWire);
  }

  async createHead(dto: CreateFeeHeadDto) {
    const clash = await this.prisma.feeHeads.findFirst({ where: { headCode: dto.headCode } });
    if (clash) throw new BadRequestException(`Fee head "${dto.headCode}" already exists`);
    await this.assertRevenueGl(dto.revenueGlId, dto.isCautionDeposit ?? false);
    return this.prisma.feeHeads.create({
      data: {
        headCode: dto.headCode,
        headName: dto.headName,
        billingType: dto.billingType,
        defaultAmount: this.dec(dto.defaultAmount ?? '0', 'defaultAmount'),
        perCreditRate: this.dec(dto.perCreditRate ?? '0', 'perCreditRate'),
        revenueGlId: dto.revenueGlId,
        fundId: dto.fundId ?? null,
        costCenterId: dto.costCenterId ?? null,
        isCautionDeposit: dto.isCautionDeposit ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateHead(id: string, dto: UpdateFeeHeadDto) {
    const head = await this.prisma.feeHeads.findUnique({ where: { id } });
    if (!head) throw new NotFoundException(`Fee head #${id} not found`);
    if (dto.revenueGlId) {
      await this.assertRevenueGl(dto.revenueGlId, dto.isCautionDeposit ?? head.isCautionDeposit);
    }
    return this.prisma.feeHeads.update({
      where: { id },
      data: {
        ...(dto.headName !== undefined ? { headName: dto.headName } : {}),
        ...(dto.billingType !== undefined ? { billingType: dto.billingType } : {}),
        ...(dto.defaultAmount !== undefined
          ? { defaultAmount: this.dec(dto.defaultAmount, 'defaultAmount') }
          : {}),
        ...(dto.perCreditRate !== undefined
          ? { perCreditRate: this.dec(dto.perCreditRate, 'perCreditRate') }
          : {}),
        ...(dto.revenueGlId !== undefined ? { revenueGlId: dto.revenueGlId } : {}),
        ...(dto.fundId !== undefined ? { fundId: dto.fundId } : {}),
        ...(dto.costCenterId !== undefined ? { costCenterId: dto.costCenterId } : {}),
        ...(dto.isCautionDeposit !== undefined ? { isCautionDeposit: dto.isCautionDeposit } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /**
   * Delete a fee head — allowed ONLY when no invoice line references it
   * (`student_invoice_lines.fee_head_id`). Institutes tailor the catalogue
   * at setup time by deleting seeded heads they don't need; once a head
   * has billed even once it becomes immutable history (deactivate instead).
   */
  async deleteHead(id: string): Promise<{ deleted: true }> {
    const head = await this.prisma.feeHeads.findUnique({ where: { id } });
    if (!head) throw new NotFoundException(`Fee head #${id} not found`);
    const used = await this.prisma.studentInvoiceLines.count({ where: { feeHeadId: id } });
    if (used > 0) {
      throw new BadRequestException(
        `Cannot delete "${head.headCode}" — it is used by ${used} invoice line(s). Deactivate it instead (isActive=false).`,
      );
    }
    await this.prisma.feeHeads.delete({ where: { id } });
    return { deleted: true as const };
  }

  /** One-click seed of the standard BD fee catalogue mapped to the CoA. */
  async seedDefaults() {
    const gl = async (code: string): Promise<string> => {
      const acct = await this.prisma.chartOfAccounts.findFirst({ where: { glCode: code } });
      if (!acct) throw new BadRequestException(`Seed needs GL ${code} — run seed:accounting first`);
      return acct.id;
    };
    const fund = async (code: string): Promise<string | null> => {
      const f = await this.prisma.funds.findFirst({ where: { fundCode: code } });
      return f?.id ?? null;
    };
    const generalFund = await fund('01');
    const defs: Array<Omit<CreateFeeHeadDto, 'revenueGlId' | 'fundId'> & { gl: string }> = [
      { headCode: 'TUITION', headName: 'Monthly Tuition Fee', billingType: 'MONTHLY', defaultAmount: '2000.00', gl: '41101' },
      { headCode: 'ADMISSION', headName: 'Admission / Readmission Fee', billingType: 'ONE_TIME', defaultAmount: '5000.00', gl: '41102' },
      { headCode: 'SESSION', headName: 'Session / Annual Development Fee', billingType: 'TERM', defaultAmount: '8000.00', gl: '41103' },
      { headCode: 'EXAM', headName: 'Examination & Transcript Fee', billingType: 'TERM', defaultAmount: '1500.00', gl: '41104' },
      { headCode: 'LAB', headName: 'Lab / Computer / Library Fee', billingType: 'TERM', defaultAmount: '1200.00', gl: '41105' },
      { headCode: 'HOSTEL', headName: 'Hostel Seat Rent & Boarding', billingType: 'MONTHLY', defaultAmount: '3500.00', gl: '42101' },
      { headCode: 'TRANSPORT', headName: 'Student Transport Fee', billingType: 'MONTHLY', defaultAmount: '800.00', gl: '42102' },
      { headCode: 'CAUTION-LIB', headName: 'Library & Lab Caution Deposit', billingType: 'ONE_TIME', defaultAmount: '2000.00', gl: '21401', isCautionDeposit: true },
      { headCode: 'CAUTION-HOSTEL', headName: 'Hostel Security Deposit', billingType: 'ONE_TIME', defaultAmount: '5000.00', gl: '21402', isCautionDeposit: true },
    ];
    const out = [];
    for (const d of defs) {
      const existing = await this.prisma.feeHeads.findFirst({ where: { headCode: d.headCode } });
      if (existing) {
        out.push(existing);
        continue;
      }
      out.push(
        await this.createHead({
          headCode: d.headCode,
          headName: d.headName,
          billingType: d.billingType,
          defaultAmount: d.defaultAmount,
          revenueGlId: await gl(d.gl),
          fundId: generalFund,
          isCautionDeposit: d.isCautionDeposit ?? false,
        }),
      );
    }
    return out;
  }

  /* ================= waivers ================= */

  async listWaivers(studentId?: string) {
    const waivers = await this.prisma.studentWaivers.findMany({
      where: studentId ? { studentId } : undefined,
      include: WAIVER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return waivers.map(waiverToWire);
  }

  async createWaiver(dto: CreateWaiverDto) {
    if (dto.percent < 0 || dto.percent > 100) {
      throw new BadRequestException('Waiver percent must be 0–100');
    }
    if (dto.contraGlId) await this.assertContraGl(dto.contraGlId);
    if (dto.fixedCapAmount !== undefined && dto.fixedCapAmount !== null) {
      this.dec(dto.fixedCapAmount, 'fixedCapAmount');
    }
    return this.prisma.studentWaivers.create({
      data: {
        studentId: dto.studentId,
        waiverType: dto.waiverType,
        percent: new Decimal(dto.percent).toFixed(2),
        fixedCapAmount: dto.fixedCapAmount ?? null,
        contraGlId: dto.contraGlId ?? null,
        fundId: dto.fundId ?? null,
        activeFrom: dto.activeFrom ? toDateValue(dto.activeFrom.slice(0, 10)) : null,
        activeTo: dto.activeTo ? toDateValue(dto.activeTo.slice(0, 10)) : null,
        isActive: true,
        remark: dto.remark ?? null,
      },
    });
  }

  async updateWaiver(id: string, dto: UpdateWaiverDto) {
    const w = await this.prisma.studentWaivers.findUnique({ where: { id } });
    if (!w) throw new NotFoundException(`Waiver #${id} not found`);
    if (dto.percent !== undefined && (dto.percent < 0 || dto.percent > 100)) {
      throw new BadRequestException('Waiver percent must be 0–100');
    }
    if (dto.contraGlId) await this.assertContraGl(dto.contraGlId);
    return this.prisma.studentWaivers.update({
      where: { id },
      data: {
        ...(dto.percent !== undefined ? { percent: new Decimal(dto.percent).toFixed(2) } : {}),
        ...(dto.fixedCapAmount !== undefined ? { fixedCapAmount: dto.fixedCapAmount } : {}),
        ...(dto.contraGlId !== undefined ? { contraGlId: dto.contraGlId } : {}),
        ...(dto.fundId !== undefined ? { fundId: dto.fundId } : {}),
        ...(dto.activeFrom !== undefined
          ? { activeFrom: dto.activeFrom ? toDateValue(dto.activeFrom.slice(0, 10)) : null }
          : {}),
        ...(dto.activeTo !== undefined
          ? { activeTo: dto.activeTo ? toDateValue(dto.activeTo.slice(0, 10)) : null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      },
    });
  }

  /* ================= invoices ================= */

  async listInvoices(filters: { studentId?: string; status?: string; period?: string; limit?: number }) {
    const where: Prisma.StudentInvoicesWhereInput = {};
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.status) where.status = filters.status;
    if (filters.period) where.billingPeriod = filters.period;
    const invoices = await this.prisma.studentInvoices.findMany({
      where,
      include: INVOICE_LIST_INCLUDE,
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(filters.limit ?? 100, 1), 500),
    });
    return invoices.map(invoiceToWire);
  }

  findInvoice(id: string) {
    return this.findInvoiceIn(this.prisma, id);
  }

  createInvoice(dto: CreateInvoiceDto, actorId: string) {
    return this.prisma.$transaction(
      (tx) => this.buildInvoice(tx, dto.studentId, dto, actorId),
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /**
   * Workflow 4 entry: same build inside an OUTER (onboarding) transaction.
   * The caller owns atomicity — no nested transaction is opened here.
   */
  async createInvoiceIn(
    tx: PrismaTypes.TransactionClient,
    dto: CreateInvoiceDto,
    actorId: string,
  ) {
    return this.buildInvoice(tx, dto.studentId, dto, actorId);
  }

  async bulkGenerate(dto: BulkInvoiceDto, actorId: string) {
    const created = [];
    const skipped: Array<{ studentId: string; reason: string }> = [];
    for (const studentId of dto.studentIds) {
      try {
        const inv = await this.prisma.$transaction(
          (tx) =>
            this.buildInvoice(
              tx,
              studentId,
              {
                billingPeriod: dto.billingPeriod,
                issueDate: dto.issueDate,
                dueDate: dto.dueDate,
                costCenterId: dto.costCenterId,
                narration: dto.narration,
                items: dto.items,
              },
              actorId,
            ),
          { isolationLevel: 'RepeatableRead' },
        );
        created.push(inv);
      } catch (e) {
        skipped.push({
          studentId,
          reason: e instanceof Error ? e.message : 'Failed',
        });
      }
    }
    return { created: created.length, skipped, invoices: created };
  }

  /** Reverse an invoice: linked offsetting STUDENT_BILLING journal + REVERSED flag. */
  async reverseInvoice(id: string, actorId: string, reason: string) {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A reversal reason (min 3 chars) is required');
    }
    return this.prisma.$transaction(
      async (tx) => {
        const inv = await this.findInvoiceIn(tx, id);
        if (inv.status === 'REVERSED') throw new BadRequestException('Invoice already reversed');
        if (inv.paidAmount !== '0.00' && new Decimal(inv.paidAmount).gt(0)) {
          throw new BadRequestException(
            'Cannot reverse an invoice with collections — reverse the receipt vouchers first',
          );
        }
        const original = inv.journalEntryId
          ? await tx.journalEntries.findUnique({
              where: { id: inv.journalEntryId },
              include: { journalLines: true },
            })
          : null;
        if (original?.journalLines?.length) {
          await this.posting.postSystemJournal(tx, {
            voucherType: 'JOURNAL',
            transactionDate: new Date().toISOString().slice(0, 10),
            narration: `REVERSAL of ${inv.invoiceNo}: ${reason.trim()}`,
            sourceModule: 'STUDENT_BILLING',
            sourceReferenceId: inv.id,
            actorId,
            lines: original.journalLines.map((l) => ({
              glAccountId: l.glAccountId,
              fundId: l.fundId,
              costCenterId: l.costCenterId,
              subledgerType: l.subledgerType as JournalLineDto['subledgerType'],
              subledgerId: l.subledgerId,
              debitAmount: new Decimal(l.creditAmount).toFixed(2),
              creditAmount: new Decimal(l.debitAmount).toFixed(2),
              lineMemo: `Reversal ${inv.invoiceNo}`,
            })),
          });
        }
        await tx.studentInvoices.update({ where: { id }, data: { status: 'REVERSED' } });
        return this.findInvoiceIn(tx, id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Late-fine posting: Dr 11401 AR / Cr 42103 fine revenue (plan Phase 3.4). */
  async applyLateFine(id: string, dto: ApplyLateFineDto, actorId: string) {
    const fine = this.dec(dto.fineAmount, 'fineAmount');
    if (new Decimal(fine).lte(0)) throw new BadRequestException('Fine amount must be positive');
    return this.prisma.$transaction(
      async (tx) => {
        const inv = await this.findInvoiceIn(tx, id);
        if (inv.status === 'PAID' || inv.status === 'REVERSED') {
          throw new BadRequestException(`Cannot fine a ${inv.status} invoice`);
        }
        const ar = await this.glId(tx, '11401');
        const fineGl = await this.glId(tx, '42103');
        const fundId = await this.generalFundId(tx);
        const today = new Date().toISOString().slice(0, 10);
        await this.posting.postSystemJournal(tx, {
          voucherType: 'JOURNAL',
          transactionDate: today,
          narration: `Late fine ${inv.invoiceNo} — ${dto.memo ?? 'overdue'}`,
          sourceModule: 'STUDENT_BILLING',
          sourceReferenceId: inv.id,
          actorId,
          lines: [
            {
              glAccountId: ar, fundId, costCenterId: inv.costCenterId ?? null,
              subledgerType: 'STUDENT', subledgerId: inv.studentId,
              debitAmount: new Decimal(fine).toFixed(2), creditAmount: '0.00',
              lineMemo: `Late fine ${inv.invoiceNo}`,
            },
            {
              glAccountId: fineGl, fundId, costCenterId: inv.costCenterId ?? null,
              debitAmount: '0.00', creditAmount: new Decimal(fine).toFixed(2),
              lineMemo: `Late fine ${inv.invoiceNo}`,
            },
          ] as JournalLineDto[],
        });
        const lateFineAmount = new Decimal(inv.lateFineAmount).plus(new Decimal(fine)).toFixed(2);
        await tx.studentInvoices.update({
          where: { id },
          data: {
            lateFineAmount,
            ...(inv.status === 'UNPAID' ? { status: 'OVERDUE' } : {}),
          },
        });
        return this.findInvoiceIn(tx, id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Sweep all overdue UNPAID/PARTIAL invoices with a flat fine (cron + manual). */
  async lateFineSweep(actorId: string, flatFine = '200.00', asOf?: string) {
    const today = (asOf ?? new Date().toISOString()).slice(0, 10);
    const overdue = await this.prisma.studentInvoices.findMany({
      where: {
        dueDate: { lt: toDateValue(today) },
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
      },
    });
    let fined = 0;
    for (const inv of overdue) {
      try {
        await this.applyLateFine(inv.id, { fineAmount: flatFine, memo: `auto sweep ${today}` }, actorId);
        fined += 1;
      } catch {
        /* per-invoice failure must not stop the sweep */
      }
    }
    return { checked: overdue.length, fined, asOf: today };
  }

  /* ================= student ledger & dues ================= */

  async studentLedger(studentId: string) {
    const invoices = await this.prisma.studentInvoices.findMany({
      where: { studentId },
      include: INVOICE_LEDGER_INCLUDE,
      orderBy: { issueDate: 'asc' },
    });
    const cautions = await this.prisma.studentCautionDeposits.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
    });
    const d = (s: Decimal.Value) => new Decimal(s);
    const gross = invoices.reduce((t, i) => t.plus(d(i.grossAmount)), new Decimal(0));
    const waiver = invoices.reduce((t, i) => t.plus(d(i.waiverAmount)), new Decimal(0));
    const net = invoices.reduce((t, i) => t.plus(d(i.netAmount)), new Decimal(0));
    const fine = invoices.reduce((t, i) => t.plus(d(i.lateFineAmount)), new Decimal(0));
    const paid = invoices.reduce((t, i) => t.plus(d(i.paidAmount)), new Decimal(0));
    const cautionHeld = cautions
      .filter((c) => c.status === 'HELD')
      .reduce((t, c) => t.plus(d(c.amount)), new Decimal(0));
    return {
      studentId,
      invoices: invoices.map(ledgerInvoiceToWire),
      cautions,
      summary: {
        gross: gross.toFixed(2),
        waiver: waiver.toFixed(2),
        net: net.toFixed(2),
        lateFine: fine.toFixed(2),
        paid: paid.toFixed(2),
        /** AR balance = net + fines − paid (accrual basis). */
        receivable: net.plus(fine).minus(paid).toFixed(2),
        cautionHeld: cautionHeld.toFixed(2),
        openInvoices: invoices.filter((i) => !['PAID', 'REVERSED'].includes(i.status)).length,
      },
    };
  }

  /** Defaulter / aging buckets: 0–30 / 31–60 / 61–90 / 90+ days (plan Phase 7). */
  async duesAging(asOf?: string) {
    const today = (asOf ?? new Date().toISOString()).slice(0, 10);
    const open = await this.prisma.studentInvoices.findMany({
      where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
    });
    const buckets: {
      d0_30: typeof open;
      d31_60: typeof open;
      d61_90: typeof open;
      d90p: typeof open;
    } = { d0_30: [], d31_60: [], d61_90: [], d90p: [] };
    let totalDue = new Decimal(0);
    for (const inv of open) {
      const due = new Decimal(inv.netAmount)
        .plus(new Decimal(inv.lateFineAmount))
        .minus(new Decimal(inv.paidAmount));
      if (due.lte(0)) continue;
      totalDue = totalDue.plus(due);
      const days = Math.floor(
        (new Date(today).getTime() - new Date(toDateOnly(inv.dueDate)).getTime()) / 86400000,
      );
      if (days <= 30) buckets.d0_30.push(inv);
      else if (days <= 60) buckets.d31_60.push(inv);
      else if (days <= 90) buckets.d61_90.push(inv);
      else buckets.d90p.push(inv);
    }
    return {
      asOf: today,
      totalDue: totalDue.toFixed(2),
      counts: {
        '0-30': buckets.d0_30.length,
        '31-60': buckets.d31_60.length,
        '61-90': buckets.d61_90.length,
        '90+': buckets.d90p.length,
      },
      buckets,
    };
  }

  /* ================= caution deposits ================= */

  async listCautions(studentId?: string) {
    const cautions = await this.prisma.studentCautionDeposits.findMany({
      where: studentId ? { studentId } : undefined,
      include: { chartOfAccounts: true },
      orderBy: { createdAt: 'desc' },
    });
    return cautions.map(({ chartOfAccounts, ...rest }) => ({ ...rest, glAccount: chartOfAccounts }));
  }

  /** Collect a caution deposit: Dr Cash/Bank / Cr 2140x (STUDENT sub-ledger). */
  async collectCaution(dto: CreateCautionDepositDto, actorId: string) {
    const amount = this.dec(dto.amount, 'amount');
    if (new Decimal(amount).lte(0)) throw new BadRequestException('Caution amount must be positive');
    return this.prisma.$transaction(
      async (tx) => {
        const liability = await tx.chartOfAccounts.findUnique({ where: { id: dto.glAccountId } });
        if (!liability || !['21401', '21402'].includes(liability.glCode)) {
          throw new BadRequestException('Caution deposits must post to 21401 or 21402');
        }
        const cashGl = dto.cashGlId ?? (await this.glId(tx, '11101'));
        const fundId = dto.fundId ?? (await this.generalFundId(tx));
        const txnDate = (dto.transactionDate ?? new Date().toISOString()).slice(0, 10);
        const journal = await this.posting.postSystemJournal(tx, {
          voucherType: 'RECEIVE',
          transactionDate: txnDate,
          narration: `Caution deposit ${liability.glCode} — student ${dto.studentId.slice(0, 8)} (${amount})`,
          sourceModule: 'STUDENT_BILLING',
          actorId,
          lines: [
            {
              glAccountId: cashGl, fundId, costCenterId: dto.costCenterId ?? null,
              debitAmount: new Decimal(amount).toFixed(2), creditAmount: '0.00',
              lineMemo: 'Caution receipt',
            },
            {
              glAccountId: liability.id, fundId, costCenterId: dto.costCenterId ?? null,
              subledgerType: 'STUDENT', subledgerId: dto.studentId,
              debitAmount: '0.00', creditAmount: new Decimal(amount).toFixed(2),
              lineMemo: dto.remark ?? 'Caution held',
            },
          ] as JournalLineDto[],
        });
        return tx.studentCautionDeposits.create({
          data: {
            studentId: dto.studentId,
            glAccountId: liability.id,
            amount: new Decimal(amount).toFixed(2),
            status: 'HELD',
            receiptJournalId: journal.id,
            remark: dto.remark ?? null,
          },
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /**
   * Settle a held deposit: ADJUSTED (Dr 2140x / Cr 11401 + bumps invoice
   * paid_amount) or REFUNDED (Dr 2140x / Cr cash).
   */
  async settleCaution(id: string, dto: SettleCautionDepositDto, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.studentCautionDeposits.findUnique({ where: { id } });
        if (!row) throw new NotFoundException(`Caution deposit #${id} not found`);
        if (row.status !== 'HELD') throw new BadRequestException(`Deposit already ${row.status}`);
        const liability = await tx.chartOfAccounts.findUnique({ where: { id: row.glAccountId } });
        if (!liability) throw new BadRequestException('Caution GL not found');
        const fundId = dto.fundId ?? (await this.generalFundId(tx));
        const today = new Date().toISOString().slice(0, 10);
        let journal;
        if (dto.action === 'REFUNDED') {
          const cashGl = dto.cashGlId ?? (await this.glId(tx, '11101'));
          journal = await this.posting.postSystemJournal(tx, {
            voucherType: 'PAYMENT',
            transactionDate: today,
            narration: `Caution refund ${row.amount} — student ${row.studentId.slice(0, 8)}${dto.remark ? ` (${dto.remark})` : ''}`,
            sourceModule: 'STUDENT_BILLING',
            actorId,
            lines: [
              {
                glAccountId: liability.id, fundId, costCenterId: null,
                subledgerType: 'STUDENT', subledgerId: row.studentId,
                debitAmount: new Decimal(row.amount).toFixed(2), creditAmount: '0.00',
                lineMemo: 'Caution refund',
              },
              {
                glAccountId: cashGl, fundId, costCenterId: null,
                debitAmount: '0.00', creditAmount: new Decimal(row.amount).toFixed(2),
                lineMemo: 'Caution refund payout',
              },
            ] as JournalLineDto[],
          });
        } else {
          if (!dto.invoiceId) throw new BadRequestException('invoiceId is required to adjust against dues');
          const inv = await this.findInvoiceIn(tx, dto.invoiceId);
          if (inv.studentId !== row.studentId) {
            throw new BadRequestException('Deposit and invoice belong to different students');
          }
          const ar = await this.glId(tx, '11401');
          journal = await this.posting.postSystemJournal(tx, {
            voucherType: 'JOURNAL',
            transactionDate: today,
            narration: `Caution adjusted to ${inv.invoiceNo} (${row.amount})`,
            sourceModule: 'STUDENT_BILLING',
            sourceReferenceId: inv.id,
            actorId,
            lines: [
              {
                glAccountId: liability.id, fundId, costCenterId: inv.costCenterId ?? null,
                subledgerType: 'STUDENT', subledgerId: row.studentId,
                debitAmount: new Decimal(row.amount).toFixed(2), creditAmount: '0.00',
                lineMemo: `Adjust to ${inv.invoiceNo}`,
              },
              {
                glAccountId: ar, fundId, costCenterId: inv.costCenterId ?? null,
                subledgerType: 'STUDENT', subledgerId: row.studentId,
                debitAmount: '0.00', creditAmount: new Decimal(row.amount).toFixed(2),
                lineMemo: `Caution adjustment ${inv.invoiceNo}`,
              },
            ] as JournalLineDto[],
          });
          const paidAmount = Decimal.min(
            new Decimal(inv.paidAmount).plus(new Decimal(row.amount)),
            new Decimal(inv.netAmount).plus(new Decimal(inv.lateFineAmount)),
          ).toFixed(2);
          await tx.studentInvoices.update({
            where: { id: inv.id },
            data: {
              paidAmount,
              status: refreshedStatus(inv.status, inv.netAmount, inv.lateFineAmount, paidAmount),
            },
          });
        }
        return tx.studentCautionDeposits.update({
          where: { id },
          data: {
            status: dto.action,
            settlementJournalId: journal.id,
            ...(dto.remark ? { remark: dto.remark } : {}),
          },
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Advance tuition: Dr Cash / Cr 21201 (STUDENT sub-ledger) for future months. */
  async recordAdvance(
    studentId: string,
    amountRaw: string,
    actorId: string,
    opts?: { cashGlId?: string; fundId?: string; costCenterId?: string; transactionDate?: string; memo?: string },
  ) {
    const amount = this.dec(amountRaw, 'amount');
    if (new Decimal(amount).lte(0)) throw new BadRequestException('Advance amount must be positive');
    return this.prisma.$transaction(
      async (tx) => {
        const cashGl = opts?.cashGlId ?? (await this.glId(tx, '11101'));
        const advGl = await this.glId(tx, '21201');
        const fundId = opts?.fundId ?? (await this.generalFundId(tx));
        const txnDate = (opts?.transactionDate ?? new Date().toISOString()).slice(0, 10);
        return this.posting.postSystemJournal(tx, {
          voucherType: 'RECEIVE',
          transactionDate: txnDate,
          narration: opts?.memo ?? `Advance tuition — student ${studentId.slice(0, 8)} (${amount})`,
          sourceModule: 'STUDENT_BILLING',
          actorId,
          lines: [
            {
              glAccountId: cashGl, fundId, costCenterId: opts?.costCenterId ?? null,
              debitAmount: new Decimal(amount).toFixed(2), creditAmount: '0.00',
              lineMemo: 'Advance receipt',
            },
            {
              glAccountId: advGl, fundId, costCenterId: opts?.costCenterId ?? null,
              subledgerType: 'STUDENT', subledgerId: studentId,
              debitAmount: '0.00', creditAmount: new Decimal(amount).toFixed(2),
              lineMemo: 'Advance tuition held (21201)',
            },
          ] as JournalLineDto[],
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ================= internals ================= */

  private async buildInvoice(
    tx: PrismaTypes.TransactionClient,
    studentId: string,
    dto: {
      billingPeriod: string;
      issueDate: string;
      dueDate: string;
      costCenterId?: string | null;
      narration?: string | null;
      items: InvoiceItemDto[];
    },
    actorId: string,
  ) {
    if (!dto.items?.length) throw new BadRequestException('An invoice needs at least one fee head');
    const dup = await tx.studentInvoices.findFirst({
      where: { studentId, billingPeriod: dto.billingPeriod },
    });
    if (dup) {
      throw new BadRequestException(
        `Duplicate billing blocked: student already has invoice ${dup.invoiceNo} for period "${dto.billingPeriod}"`,
      );
    }
    const issueDay = dto.issueDate.slice(0, 10);
    const generalFund = await tx.funds.findFirst({ where: { fundCode: '01' } });
    if (!generalFund) throw new BadRequestException('Fund 01 (General) missing — run seed:accounting');
    const lillahFund = await tx.funds.findFirst({ where: { fundCode: '02' } });
    const arAcct = await tx.chartOfAccounts.findFirst({ where: { glCode: '11401' } });
    if (!arAcct) throw new BadRequestException('GL 11401 (Student AR) missing — run seed:accounting');

    const waivers = await tx.studentWaivers.findMany({ where: { studentId, isActive: true } });
    const activeWaivers = waivers.filter(
      (w) =>
        (!w.activeFrom || toDateOnly(w.activeFrom) <= issueDay) &&
        (!w.activeTo || toDateOnly(w.activeTo) >= issueDay) &&
        new Decimal(w.percent).gt(0),
    );
    const contraCache = new Map<string, { id: string }>();
    const contraOf = async (w: (typeof activeWaivers)[number]): Promise<{ id: string }> => {
      if (w.contraGlId) {
        const hit =
          contraCache.get(w.contraGlId) ??
          (await tx.chartOfAccounts.findUnique({ where: { id: w.contraGlId } }));
        if (!hit) throw new BadRequestException(`Waiver contra GL #${w.contraGlId} not found`);
        contraCache.set(w.contraGlId, hit);
        return hit;
      }
      const code = WAIVER_DEFAULT_GL[w.waiverType as keyof typeof WAIVER_DEFAULT_GL];
      const hit =
        contraCache.get(code) ?? (await tx.chartOfAccounts.findFirst({ where: { glCode: code } }));
      if (!hit) throw new BadRequestException(`Contra GL ${code} missing — run seed:accounting`);
      contraCache.set(code, hit);
      return hit;
    };

    // Per-line gross → waiver → net + fund attribution.
    const computed: Array<{
      head: { id: string; headCode: string; billingType: string; isCautionDeposit: boolean; costCenterId: string | null; fundId: string | null; revenueGlId: string };
      gross: Decimal; waiverTotal: Decimal; net: Decimal;
      fundId: string; glId: string; costCenterId: string | null;
      perWaiver: Array<{ waiver: { id: string }; amount: Decimal; contraId: string }>;
      creditHours: string; memo: string | null;
    }> = [];
    for (const item of dto.items) {
      const head = await tx.feeHeads.findUnique({ where: { id: item.feeHeadId } });
      if (!head) throw new BadRequestException(`Fee head #${item.feeHeadId} not found`);
      if (!head.isActive) throw new BadRequestException(`Fee head "${head.headCode}" is inactive`);
      const revenue = await tx.chartOfAccounts.findUnique({ where: { id: head.revenueGlId } });
      if (!revenue) throw new BadRequestException(`Revenue GL for "${head.headCode}" not found`);

      let gross: Decimal;
      let creditHours = '0.00';
      if (head.billingType === 'CREDIT_HOUR') {
        const hrs = new Decimal(item.creditHours ?? '0');
        if (hrs.lte(0)) throw new BadRequestException(`"${head.headCode}" needs creditHours > 0`);
        gross = hrs.times(new Decimal(head.perCreditRate));
        creditHours = hrs.toFixed(2);
      } else if (item.amount !== undefined) {
        gross = new Decimal(this.dec(item.amount, `amount(${head.headCode})`));
      } else {
        gross = new Decimal(head.defaultAmount);
      }
      if (gross.lte(0)) throw new BadRequestException(`"${head.headCode}" gross must be positive`);
      gross = gross.toDecimalPlaces(2);

      // Caution heads never take waivers (liability, not revenue).
      // Scoped admission waivers (Workflow 4 scope_billing_types) only hit
      // matching billing types; NULL scope = legacy apply-everywhere.
      let waiverTotal = new Decimal(0);
      const perWaiver: Array<{ waiver: { id: string }; amount: Decimal; contraId: string }> = [];
      if (!head.isCautionDeposit) {
        let remaining = gross;
        for (const w of activeWaivers) {
          if (
            w.scopeBillingTypes &&
            !w.scopeBillingTypes.split(',').map((s) => s.trim().toUpperCase()).includes(head.billingType)
          ) {
            continue;
          }
          if (remaining.lte(0)) break;
          let amt = gross.times(new Decimal(w.percent)).div(100).toDecimalPlaces(2);
          if (w.fixedCapAmount != null) amt = Decimal.min(amt, new Decimal(w.fixedCapAmount));
          amt = Decimal.min(amt, remaining);
          if (amt.lte(0)) continue;
          const contra = await contraOf(w);
          perWaiver.push({ waiver: { id: w.id }, amount: amt, contraId: contra.id });
          waiverTotal = waiverTotal.plus(amt);
          remaining = remaining.minus(amt);
        }
        waiverTotal = Decimal.min(waiverTotal, gross);
      }
      const net = gross.minus(waiverTotal);

      // Fund: 100% LILLAH lines live wholly in Fund 02; otherwise the head's
      // fund (fallback General). Single fund per line ⇒ per-fund zero-sum.
      const hasLillah100 = perWaiver.some((p) => {
        const w = activeWaivers.find((x) => x.id === p.waiver.id)!;
        return w.waiverType === 'LILLAH_ZAKAT_ORPHAN' && new Decimal(w.percent).gte(100);
      });
      const fundId = hasLillah100 && lillahFund ? lillahFund.id : (head.fundId ?? generalFund.id);

      computed.push({
        head,
        gross, waiverTotal, net, fundId,
        glId: revenue.id,
        costCenterId: item.costCenterId ?? head.costCenterId ?? dto.costCenterId ?? null,
        perWaiver, creditHours, memo: item.lineMemo ?? null,
      });
    }

    const totalGross = computed.reduce((t, c) => t.plus(c.gross), new Decimal(0));
    const totalWaiver = computed.reduce((t, c) => t.plus(c.waiverTotal), new Decimal(0));
    const totalNet = computed.reduce((t, c) => t.plus(c.net), new Decimal(0));
    if (totalGross.lte(0)) throw new BadRequestException('Invoice gross must be positive');

    // Journal legs grouped so every fund zero-sums on its own.
    const lines: JournalLineDto[] = [];
    const netByFund = new Map<string, Decimal>();
    for (const c of computed) {
      netByFund.set(c.fundId, (netByFund.get(c.fundId) ?? new Decimal(0)).plus(c.net));
    }
    for (const [fundId, net] of netByFund) {
      if (net.gt(0)) {
        lines.push({
          glAccountId: arAcct.id, fundId,
          costCenterId: dto.costCenterId ?? computed.find((c) => c.fundId === fundId)?.costCenterId ?? null,
          subledgerType: 'STUDENT', subledgerId: studentId,
          debitAmount: net.toFixed(2), creditAmount: '0.00',
          lineMemo: `AR ${dto.billingPeriod}`,
        });
      }
    }
    // Contra legs per (waiver GL × fund of the line).
    const contraByKey = new Map<string, { contraId: string; fundId: string; cc: string | null; amt: Decimal }>();
    for (const c of computed) {
      for (const p of c.perWaiver) {
        const key = `${p.contraId}|${c.fundId}`;
        const hit = contraByKey.get(key) ?? { contraId: p.contraId, fundId: c.fundId, cc: c.costCenterId, amt: new Decimal(0) };
        hit.amt = hit.amt.plus(p.amount);
        contraByKey.set(key, hit);
      }
    }
    for (const hit of contraByKey.values()) {
      lines.push({
        glAccountId: hit.contraId, fundId: hit.fundId, costCenterId: hit.cc,
        debitAmount: hit.amt.toFixed(2), creditAmount: '0.00',
        lineMemo: `Waiver ${dto.billingPeriod}`,
      });
    }
    // Revenue / liability legs per (GL × fund).
    const revByKey = new Map<string, { glId: string; fundId: string; cc: string | null; amt: Decimal; memo: string }>();
    for (const c of computed) {
      const key = `${c.glId}|${c.fundId}`;
      const hit = revByKey.get(key) ?? { glId: c.glId, fundId: c.fundId, cc: c.costCenterId, amt: new Decimal(0), memo: c.head.headCode };
      hit.amt = hit.amt.plus(c.gross);
      revByKey.set(key, hit);
    }
    for (const hit of revByKey.values()) {
      lines.push({
        glAccountId: hit.glId, fundId: hit.fundId, costCenterId: hit.cc,
        debitAmount: '0.00', creditAmount: hit.amt.toFixed(2),
        lineMemo: `${hit.memo} ${dto.billingPeriod}`,
      });
    }

    // Control accounts (AR 11401, caution liabilities 21401/21402, advances)
    // require a STUDENT sub-ledger on their leg — e.g. a caution-deposit head
    // credits 21402, which would otherwise be rejected by the posting engine.
    const controlIds = new Set(
      (await tx.chartOfAccounts.findMany({ where: { isControlAccount: true } })).map((a) => a.id),
    );
    for (const line of lines) {
      if (controlIds.has(line.glAccountId) && !line.subledgerId) {
        line.subledgerType = 'STUDENT';
        line.subledgerId = studentId;
      }
    }

    const journal = await this.posting.postSystemJournal(tx, {
      voucherType: 'JOURNAL',
      transactionDate: issueDay,
      narration:
        dto.narration ??
        `Tuition invoice ${dto.billingPeriod} — student ${studentId.slice(0, 8)} (gross ${totalGross.toFixed(2)}, waiver ${totalWaiver.toFixed(2)})`,
      sourceModule: 'STUDENT_BILLING',
      actorId,
      lines,
    });

    const invoiceNo = await this.nextInvoiceNo(tx, issueDay);
    const invoice = await tx.studentInvoices.create({
      data: {
        invoiceNo,
        studentId,
        billingPeriod: dto.billingPeriod,
        issueDate: toDateValue(dto.issueDate.slice(0, 10)),
        dueDate: toDateValue(dto.dueDate.slice(0, 10)),
        status: 'UNPAID',
        grossAmount: totalGross.toFixed(2),
        waiverAmount: totalWaiver.toFixed(2),
        netAmount: totalNet.toFixed(2),
        paidAmount: '0.00',
        lateFineAmount: '0.00',
        fiscalPeriodId: journal.fiscalPeriodId,
        journalEntryId: journal.id,
        costCenterId: dto.costCenterId ?? null,
        createdByUserId: actorId,
        narration: dto.narration ?? null,
      },
    });
    await tx.journalEntries.update({
      where: { id: journal.id },
      data: { sourceReferenceId: invoice.id },
    });
    await tx.studentInvoiceLines.createMany({
      data: computed.map((c) => ({
        invoiceId: invoice.id,
        feeHeadId: c.head.id,
        glAccountId: c.glId,
        fundId: c.fundId,
        costCenterId: c.costCenterId,
        creditHours: c.creditHours,
        grossAmount: c.gross.toFixed(2),
        waiverAmount: c.waiverTotal.toFixed(2),
        netAmount: c.net.toFixed(2),
        waiverId: c.perWaiver[0]?.waiver.id ?? null,
        lineMemo: c.memo,
      })),
    });
    return this.findInvoiceIn(tx, invoice.id);
  }

  private async findInvoiceIn(tx: PrismaTypes.TransactionClient, id: string) {
    const inv = await tx.studentInvoices.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!inv) throw new NotFoundException(`Invoice #${id} not found`);
    return invoiceToWire(inv);
  }

  private async nextInvoiceNo(tx: PrismaTypes.TransactionClient, issueDate: string): Promise<string> {
    const year = String(new Date(issueDate).getFullYear());
    const locked = () =>
      tx.$queryRaw<{ last_number: number }[]>(Prisma.sql`
        SELECT last_number FROM voucher_sequences
        WHERE fiscal_year = ${year} AND voucher_type = ${'INVOICE'} FOR UPDATE
      `);
    const row = (await locked())[0];
    let lastNumber: number;
    if (!row) {
      lastNumber = 1;
      await tx.voucherSequences.create({
        data: { fiscalYear: year, voucherType: 'INVOICE', lastNumber },
      });
    } else {
      lastNumber = row.last_number + 1;
      await tx.voucherSequences.update({
        where: { fiscalYear_voucherType: { fiscalYear: year, voucherType: 'INVOICE' } },
        data: { lastNumber },
      });
    }
    return `INV-${year}-${String(lastNumber).padStart(6, '0')}`;
  }

  private async glId(tx: PrismaTypes.TransactionClient, code: string): Promise<string> {
    const acct = await tx.chartOfAccounts.findFirst({ where: { glCode: code } });
    if (!acct) throw new BadRequestException(`GL ${code} missing — run seed:accounting`);
    return acct.id;
  }

  private async generalFundId(tx: PrismaTypes.TransactionClient): Promise<string> {
    const f = await tx.funds.findFirst({ where: { fundCode: '01' } });
    if (!f) throw new BadRequestException('Fund 01 (General) missing — run seed:accounting');
    return f.id;
  }

  private async assertRevenueGl(id: string, isCaution: boolean) {
    const acct = await this.prisma.chartOfAccounts.findUnique({ where: { id } });
    if (!acct) throw new BadRequestException(`GL account #${id} not found`);
    if (!acct.isActive) throw new BadRequestException(`${acct.glCode} is inactive`);
    if (isCaution) {
      if (!['21401', '21402'].includes(acct.glCode)) {
        throw new BadRequestException(`Caution heads must map to 21401/21402 (got ${acct.glCode})`);
      }
    } else if (!['REVENUE', 'LIABILITY'].includes(acct.accountType)) {
      throw new BadRequestException(`${acct.glCode} (${acct.accountType}) cannot book fee revenue`);
    }
    return acct;
  }

  private async assertContraGl(id: string): Promise<void> {
    const acct = await this.prisma.chartOfAccounts.findUnique({ where: { id } });
    if (!acct) throw new BadRequestException(`Contra GL #${id} not found`);
    if (acct.accountType !== 'CONTRA_REVENUE') {
      throw new BadRequestException(`${acct.glCode} is ${acct.accountType} — waiver GLs must be CONTRA_REVENUE (41901–41904)`);
    }
  }

  private dec(raw: unknown, tag: string): string {
    let d: Decimal;
    try {
      d = new Decimal(String(raw ?? '0').trim() === '' ? '0' : String(raw));
    } catch {
      throw new BadRequestException(`${tag} "${raw}" is not a valid decimal`);
    }
    if (!d.isFinite() || d.isNegative()) throw new BadRequestException(`${tag} must be a non-negative decimal`);
    if (d.dp() > 2) throw new BadRequestException(`${tag} allows at most 2 decimals`);
    return d.toFixed(2);
  }
}
