import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Prisma as PrismaTypes } from '../generated/prisma/client';
import {
  PAYROLL_RUN_STATUSES,
} from '../database/entities/payroll-run.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { Fund } from '../database/entities/fund.entity';
import { CostCenter } from '../database/entities/cost-center.entity';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import type { SubledgerType } from '../database/entities/journal-line.entity';
import { JournalPostingService } from './journal-posting.service';
import type { JournalLineDto } from './vouchers.dto';
import type {
  AddPayslipDto,
  CreateHonorariumDto,
  CreatePayrollRunDto,
  PayHonorariumDto,
  PayPayrollRunDto,
} from './payroll.dto';

/**
 * Phase 6 — payroll, MPO split, adjunct honorarium & PF
 * (docs/AGENT_IMPLEMENTATION_PLAN.md Phase 6, spec §1.4).*
 *
 * MPO ISOLATION (acceptance): `mpoGovtAmount` is stored per payslip and
 * summed on the run for display/tax reporting, but approve() builds its
 * journal ONLY from institutional columns — government EFT money can
 * never leak into institutional cash/bank liability.
 *
 * Run approval (JOURNAL, one fund):
 *   Dr 51101 Institutional salary           = Σ institutional gross
 *   Dr 51104 Employer PF matching          = Σ employer PF
 *   Cr 22101 PF liability                  = Σ (employee + employer PF)
 *   Cr 21301 TDS (AIT) – Staff             = Σ AIT
 *   Cr 11403 Staff advances/loans (EMPLOYEE) = per-employee loans
 *   Cr 21102 Salaries payable (EMPLOYEE)     = per-employee net
 *
 * Honorarium approval:
 *   Dr 51103 / Cr 21103 (net) + Cr 21303 (10–15% TDS).
 */
@Injectable()
export class PayrollAccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: JournalPostingService,
  ) {}

  /* ================= salary runs ================= */

  listRuns(limit = 100) {
    return this.prisma.payrollRuns.findMany({
      include: {
        funds: true,
        costCenters: true,
        journalEntriesPayrollRunsGlJournalIdTojournalEntries: true,
        journalEntriesPayrollRunsPaymentJournalIdTojournalEntries: true,
        payslipLines: true,
      },
      orderBy: [{ payrollMonth: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  findRun(id: string) {
    return this.findRunIn(this.prisma, id);
  }

  async createRun(dto: CreatePayrollRunDto, actorId: string) {
    const fund = await this.prisma.funds.findUnique({ where: { id: dto.fundId } });
    if (!fund) throw new NotFoundException('Fund not found');
    let costCenter: { id: string } | null = null;
    if (dto.costCenterId) {
      costCenter = await this.prisma.costCenters.findUnique({ where: { id: dto.costCenterId } });
      if (!costCenter) throw new NotFoundException('Cost center not found');
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const runNo = await this.nextRunNo(dto.payrollMonth);
      try {
        return await this.prisma.payrollRuns.create({
          data: {
            runNo,
            payrollMonth: dto.payrollMonth,
            payDate: dto.payDate.slice(0, 10),
            fundId: fund.id,
            costCenterId: costCenter?.id ?? null,
            status: 'DRAFT',
            narration: dto.narration?.trim() || null,
            createdByUserId: actorId,
          },
        });
      } catch (e: any) {
        if (String(e?.code) === 'ER_DUP_ENTRY' && attempt < 2) continue;
        throw e;
      }
    }
    throw new BadRequestException('Could not allocate a run number — retry');
  }

  /** Add one payslip to a DRAFT run (net computed server-side). */
  async addPayslip(runId: string, dto: AddPayslipDto) {
    const run = await this.findRun(runId);
    if (run.status !== 'DRAFT') throw new BadRequestException(`Run is ${run.status} — payslips locked`);
    const mpo = this.money(dto.mpoGovtAmount ?? '0', 'mpoGovtAmount');
    const gross = this.money(dto.institutionalGrossAmount, 'institutionalGrossAmount', { min: '0.01' });
    const pfEmp = this.money(dto.pfEmployeeDeduction ?? '0', 'pfEmployeeDeduction');
    const pfEr = this.money(dto.pfEmployerContribution ?? '0', 'pfEmployerContribution');
    const ait = this.money(dto.aitTdsDeduction ?? '0', 'aitTdsDeduction');
    const loan = this.money(dto.loanDeduction ?? '0', 'loanDeduction');
    const deductions = pfEmp.plus(ait).plus(loan);
    if (deductions.gt(gross)) {
      throw new BadRequestException(
        `Deductions ${deductions.toFixed(2)} exceed institutional gross ${gross.toFixed(2)}`,
      );
    }
    const net = gross.minus(deductions);
    const dup = await this.prisma.payslipLines.findFirst({
      where: { runId: run.id, employeeName: dto.employeeName.trim() },
    });
    if (dup) throw new BadRequestException(`"${dto.employeeName.trim()}" already has a payslip in ${run.runNo}`);
    const slip = await this.prisma.payslipLines.create({
      data: {
        runId: run.id,
        employeeId: dto.employeeId ?? null,
        employeeName: dto.employeeName.trim(),
        designation: dto.designation?.trim() || null,
        mpoGovtAmount: mpo.toFixed(2),
        institutionalGrossAmount: gross.toFixed(2),
        pfEmployeeDeduction: pfEmp.toFixed(2),
        pfEmployerContribution: pfEr.toFixed(2),
        aitTdsDeduction: ait.toFixed(2),
        loanDeduction: loan.toFixed(2),
        netInstitutionalPayable: net.toFixed(2),
      },
    });
    await this.refreshRunTotals(run.id);
    return slip;
  }

  async removePayslip(runId: string, slipId: string) {
    const run = await this.findRun(runId);
    if (run.status !== 'DRAFT') throw new BadRequestException(`Run is ${run.status} — payslips locked`);
    const slip = await this.prisma.payslipLines.findFirst({ where: { id: slipId, runId: run.id } });
    if (!slip) throw new NotFoundException('Payslip not found in this run');
    await this.prisma.payslipLines.delete({ where: { id: slipId } });
    await this.refreshRunTotals(run.id);
    return { deleted: true };
  }

  /** Approve a DRAFT run and post the institutional-only journal. */
  approveRun(id: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const run = await this.findRunIn(tx, id);
        if (run.status !== 'DRAFT') throw new BadRequestException(`Only DRAFT runs can be approved (now ${run.status})`);
        if ((run.payslipLines ?? []).length === 0) throw new BadRequestException('Run has no payslips');
        const sum = (pick: (l: any) => string) =>
          (run.payslipLines ?? []).reduce((t, l) => t.plus(new Decimal(pick(l))), new Decimal(0));
        // NOTE: mpoGovtAmount is deliberately never read here.
        const gross = sum((l) => l.institutionalGrossAmount);
        const pfEmp = sum((l) => l.pfEmployeeDeduction);
        const pfEr = sum((l) => l.pfEmployerContribution);
        const ait = sum((l) => l.aitTdsDeduction);
        const pfTotal = pfEmp.plus(pfEr);

        const lines: JournalLineDto[] = [];
        const glCache = new Map<string, string>();
        const glId = async (code: string): Promise<string> => {
          const hit = glCache.get(code);
          if (hit) return hit;
          const acct = await tx.chartOfAccounts.findUnique({ where: { glCode: code } });
          if (!acct) throw new BadRequestException(`GL ${code} missing — run seed:accounting`);
          glCache.set(code, acct.id);
          return acct.id;
        };
        const leg = async (
          glCode: string,
          side: 'dr' | 'cr',
          amt: Decimal,
          memo: string,
          sub?: { id: string },
        ) => {
          if (amt.lte(0)) return;
          lines.push({
            glAccountId: await glId(glCode),
            fundId: run.fundId,
            costCenterId: run.costCenterId,
            ...(sub ? { subledgerType: 'EMPLOYEE' as SubledgerType, subledgerId: sub.id } : {}),
            debitAmount: side === 'dr' ? amt.toFixed(2) : '0.00',
            creditAmount: side === 'cr' ? amt.toFixed(2) : '0.00',
            lineMemo: memo.slice(0, 255),
          });
        };
        await leg('51101', 'dr', gross, `Salary ${run.payrollMonth} institutional gross`);
        await leg('51104', 'dr', pfEr, `Salary ${run.payrollMonth} employer PF`);
        await leg('22101', 'cr', pfTotal, `Salary ${run.payrollMonth} PF liability`);
        await leg('21301', 'cr', ait, `Salary ${run.payrollMonth} AIT`);
        for (const l of run.payslipLines ?? []) {
          const loan = new Decimal(l.loanDeduction);
          const net = new Decimal(l.netInstitutionalPayable);
          const sub = l.employeeId ? { id: l.employeeId } : undefined;
          await leg('11403', 'cr', loan, `Loan recovery ${l.employeeName}`, sub);
          await leg('21102', 'cr', net, `Net pay ${l.employeeName}`, sub);
        }
        const journal = await this.posting.postSystemJournal(tx, {
          voucherType: 'JOURNAL',
          transactionDate: String(run.payDate).slice(0, 10),
          narration: `Payroll ${run.runNo} (${run.payrollMonth}) — institutional gross ${gross.toFixed(2)}, net payable ${run.netPayableTotal} (MPO govt ${run.mpoGovtTotal} informational, not posted)`.slice(0, 500),
          sourceModule: 'PAYROLL',
          actorId,
          lines,
        });
        await tx.payrollRuns.update({
          where: { id: run.id },
          data: { status: 'APPROVED', glJournalId: journal.id },
        });
        await tx.journalEntries.update({
          where: { id: journal.id },
          data: { sourceReferenceId: run.id },
        });
        return this.findRunIn(tx, run.id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Disburse the full net payable (PAYMENT: Dr 21102 / Cr bank). */
  payRun(id: string, dto: PayPayrollRunDto, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const run = await this.findRunIn(tx, id);
        if (run.status !== 'APPROVED') throw new BadRequestException(`Only APPROVED runs can be paid (now ${run.status})`);
        const net = new Decimal(run.netPayableTotal);
        if (net.lte(0)) throw new BadRequestException('Run net payable is zero');
        const bank = dto.bankGlId
          ? await tx.chartOfAccounts.findUnique({ where: { id: dto.bankGlId } })
          : await tx.chartOfAccounts.findUnique({ where: { glCode: '11201' } });
        if (!bank) throw new BadRequestException('Bank GL not found — run seed:accounting');
        if (!bank.isCashOrBank) throw new BadRequestException(`${bank.glCode} is not a cash/bank account`);
        const apId = await this.glCodeId(tx, '21102');
        const lines: JournalLineDto[] = [];
        for (const l of run.payslipLines ?? []) {
          const amt = new Decimal(l.netInstitutionalPayable);
          if (amt.lte(0)) continue;
          lines.push({
            glAccountId: apId,
            fundId: run.fundId,
            costCenterId: run.costCenterId,
            ...(l.employeeId ? { subledgerType: 'EMPLOYEE' as SubledgerType, subledgerId: l.employeeId } : {}),
            debitAmount: amt.toFixed(2),
            creditAmount: '0.00',
            lineMemo: `Salary ${run.payrollMonth} ${l.employeeName}`.slice(0, 255),
          });
        }
        lines.push({
          glAccountId: bank.id,
          fundId: run.fundId,
          costCenterId: run.costCenterId,
          debitAmount: '0.00',
          creditAmount: net.toFixed(2),
          lineMemo: `Salary disbursement ${run.runNo}`.slice(0, 255),
        });
        const journal = await this.posting.postSystemJournal(tx, {
          voucherType: 'PAYMENT',
          transactionDate: (dto.transactionDate ?? new Date().toISOString()).slice(0, 10),
          narration: `Salary disbursement ${run.runNo} — ${net.toFixed(2)}`.slice(0, 500),
          sourceModule: 'PAYROLL',
          actorId,
          lines,
        });
        await tx.payrollRuns.update({
          where: { id: run.id },
          data: { status: 'PAID', paymentJournalId: journal.id },
        });
        await tx.journalEntries.update({
          where: { id: journal.id },
          data: { sourceReferenceId: run.id },
        });
        return this.findRunIn(tx, run.id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async voidRun(id: string) {
    const run = await this.findRun(id);
    if (run.status !== 'DRAFT') throw new BadRequestException('Only DRAFT runs can be voided');
    await this.prisma.payrollRuns.delete({ where: { id: run.id } });
    return { deleted: true, runNo: run.runNo };
  }

  /* ================= honorarium ================= */

  listHonoraria(limit = 100) {
    return this.prisma.adjunctHonorariumBills.findMany({
      include: { funds: true, costCenters: true, glJournal: true },
      orderBy: [{ workMonth: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  findHonorarium(id: string) {
    return this.findHonorariumIn(this.prisma, id);
  }

  async createHonorarium(dto: CreateHonorariumDto, actorId: string) {
    const fund = await this.prisma.funds.findUnique({ where: { id: dto.fundId } });
    if (!fund) throw new NotFoundException('Fund not found');
    let costCenter: { id: string } | null = null;
    if (dto.costCenterId) {
      costCenter = await this.prisma.costCenters.findUnique({ where: { id: dto.costCenterId } });
      if (!costCenter) throw new NotFoundException('Cost center not found');
    }
    const rc = this.money(dto.ratePerClass, 'ratePerClass');
    const rs = this.money(dto.ratePerScript, 'ratePerScript');
    const rv = this.money(dto.ratePerViva, 'ratePerViva');
    const tdsRate = this.rate(dto.tdsRate, 'tdsRate', 10, 15);
    const gross = rc.times(dto.classesCount).plus(rs.times(dto.scriptsCount)).plus(rv.times(dto.vivaCount))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (gross.lte(0)) throw new BadRequestException('Workload is zero — gross honorarium is 0.00');
    const tds = gross.times(tdsRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const net = gross.minus(tds);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const billNo = await this.nextHonorariumNo(dto.workMonth.slice(0, 4));
      try {
        return await this.prisma.adjunctHonorariumBills.create({
          data: {
            billNo,
            adjunctName: dto.adjunctName.trim(),
            adjunctId: dto.adjunctId ?? null,
            workMonth: dto.workMonth,
            classesCount: dto.classesCount,
            scriptsCount: dto.scriptsCount,
            vivaCount: dto.vivaCount,
            ratePerClass: rc.toFixed(2),
            ratePerScript: rs.toFixed(2),
            ratePerViva: rv.toFixed(2),
            grossAmount: gross.toFixed(2),
            tdsRate: tdsRate.toFixed(2),
            tdsAmount: tds.toFixed(2),
            netPayable: net.toFixed(2),
            fundId: fund.id,
            costCenterId: costCenter?.id ?? null,
            status: 'DRAFT',
            narration: dto.narration?.trim() || null,
            createdByUserId: actorId,
          },
        });
      } catch (e: any) {
        if (String(e?.code) === 'ER_DUP_ENTRY' && attempt < 2) continue;
        throw e;
      }
    }
    throw new BadRequestException('Could not allocate a bill number — retry');
  }

  approveHonorarium(id: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const bill = await this.findHonorariumIn(tx, id);
        if (bill.status !== 'DRAFT') throw new BadRequestException(`Only DRAFT bills can be approved (now ${bill.status})`);
        const gross = new Decimal(bill.grossAmount);
        const tds = new Decimal(bill.tdsAmount);
        const net = new Decimal(bill.netPayable);
        const sub = bill.adjunctId ? { subledgerType: 'EMPLOYEE' as SubledgerType, subledgerId: bill.adjunctId } : {};
        const journal = await this.posting.postSystemJournal(tx, {
          voucherType: 'JOURNAL',
          transactionDate: `${bill.workMonth}-01`,
          narration: `Honorarium ${bill.billNo} ${bill.adjunctName} (${bill.workMonth}) — gross ${gross.toFixed(2)}, TDS ${tds.toFixed(2)}, net ${net.toFixed(2)}`.slice(0, 500),
          sourceModule: 'PAYROLL',
          actorId,
          lines: [
            {
              glAccountId: await this.glCodeId(tx, '51103'),
              fundId: bill.fundId,
              costCenterId: bill.costCenterId,
              debitAmount: gross.toFixed(2),
              creditAmount: '0.00',
              lineMemo: `Honorarium ${bill.billNo}`,
            },
            {
              glAccountId: await this.glCodeId(tx, '21103'),
              fundId: bill.fundId,
              costCenterId: bill.costCenterId,
              ...sub,
              debitAmount: '0.00',
              creditAmount: net.toFixed(2),
              lineMemo: `Honorarium payable ${bill.billNo}`,
            },
            ...(tds.gt(0)
              ? [
                  {
                    glAccountId: await this.glCodeId(tx, '21303'),
                    fundId: bill.fundId,
                    costCenterId: bill.costCenterId,
                    debitAmount: '0.00',
                    creditAmount: tds.toFixed(2),
                    lineMemo: `TDS ${bill.tdsRate}% ${bill.billNo}`,
                  },
                ]
              : []),
          ],
        });
        await tx.adjunctHonorariumBills.update({
          where: { id: bill.id },
          data: { status: 'APPROVED', glJournalId: journal.id },
        });
        await tx.journalEntries.update({
          where: { id: journal.id },
          data: { sourceReferenceId: bill.id },
        });
        return this.findHonorariumIn(tx, bill.id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  payHonorarium(id: string, dto: PayHonorariumDto, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const bill = await this.findHonorariumIn(tx, id);
        if (bill.status !== 'APPROVED') throw new BadRequestException(`Only APPROVED bills can be paid (now ${bill.status})`);
        const net = new Decimal(bill.netPayable);
        const bank = dto.bankGlId
          ? await tx.chartOfAccounts.findUnique({ where: { id: dto.bankGlId } })
          : await tx.chartOfAccounts.findUnique({ where: { glCode: '11201' } });
        if (!bank) throw new BadRequestException('Bank GL not found — run seed:accounting');
        if (!bank.isCashOrBank) throw new BadRequestException(`${bank.glCode} is not a cash/bank account`);
        const sub = bill.adjunctId ? { subledgerType: 'EMPLOYEE' as SubledgerType, subledgerId: bill.adjunctId } : {};
        const journal = await this.posting.postSystemJournal(tx, {
          voucherType: 'PAYMENT',
          transactionDate: (dto.transactionDate ?? new Date().toISOString()).slice(0, 10),
          narration: `Honorarium payment ${bill.billNo} — ${net.toFixed(2)} to ${bill.adjunctName}`.slice(0, 500),
          sourceModule: 'PAYROLL',
          actorId,
          lines: [
            {
              glAccountId: await this.glCodeId(tx, '21103'),
              fundId: bill.fundId,
              costCenterId: bill.costCenterId,
              ...sub,
              debitAmount: net.toFixed(2),
              creditAmount: '0.00',
              lineMemo: `Pay ${bill.billNo}`,
            },
            {
              glAccountId: bank.id,
              fundId: bill.fundId,
              costCenterId: bill.costCenterId,
              debitAmount: '0.00',
              creditAmount: net.toFixed(2),
              lineMemo: `Pay ${bill.billNo}`,
            },
          ],
        });
        await tx.adjunctHonorariumBills.update({
          where: { id: bill.id },
          data: { status: 'PAID' },
        });
        await tx.journalEntries.update({
          where: { id: journal.id },
          data: { sourceReferenceId: bill.id },
        });
        return this.findHonorariumIn(tx, bill.id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async voidHonorarium(id: string) {
    const bill = await this.findHonorarium(id);
    if (bill.status !== 'DRAFT') throw new BadRequestException('Only DRAFT bills can be voided');
    await this.prisma.adjunctHonorariumBills.delete({ where: { id: bill.id } });
    return { deleted: true, billNo: bill.billNo };
  }

  /* ================= helpers ================= */

  private async findRunIn(tx: PrismaTypes.TransactionClient, id: string) {
    const run = await tx.payrollRuns.findUnique({
      where: { id },
      include: {
        funds: true,
        costCenters: true,
        journalEntriesPayrollRunsGlJournalIdTojournalEntries: true,
        journalEntriesPayrollRunsPaymentJournalIdTojournalEntries: true,
        payslipLines: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!run) throw new NotFoundException(`Payroll run #${id} not found`);
    return run;
  }

  private async findHonorariumIn(tx: PrismaTypes.TransactionClient, id: string) {
    const bill = await tx.adjunctHonorariumBills.findUnique({
      where: { id },
      include: {
        funds: true,
        costCenters: true,
        journalEntries: { include: { journalLines: true } },
      },
    });
    if (!bill) throw new NotFoundException(`Honorarium bill #${id} not found`);
    return bill;
  }

  private async refreshRunTotals(runId: string) {
    const lines = await this.prisma.payslipLines.findMany({ where: { runId } });
    const sum = (pick: (l: any) => string) =>
      lines.reduce((t, l) => t.plus(new Decimal(pick(l))), new Decimal(0)).toFixed(2);
    await this.prisma.payrollRuns.update({
      where: { id: runId },
      data: {
        mpoGovtTotal: sum((l) => l.mpoGovtAmount),
        institutionalGrossTotal: sum((l) => l.institutionalGrossAmount),
        pfEmployeeTotal: sum((l) => l.pfEmployeeDeduction),
        pfEmployerTotal: sum((l) => l.pfEmployerContribution),
        aitTdsTotal: sum((l) => l.aitTdsDeduction),
        loanDeductionTotal: sum((l) => l.loanDeduction),
        netPayableTotal: sum((l) => l.netInstitutionalPayable),
      },
    });
  }

  private async nextRunNo(month: string) {
    const last = await this.prisma.payrollRuns.findFirst({
      where: { runNo: { startsWith: `PR-${month}-` } },
      orderBy: { runNo: 'desc' },
    });
    const seq = last ? Number(last.runNo.split('-').pop() ?? '0') + 1 : 1;
    return `PR-${month}-${String(seq).padStart(3, '0')}`;
  }

  private async nextHonorariumNo(year: string) {
    const last = await this.prisma.adjunctHonorariumBills.findFirst({
      where: { billNo: { startsWith: `AH-${year}-` } },
      orderBy: { billNo: 'desc' },
    });
    const seq = last ? Number(last.billNo.split('-').pop() ?? '0') + 1 : 1;
    return `AH-${year}-${String(seq).padStart(6, '0')}`;
  }

  private async glCodeId(tx: PrismaTypes.TransactionClient, code: string): Promise<string> {
    const acct = await tx.chartOfAccounts.findUnique({ where: { glCode: code } });
    if (!acct) throw new BadRequestException(`GL ${code} missing — run seed:accounting`);
    return acct.id;
  }

  private money(raw: unknown, tag: string, opts?: { min?: string }): Decimal {
    let d: Decimal;
    try {
      d = new Decimal(String(raw ?? '').trim() === '' ? 'NaN' : String(raw));
    } catch {
      throw new BadRequestException(`${tag} "${raw}" is not a valid decimal`);
    }
    if (!d.isFinite()) throw new BadRequestException(`${tag} "${raw}" is not a valid decimal`);
    if (d.isNegative()) throw new BadRequestException(`${tag} must be non-negative`);
    if (d.dp() > 2) throw new BadRequestException(`${tag} allows at most 2 decimals`);
    if (opts?.min && d.lt(opts.min)) throw new BadRequestException(`${tag} must be at least ${opts.min}`);
    return d;
  }

  private rate(raw: unknown, tag: string, min: number, max: number): Decimal {
    let d: Decimal;
    try {
      d = new Decimal(String(raw ?? '').trim() === '' ? 'NaN' : String(raw));
    } catch {
      throw new BadRequestException(`${tag} "${raw}" is not a valid percent`);
    }
    if (!d.isFinite() || d.lt(min) || d.gt(max)) {
      throw new BadRequestException(`${tag} must be a percent between ${min} and ${max}`);
    }
    if (d.dp() > 2) throw new BadRequestException(`${tag} allows at most 2 decimals`);
    return d;
  }
}

export { PAYROLL_RUN_STATUSES };
