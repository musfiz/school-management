import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { FeeHead } from '../database/entities/fee-head.entity';
import {
  StudentWaiver,
  WAIVER_DEFAULT_GL,
} from '../database/entities/student-waiver.entity';
import { StudentInvoice } from '../database/entities/student-invoice.entity';
import { StudentInvoiceLine } from '../database/entities/student-invoice-line.entity';
import { StudentCautionDeposit } from '../database/entities/student-caution-deposit.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { Fund } from '../database/entities/fund.entity';
import { VoucherSequence } from '../database/entities/voucher-sequence.entity';
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
 */
@Injectable()
export class StudentBillingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly posting: JournalPostingService,
    @InjectRepository(FeeHead) private readonly heads: Repository<FeeHead>,
    @InjectRepository(StudentWaiver) private readonly waivers: Repository<StudentWaiver>,
    @InjectRepository(StudentInvoice) private readonly invoices: Repository<StudentInvoice>,
    @InjectRepository(StudentInvoiceLine)
    private readonly invLines: Repository<StudentInvoiceLine>,
    @InjectRepository(StudentCautionDeposit)
    private readonly cautions: Repository<StudentCautionDeposit>,
  ) {}

  /* ================= fee heads ================= */

  listHeads(activeOnly = false): Promise<FeeHead[]> {
    return this.heads.find({
      where: activeOnly ? { isActive: true } : undefined,
      relations: ['revenueGl', 'fund', 'costCenter'],
      order: { headCode: 'ASC' },
    });
  }

  async createHead(dto: CreateFeeHeadDto): Promise<FeeHead> {
    const clash = await this.heads.findOne({ where: { headCode: dto.headCode } });
    if (clash) throw new BadRequestException(`Fee head "${dto.headCode}" already exists`);
    await this.assertRevenueGl(dto.revenueGlId, dto.isCautionDeposit ?? false);
    return this.heads.save(
      this.heads.create({
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
      }),
    );
  }

  async updateHead(id: string, dto: UpdateFeeHeadDto): Promise<FeeHead> {
    const head = await this.heads.findOne({ where: { id } });
    if (!head) throw new NotFoundException(`Fee head #${id} not found`);
    if (dto.revenueGlId) {
      await this.assertRevenueGl(dto.revenueGlId, dto.isCautionDeposit ?? head.isCautionDeposit);
    }
    Object.assign(head, {
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
    });
    return this.heads.save(head);
  }

  /**
   * Delete a fee head — allowed ONLY when no invoice line references it
   * (`student_invoice_lines.fee_head_id`). Institutes tailor the catalogue
   * at setup time by deleting seeded heads they don't need; once a head
   * has billed even once it becomes immutable history (deactivate instead).
   */
  async deleteHead(id: string): Promise<{ deleted: true }> {
    const head = await this.heads.findOne({ where: { id } });
    if (!head) throw new NotFoundException(`Fee head #${id} not found`);
    const used = await this.dataSource
      .getRepository(StudentInvoiceLine)
      .count({ where: { feeHeadId: id } });
    if (used > 0) {
      throw new BadRequestException(
        `Cannot delete "${head.headCode}" — it is used by ${used} invoice line(s). Deactivate it instead (isActive=false).`,
      );
    }
    await this.heads.remove(head);
    return { deleted: true as const };
  }

  /** One-click seed of the standard BD fee catalogue mapped to the CoA. */
  async seedDefaults(): Promise<FeeHead[]> {
    const gl = async (code: string): Promise<string> => {
      const acct = await this.dataSource
        .getRepository(ChartOfAccount)
        .findOne({ where: { glCode: code } });
      if (!acct) throw new BadRequestException(`Seed needs GL ${code} — run seed:accounting first`);
      return acct.id;
    };
    const fund = async (code: string): Promise<string | null> => {
      const f = await this.dataSource.getRepository(Fund).findOne({ where: { fundCode: code } });
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
    const out: FeeHead[] = [];
    for (const d of defs) {
      const existing = await this.heads.findOne({ where: { headCode: d.headCode } });
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

  listWaivers(studentId?: string): Promise<StudentWaiver[]> {
    return this.waivers.find({
      where: studentId ? { studentId } : undefined,
      relations: ['contraGl', 'fund'],
      order: { createdAt: 'DESC' },
    });
  }

  async createWaiver(dto: CreateWaiverDto): Promise<StudentWaiver> {
    if (dto.percent < 0 || dto.percent > 100) {
      throw new BadRequestException('Waiver percent must be 0–100');
    }
    if (dto.contraGlId) await this.assertContraGl(dto.contraGlId);
    if (dto.fixedCapAmount !== undefined && dto.fixedCapAmount !== null) {
      this.dec(dto.fixedCapAmount, 'fixedCapAmount');
    }
    return this.waivers.save(
      this.waivers.create({
        studentId: dto.studentId,
        waiverType: dto.waiverType,
        percent: new Decimal(dto.percent).toFixed(2),
        fixedCapAmount: dto.fixedCapAmount ?? null,
        contraGlId: dto.contraGlId ?? null,
        fundId: dto.fundId ?? null,
        activeFrom: dto.activeFrom ?? null,
        activeTo: dto.activeTo ?? null,
        isActive: true,
        remark: dto.remark ?? null,
      }),
    );
  }

  async updateWaiver(id: string, dto: UpdateWaiverDto): Promise<StudentWaiver> {
    const w = await this.waivers.findOne({ where: { id } });
    if (!w) throw new NotFoundException(`Waiver #${id} not found`);
    if (dto.percent !== undefined && (dto.percent < 0 || dto.percent > 100)) {
      throw new BadRequestException('Waiver percent must be 0–100');
    }
    if (dto.contraGlId) await this.assertContraGl(dto.contraGlId);
    Object.assign(w, {
      ...(dto.percent !== undefined ? { percent: new Decimal(dto.percent).toFixed(2) } : {}),
      ...(dto.fixedCapAmount !== undefined ? { fixedCapAmount: dto.fixedCapAmount } : {}),
      ...(dto.contraGlId !== undefined ? { contraGlId: dto.contraGlId } : {}),
      ...(dto.fundId !== undefined ? { fundId: dto.fundId } : {}),
      ...(dto.activeFrom !== undefined ? { activeFrom: dto.activeFrom } : {}),
      ...(dto.activeTo !== undefined ? { activeTo: dto.activeTo } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    });
    return this.waivers.save(w);
  }

  /* ================= invoices ================= */

  listInvoices(filters: { studentId?: string; status?: string; period?: string; limit?: number }) {
    const qb = this.invoices
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.lines', 'lines')
      .leftJoinAndSelect('lines.feeHead', 'feeHead')
      .leftJoinAndSelect('lines.glAccount', 'glAccount')
      .leftJoinAndSelect('lines.fund', 'fund')
      .orderBy('inv.issueDate', 'DESC')
      .addOrderBy('inv.createdAt', 'DESC')
      .take(Math.min(Math.max(filters.limit ?? 100, 1), 500));
    if (filters.studentId) qb.andWhere('inv.studentId = :s', { s: filters.studentId });
    if (filters.status) qb.andWhere('inv.status = :st', { st: filters.status });
    if (filters.period) qb.andWhere('inv.billingPeriod = :p', { p: filters.period });
    return qb.getMany();
  }

  findInvoice(id: string): Promise<StudentInvoice> {
    return this.findInvoiceIn(this.dataSource.manager, id);
  }

  async createInvoice(dto: CreateInvoiceDto, actorId: string): Promise<StudentInvoice> {
    return this.dataSource.transaction('REPEATABLE READ', (m) =>
      this.buildInvoice(m, dto.studentId, dto, actorId),
    );
  }

  async bulkGenerate(dto: BulkInvoiceDto, actorId: string) {
    const created: StudentInvoice[] = [];
    const skipped: Array<{ studentId: string; reason: string }> = [];
    for (const studentId of dto.studentIds) {
      try {
        const inv = await this.dataSource.transaction('REPEATABLE READ', (m) =>
          this.buildInvoice(
            m,
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
  async reverseInvoice(id: string, actorId: string, reason: string): Promise<StudentInvoice> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A reversal reason (min 3 chars) is required');
    }
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const inv = await this.findInvoiceIn(m, id);
      if (inv.status === 'REVERSED') throw new BadRequestException('Invoice already reversed');
      if (inv.paidAmount !== '0.00' && new Decimal(inv.paidAmount).gt(0)) {
        throw new BadRequestException('Cannot reverse an invoice with collections — reverse the receipt vouchers first');
      }
      const original = inv.journalEntryId
        ? await m.getRepository(StudentInvoice).manager
            .getRepository((await import('../database/entities/journal-entry.entity')).JournalEntry)
            .findOne({ where: { id: inv.journalEntryId }, relations: ['lines'] })
        : null;
      if (original?.lines) {
        await this.posting.postSystemJournal(m, {
          voucherType: 'JOURNAL',
          transactionDate: new Date().toISOString().slice(0, 10),
          narration: `REVERSAL of ${inv.invoiceNo}: ${reason.trim()}`,
          sourceModule: 'STUDENT_BILLING',
          sourceReferenceId: inv.id,
          actorId,
          lines: original.lines.map((l) => ({
            glAccountId: l.glAccountId,
            fundId: l.fundId,
            costCenterId: l.costCenterId,
            subledgerType: l.subledgerType,
            subledgerId: l.subledgerId,
            debitAmount: new Decimal(l.creditAmount).toFixed(2),
            creditAmount: new Decimal(l.debitAmount).toFixed(2),
            lineMemo: `Reversal ${inv.invoiceNo}`,
          })),
        });
      }
      inv.status = 'REVERSED';
      await m.getRepository(StudentInvoice).save(inv);
      return this.findInvoiceIn(m, id);
    });
  }

  /** Late-fine posting: Dr 11401 AR / Cr 42103 fine revenue (plan Phase 3.4). */
  async applyLateFine(id: string, dto: ApplyLateFineDto, actorId: string): Promise<StudentInvoice> {
    const fine = this.dec(dto.fineAmount, 'fineAmount');
    if (new Decimal(fine).lte(0)) throw new BadRequestException('Fine amount must be positive');
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const inv = await this.findInvoiceIn(m, id);
      if (inv.status === 'PAID' || inv.status === 'REVERSED') {
        throw new BadRequestException(`Cannot fine a ${inv.status} invoice`);
      }
      const ar = await this.glId(m, '11401');
      const fineGl = await this.glId(m, '42103');
      const fundId = await this.generalFundId(m);
      const today = new Date().toISOString().slice(0, 10);
      await this.posting.postSystemJournal(m, {
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
      inv.lateFineAmount = new Decimal(inv.lateFineAmount).plus(new Decimal(fine)).toFixed(2);
      if (inv.status === 'UNPAID') inv.status = 'OVERDUE';
      await m.getRepository(StudentInvoice).save(inv);
      return this.findInvoiceIn(m, id);
    });
  }

  /** Sweep all overdue UNPAID/PARTIAL invoices with a flat fine (cron + manual). */
  async lateFineSweep(actorId: string, flatFine = '200.00', asOf?: string) {
    const today = (asOf ?? new Date().toISOString()).slice(0, 10);
    const overdue = await this.invoices
      .createQueryBuilder('inv')
      .where('inv.dueDate < :today', { today })
      .andWhere('inv.status IN (:...st)', { st: ['UNPAID', 'PARTIAL', 'OVERDUE'] })
      .getMany();
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
    const invoices = await this.invoices.find({
      where: { studentId },
      relations: ['lines', 'lines.feeHead', 'lines.glAccount', 'journalEntry'],
      order: { issueDate: 'ASC' },
    });
    const cautions = await this.cautions.find({ where: { studentId }, order: { createdAt: 'ASC' } });
    const d = (s: string) => new Decimal(s);
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
      invoices,
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
    const open = await this.invoices
      .createQueryBuilder('inv')
      .where('inv.status IN (:...st)', { st: ['UNPAID', 'PARTIAL', 'OVERDUE'] })
      .orderBy('inv.dueDate', 'ASC')
      .getMany();
    const buckets = { d0_30: [] as StudentInvoice[], d31_60: [] as StudentInvoice[], d61_90: [] as StudentInvoice[], d90p: [] as StudentInvoice[] };
    let totalDue = new Decimal(0);
    for (const inv of open) {
      const due = new Decimal(inv.netAmount).plus(new Decimal(inv.lateFineAmount)).minus(new Decimal(inv.paidAmount));
      if (due.lte(0)) continue;
      totalDue = totalDue.plus(due);
      const days = Math.floor((new Date(today).getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      if (days <= 30) buckets.d0_30.push(inv);
      else if (days <= 60) buckets.d31_60.push(inv);
      else if (days <= 90) buckets.d61_90.push(inv);
      else buckets.d90p.push(inv);
    }
    return {
      asOf: today,
      totalDue: totalDue.toFixed(2),
      counts: { '0-30': buckets.d0_30.length, '31-60': buckets.d31_60.length, '61-90': buckets.d61_90.length, '90+': buckets.d90p.length },
      buckets,
    };
  }

  /* ================= caution deposits ================= */

  listCautions(studentId?: string): Promise<StudentCautionDeposit[]> {
    return this.cautions.find({
      where: studentId ? { studentId } : undefined,
      relations: ['glAccount'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Collect a caution deposit: Dr Cash/Bank / Cr 2140x (STUDENT sub-ledger). */
  async collectCaution(dto: CreateCautionDepositDto, actorId: string): Promise<StudentCautionDeposit> {
    const amount = this.dec(dto.amount, 'amount');
    if (new Decimal(amount).lte(0)) throw new BadRequestException('Caution amount must be positive');
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const glRepo = m.getRepository(ChartOfAccount);
      const liability = await glRepo.findOne({ where: { id: dto.glAccountId } });
      if (!liability || !['21401', '21402'].includes(liability.glCode)) {
        throw new BadRequestException('Caution deposits must post to 21401 or 21402');
      }
      const cashGl = dto.cashGlId ?? (await this.glId(m, '11101'));
      const fundId = dto.fundId ?? (await this.generalFundId(m));
      const txnDate = (dto.transactionDate ?? new Date().toISOString()).slice(0, 10);
      const journal = await this.posting.postSystemJournal(m, {
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
      const row = await m.getRepository(StudentCautionDeposit).save(
        m.getRepository(StudentCautionDeposit).create({
          studentId: dto.studentId,
          glAccountId: liability.id,
          amount: new Decimal(amount).toFixed(2),
          status: 'HELD',
          receiptJournalId: journal.id,
          remark: dto.remark ?? null,
        }),
      );
      return row;
    });
  }

  /**
   * Settle a held deposit: ADJUSTED (Dr 2140x / Cr 11401 + bumps invoice
   * paid_amount) or REFUNDED (Dr 2140x / Cr cash).
   */
  async settleCaution(id: string, dto: SettleCautionDepositDto, actorId: string) {
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const repo = m.getRepository(StudentCautionDeposit);
      const row = await repo.findOne({ where: { id } });
      if (!row) throw new NotFoundException(`Caution deposit #${id} not found`);
      if (row.status !== 'HELD') throw new BadRequestException(`Deposit already ${row.status}`);
      const glRepo = m.getRepository(ChartOfAccount);
      const liability = await glRepo.findOne({ where: { id: row.glAccountId } });
      if (!liability) throw new BadRequestException('Caution GL not found');
      const fundId = dto.fundId ?? (await this.generalFundId(m));
      const today = new Date().toISOString().slice(0, 10);
      let journal;
      if (dto.action === 'REFUNDED') {
        const cashGl = dto.cashGlId ?? (await this.glId(m, '11101'));
        journal = await this.posting.postSystemJournal(m, {
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
        const inv = await this.findInvoiceIn(m, dto.invoiceId);
        if (inv.studentId !== row.studentId) {
          throw new BadRequestException('Deposit and invoice belong to different students');
        }
        const ar = await this.glId(m, '11401');
        journal = await this.posting.postSystemJournal(m, {
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
        inv.paidAmount = Decimal.min(
          new Decimal(inv.paidAmount).plus(new Decimal(row.amount)),
          new Decimal(inv.netAmount).plus(new Decimal(inv.lateFineAmount)),
        ).toFixed(2);
        this.refreshStatus(inv);
        await m.getRepository(StudentInvoice).save(inv);
      }
      row.status = dto.action;
      row.settlementJournalId = journal.id;
      if (dto.remark) row.remark = dto.remark;
      return repo.save(row);
    });
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
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const cashGl = opts?.cashGlId ?? (await this.glId(m, '11101'));
      const advGl = await this.glId(m, '21201');
      const fundId = opts?.fundId ?? (await this.generalFundId(m));
      const txnDate = (opts?.transactionDate ?? new Date().toISOString()).slice(0, 10);
      return this.posting.postSystemJournal(m, {
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
    });
  }

  /* ================= internals ================= */

  private async buildInvoice(
    m: EntityManager,
    studentId: string,
    dto: { billingPeriod: string; issueDate: string; dueDate: string; costCenterId?: string | null; narration?: string | null; items: InvoiceItemDto[] },
    actorId: string,
  ): Promise<StudentInvoice> {
    if (!dto.items?.length) throw new BadRequestException('An invoice needs at least one fee head');
    const dup = await m.getRepository(StudentInvoice).findOne({
      where: { studentId, billingPeriod: dto.billingPeriod },
    });
    if (dup) {
      throw new BadRequestException(
        `Duplicate billing blocked: student already has invoice ${dup.invoiceNo} for period "${dto.billingPeriod}"`,
      );
    }
    const issueDay = dto.issueDate.slice(0, 10);
    const headRepo = m.getRepository(FeeHead);
    const glRepo = m.getRepository(ChartOfAccount);
    const fundRepo = m.getRepository(Fund);
    const generalFund = await fundRepo.findOne({ where: { fundCode: '01' } });
    if (!generalFund) throw new BadRequestException('Fund 01 (General) missing — run seed:accounting');
    const lillahFund = await fundRepo.findOne({ where: { fundCode: '02' } });
    const arAcct = await glRepo.findOne({ where: { glCode: '11401' } });
    if (!arAcct) throw new BadRequestException('GL 11401 (Student AR) missing — run seed:accounting');

    const waivers = await m.getRepository(StudentWaiver).find({ where: { studentId, isActive: true } });
    const activeWaivers = waivers.filter(
      (w) =>
        (!w.activeFrom || w.activeFrom.slice(0, 10) <= issueDay) &&
        (!w.activeTo || w.activeTo.slice(0, 10) >= issueDay) &&
        new Decimal(w.percent).gt(0),
    );
    const contraCache = new Map<string, ChartOfAccount>();
    const contraOf = async (w: StudentWaiver): Promise<ChartOfAccount> => {
      if (w.contraGlId) {
        const hit = contraCache.get(w.contraGlId) ?? (await glRepo.findOne({ where: { id: w.contraGlId } }));
        if (!hit) throw new BadRequestException(`Waiver contra GL #${w.contraGlId} not found`);
        contraCache.set(w.contraGlId, hit);
        return hit;
      }
      const code = WAIVER_DEFAULT_GL[w.waiverType];
      const hit = contraCache.get(code) ?? (await glRepo.findOne({ where: { glCode: code } }));
      if (!hit) throw new BadRequestException(`Contra GL ${code} missing — run seed:accounting`);
      contraCache.set(code, hit);
      return hit;
    };

    // Per-line gross → waiver → net + fund attribution.
    const computed: Array<{
      head: FeeHead; gross: Decimal; waiverTotal: Decimal; net: Decimal;
      fundId: string; glId: string; costCenterId: string | null;
      perWaiver: Array<{ waiver: StudentWaiver; amount: Decimal; contraId: string }>;
      creditHours: string; memo: string | null;
    }> = [];
    for (const item of dto.items) {
      const head = await headRepo.findOne({ where: { id: item.feeHeadId } });
      if (!head) throw new BadRequestException(`Fee head #${item.feeHeadId} not found`);
      if (!head.isActive) throw new BadRequestException(`Fee head "${head.headCode}" is inactive`);
      const revenue = await glRepo.findOne({ where: { id: head.revenueGlId } });
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
      let waiverTotal = new Decimal(0);
      const perWaiver: Array<{ waiver: StudentWaiver; amount: Decimal; contraId: string }> = [];
      if (!head.isCautionDeposit) {
        let remaining = gross;
        for (const w of activeWaivers) {
          if (remaining.lte(0)) break;
          let amt = gross.times(new Decimal(w.percent)).div(100).toDecimalPlaces(2);
          if (w.fixedCapAmount != null) amt = Decimal.min(amt, new Decimal(w.fixedCapAmount));
          amt = Decimal.min(amt, remaining);
          if (amt.lte(0)) continue;
          const contra = await contraOf(w);
          perWaiver.push({ waiver: w, amount: amt, contraId: contra.id });
          waiverTotal = waiverTotal.plus(amt);
          remaining = remaining.minus(amt);
        }
        waiverTotal = Decimal.min(waiverTotal, gross);
      }
      const net = gross.minus(waiverTotal);

      // Fund: 100% LILLAH lines live wholly in Fund 02; otherwise the head's
      // fund (fallback General). Single fund per line ⇒ per-fund zero-sum.
      const hasLillah100 = perWaiver.some(
        (p) => p.waiver.waiverType === 'LILLAH_ZAKAT_ORPHAN' && new Decimal(p.waiver.percent).gte(100),
      );
      const fundId =
        hasLillah100 && lillahFund ? lillahFund.id : (head.fundId ?? generalFund.id);

      computed.push({
        head, gross, waiverTotal, net, fundId,
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

    const journal = await this.posting.postSystemJournal(m, {
      voucherType: 'JOURNAL',
      transactionDate: issueDay,
      narration:
        dto.narration ??
        `Tuition invoice ${dto.billingPeriod} — student ${studentId.slice(0, 8)} (gross ${totalGross.toFixed(2)}, waiver ${totalWaiver.toFixed(2)})`,
      sourceModule: 'STUDENT_BILLING',
      actorId,
      lines,
    });

    const invoiceNo = await this.nextInvoiceNo(m, issueDay);
    const invoice = await m.getRepository(StudentInvoice).save(
      m.getRepository(StudentInvoice).create({
        invoiceNo,
        studentId,
        billingPeriod: dto.billingPeriod,
        issueDate: dto.issueDate.slice(0, 10),
        dueDate: dto.dueDate.slice(0, 10),
        status: 'UNPAID',
        grossAmount: totalGross.toFixed(2),
        waiverAmount: totalWaiver.toFixed(2),
        netAmount: totalNet.toFixed(2),
        paidAmount: '0.00',
        lateFineAmount: '0.00',
        fiscalPeriodId: (journal as { fiscalPeriodId: string }).fiscalPeriodId,
        journalEntryId: journal.id,
        costCenterId: dto.costCenterId ?? null,
        createdByUserId: actorId,
        narration: dto.narration ?? null,
      }),
    );
    journal.sourceReferenceId = invoice.id;
    await m.getRepository((await import('../database/entities/journal-entry.entity')).JournalEntry).save(journal);
    await m.getRepository(StudentInvoiceLine).save(
      computed.map((c) =>
        m.getRepository(StudentInvoiceLine).create({
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
        }),
      ),
    );
    return this.findInvoiceIn(m, invoice.id);
  }

  private async findInvoiceIn(m: EntityManager, id: string): Promise<StudentInvoice> {
    const inv = await m.getRepository(StudentInvoice).findOne({
      where: { id },
      relations: ['lines', 'lines.feeHead', 'lines.glAccount', 'lines.fund', 'journalEntry', 'fiscalPeriod'],
    });
    if (!inv) throw new NotFoundException(`Invoice #${id} not found`);
    return inv;
  }

  private async nextInvoiceNo(m: EntityManager, issueDate: string): Promise<string> {
    const year = String(new Date(issueDate).getFullYear());
    const repo = m.getRepository(VoucherSequence);
    let seq = await repo
      .createQueryBuilder('s')
      .setLock('pessimistic_write')
      .where('s.fiscalYear = :y', { y: year })
      .andWhere('s.voucherType = :t', { t: 'INVOICE' })
      .getOne();
    if (!seq) seq = repo.create({ fiscalYear: year, voucherType: 'INVOICE', lastNumber: 0 });
    seq.lastNumber += 1;
    await repo.save(seq);
    return `INV-${year}-${String(seq.lastNumber).padStart(6, '0')}`;
  }

  private async glId(m: EntityManager, code: string): Promise<string> {
    const acct = await m.getRepository(ChartOfAccount).findOne({ where: { glCode: code } });
    if (!acct) throw new BadRequestException(`GL ${code} missing — run seed:accounting`);
    return acct.id;
  }

  private async generalFundId(m: EntityManager): Promise<string> {
    const f = await m.getRepository(Fund).findOne({ where: { fundCode: '01' } });
    if (!f) throw new BadRequestException('Fund 01 (General) missing — run seed:accounting');
    return f.id;
  }

  private async assertRevenueGl(id: string, isCaution: boolean): Promise<ChartOfAccount> {
    const acct = await this.dataSource.getRepository(ChartOfAccount).findOne({ where: { id } });
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
    const acct = await this.dataSource.getRepository(ChartOfAccount).findOne({ where: { id } });
    if (!acct) throw new BadRequestException(`Contra GL #${id} not found`);
    if (acct.accountType !== 'CONTRA_REVENUE') {
      throw new BadRequestException(`${acct.glCode} is ${acct.accountType} — waiver GLs must be CONTRA_REVENUE (41901–41904)`);
    }
  }

  private refreshStatus(inv: StudentInvoice): void {
    const due = new Decimal(inv.netAmount).plus(new Decimal(inv.lateFineAmount));
    const paid = new Decimal(inv.paidAmount);
    if (paid.gte(due) && due.gt(0)) inv.status = 'PAID';
    else if (paid.gt(0)) inv.status = 'PARTIAL';
    else if (inv.status === 'PAID') inv.status = 'UNPAID';
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
