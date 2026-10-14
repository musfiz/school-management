import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalLine } from '../database/entities/journal-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { Fund } from '../database/entities/fund.entity';
import { CostCenter } from '../database/entities/cost-center.entity';
import { StudentInvoice } from '../database/entities/student-invoice.entity';
import { User } from '../database/entities/user.entity';
import {
  BalanceSheetQueryDto,
  DateRangeReportDto,
  DefaulterAgingQueryDto,
  GeneralLedgerQueryDto,
} from './reports.dto';

const dec = (v: any) => new Decimal(v == null || v === '' ? '0' : String(v));
const fmt = (d: Decimal) => d.toFixed(2);

@Injectable()
export class FinancialReportsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(JournalEntry)
    private readonly entryRepo: Repository<JournalEntry>,
    @InjectRepository(JournalLine)
    private readonly lineRepo: Repository<JournalLine>,
    @InjectRepository(ChartOfAccount)
    private readonly coaRepo: Repository<ChartOfAccount>,
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
    @InjectRepository(CostCenter)
    private readonly costCenterRepo: Repository<CostCenter>,
    @InjectRepository(StudentInvoice)
    private readonly invoiceRepo: Repository<StudentInvoice>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /* =========================================================================
   * 1. TRIAL BALANCE
   * ========================================================================= */
  async getTrialBalance(dto: DateRangeReportDto) {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = dto.startDate || `${today.slice(0, 4)}-01-01`;
    const endDate = dto.endDate || today;

    const accounts = await this.coaRepo.find({
      order: { glCode: 'ASC' },
      relations: ['parent'],
    });

    // Opening lines (< startDate, status = APPROVED)
    const openQb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin('l.entry', 'e')
      .select('l.glAccountId', 'glAccountId')
      .addSelect('SUM(CAST(l.debitAmount AS DECIMAL(15,2)))', 'totalDebit')
      .addSelect('SUM(CAST(l.creditAmount AS DECIMAL(15,2)))', 'totalCredit')
      .where('e.status = :status', { status: 'APPROVED' })
      .andWhere('e.transactionDate < :startDate', { startDate })
      .groupBy('l.glAccountId');

    if (dto.fundId) openQb.andWhere('l.fundId = :fundId', { fundId: dto.fundId });
    if (dto.costCenterId) openQb.andWhere('l.costCenterId = :ccId', { ccId: dto.costCenterId });
    const openRows = await openQb.getRawMany();
    const openMap = new Map<string, { dr: Decimal; cr: Decimal }>();
    for (const r of openRows) {
      openMap.set(r.glAccountId, { dr: dec(r.totalDebit), cr: dec(r.totalCredit) });
    }

    // Period lines (>= startDate AND <= endDate, status = APPROVED)
    const periodQb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin('l.entry', 'e')
      .select('l.glAccountId', 'glAccountId')
      .addSelect('SUM(CAST(l.debitAmount AS DECIMAL(15,2)))', 'periodDebit')
      .addSelect('SUM(CAST(l.creditAmount AS DECIMAL(15,2)))', 'periodCredit')
      .where('e.status = :status', { status: 'APPROVED' })
      .andWhere('e.transactionDate >= :startDate', { startDate })
      .andWhere('e.transactionDate <= :endDate', { endDate })
      .groupBy('l.glAccountId');

    if (dto.fundId) periodQb.andWhere('l.fundId = :fundId', { fundId: dto.fundId });
    if (dto.costCenterId) periodQb.andWhere('l.costCenterId = :ccId', { ccId: dto.costCenterId });
    const periodRows = await periodQb.getRawMany();
    const periodMap = new Map<string, { dr: Decimal; cr: Decimal }>();
    for (const r of periodRows) {
      periodMap.set(r.glAccountId, { dr: dec(r.periodDebit), cr: dec(r.periodCredit) });
    }

    let totOpenDr = new Decimal(0);
    let totOpenCr = new Decimal(0);
    let totPeriodDr = new Decimal(0);
    let totPeriodCr = new Decimal(0);
    let totCloseDr = new Decimal(0);
    let totCloseCr = new Decimal(0);

    const rows: any[] = [];

    for (const acc of accounts) {
      const open = openMap.get(acc.id) || { dr: new Decimal(0), cr: new Decimal(0) };
      const period = periodMap.get(acc.id) || { dr: new Decimal(0), cr: new Decimal(0) };

      // Calculate opening balance based on normal balance
      const openNet = open.dr.minus(open.cr);
      let openDr = new Decimal(0);
      let openCr = new Decimal(0);
      if (acc.normalBalance === 'DR') {
        if (openNet.gte(0)) openDr = openNet;
        else openCr = openNet.abs();
      } else {
        const netCr = open.cr.minus(open.dr);
        if (netCr.gte(0)) openCr = netCr;
        else openDr = netCr.abs();
      }

      // Closing calculation
      const totalDr = openDr.plus(period.dr);
      const totalCr = openCr.plus(period.cr);
      const closeNet = totalDr.minus(totalCr);
      let closeDr = new Decimal(0);
      let closeCr = new Decimal(0);

      if (closeNet.gt(0)) {
        closeDr = closeNet;
      } else if (closeNet.lt(0)) {
        closeCr = closeNet.abs();
      }

      // Skip rows with zero balance everywhere if desired, but keep active or active with activity
      const hasActivity =
        !openDr.isZero() ||
        !openCr.isZero() ||
        !period.dr.isZero() ||
        !period.cr.isZero() ||
        !closeDr.isZero() ||
        !closeCr.isZero();

      if (hasActivity || acc.isControlAccount || acc.isCashOrBank) {
        totOpenDr = totOpenDr.plus(openDr);
        totOpenCr = totOpenCr.plus(openCr);
        totPeriodDr = totPeriodDr.plus(period.dr);
        totPeriodCr = totPeriodCr.plus(period.cr);
        totCloseDr = totCloseDr.plus(closeDr);
        totCloseCr = totCloseCr.plus(closeCr);

        rows.push({
          glAccountId: acc.id,
          glCode: acc.glCode,
          accountName: acc.accountName,
          accountType: acc.accountType,
          normalBalance: acc.normalBalance,
          isCashOrBank: acc.isCashOrBank,
          openingDebit: fmt(openDr),
          openingCredit: fmt(openCr),
          periodDebit: fmt(period.dr),
          periodCredit: fmt(period.cr),
          closingDebit: fmt(closeDr),
          closingCredit: fmt(closeCr),
        });
      }
    }

    const difference = totCloseDr.minus(totCloseCr);
    const isBalanced = difference.abs().lte(0.01);

    return {
      period: { startDate, endDate },
      filters: { fundId: dto.fundId, costCenterId: dto.costCenterId },
      rows,
      totals: {
        openingDebit: fmt(totOpenDr),
        openingCredit: fmt(totOpenCr),
        periodDebit: fmt(totPeriodDr),
        periodCredit: fmt(totPeriodCr),
        closingDebit: fmt(totCloseDr),
        closingCredit: fmt(totCloseCr),
        difference: fmt(difference),
        isBalanced,
      },
    };
  }

  /* =========================================================================
   * 2. DIA RECEIPTS & PAYMENTS ACCOUNT (Cash Basis Extractor)
   * ========================================================================= */
  async getReceiptsAndPayments(dto: DateRangeReportDto) {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = dto.startDate || `${today.slice(0, 4)}-01-01`;
    const endDate = dto.endDate || today;

    // 1. Identify all cash/bank accounts
    const cashBankAccounts = await this.coaRepo.find({
      where: { isCashOrBank: true },
      order: { glCode: 'ASC' },
    });
    const cashBankIds = new Set(cashBankAccounts.map((a) => a.id));

    if (cashBankIds.size === 0) {
      return {
        period: { startDate, endDate },
        openingBalances: [],
        totalOpening: '0.00',
        receipts: [],
        totalReceipts: '0.00',
        payments: [],
        totalPayments: '0.00',
        closingBalances: [],
        totalClosing: '0.00',
        reconciliationDiscrepancy: '0.00',
        isReconciled: true,
      };
    }

    // 2. Opening cash/bank balances (< startDate)
    const openQb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin('l.entry', 'e')
      .select('l.glAccountId', 'glAccountId')
      .addSelect('SUM(CAST(l.debitAmount AS DECIMAL(15,2)))', 'totDr')
      .addSelect('SUM(CAST(l.creditAmount AS DECIMAL(15,2)))', 'totCr')
      .where('e.status = :status', { status: 'APPROVED' })
      .andWhere('e.transactionDate < :startDate', { startDate })
      .andWhere('l.glAccountId IN (:...ids)', { ids: Array.from(cashBankIds) })
      .groupBy('l.glAccountId');

    if (dto.fundId) openQb.andWhere('l.fundId = :fundId', { fundId: dto.fundId });
    if (dto.costCenterId) openQb.andWhere('l.costCenterId = :ccId', { ccId: dto.costCenterId });
    const openRows = await openQb.getRawMany();
    const openMap = new Map<string, Decimal>();
    for (const r of openRows) {
      openMap.set(r.glAccountId, dec(r.totDr).minus(dec(r.totCr)));
    }

    let totOpen = new Decimal(0);
    const openingBalances = cashBankAccounts.map((acc) => {
      const bal = openMap.get(acc.id) || new Decimal(0);
      totOpen = totOpen.plus(bal);
      return {
        glAccountId: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance: fmt(bal),
      };
    });

    // 3. Find all APPROVED journal entries in period touching cash/bank
    const entriesWithCash = await this.entryRepo
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.lines', 'l')
      .leftJoinAndSelect('l.glAccount', 'gl')
      .where('e.status = :status', { status: 'APPROVED' })
      .andWhere('e.transactionDate >= :startDate', { startDate })
      .andWhere('e.transactionDate <= :endDate', { endDate })
      .orderBy('e.transactionDate', 'ASC')
      .getMany();

    const receiptsMap = new Map<string, { glCode: string; name: string; amount: Decimal }>();
    const paymentsMap = new Map<string, { glCode: string; name: string; amount: Decimal }>();
    let totReceipts = new Decimal(0);
    let totPayments = new Decimal(0);

    for (const entry of entriesWithCash) {
      const lines = entry.lines || [];
      const hasCashDr = lines.some((l) => cashBankIds.has(l.glAccountId) && dec(l.debitAmount).gt(0));
      const hasCashCr = lines.some((l) => cashBankIds.has(l.glAccountId) && dec(l.creditAmount).gt(0));

      // Receipt leg: cash was debited -> counterpart credit lines represent inflows
      if (hasCashDr) {
        for (const l of lines) {
          if (!cashBankIds.has(l.glAccountId) && dec(l.creditAmount).gt(0)) {
            if (dto.fundId && l.fundId !== dto.fundId) continue;
            if (dto.costCenterId && l.costCenterId !== dto.costCenterId) continue;

            const cr = dec(l.creditAmount);
            totReceipts = totReceipts.plus(cr);
            const key = l.glAccountId;
            const existing = receiptsMap.get(key);
            if (existing) {
              existing.amount = existing.amount.plus(cr);
            } else {
              receiptsMap.set(key, {
                glCode: l.glAccount?.glCode || 'N/A',
                name: l.glAccount?.accountName || 'Receipt Head',
                amount: cr,
              });
            }
          }
        }
      }

      // Payment leg: cash was credited -> counterpart debit lines represent outflows
      if (hasCashCr) {
        for (const l of lines) {
          if (!cashBankIds.has(l.glAccountId) && dec(l.debitAmount).gt(0)) {
            if (dto.fundId && l.fundId !== dto.fundId) continue;
            if (dto.costCenterId && l.costCenterId !== dto.costCenterId) continue;

            const dr = dec(l.debitAmount);
            totPayments = totPayments.plus(dr);
            const key = l.glAccountId;
            const existing = paymentsMap.get(key);
            if (existing) {
              existing.amount = existing.amount.plus(dr);
            } else {
              paymentsMap.set(key, {
                glCode: l.glAccount?.glCode || 'N/A',
                name: l.glAccount?.accountName || 'Payment Head',
                amount: dr,
              });
            }
          }
        }
      }
    }

    const receipts = Array.from(receiptsMap.values())
      .map((r) => ({ ...r, amount: fmt(r.amount) }))
      .sort((a, b) => a.glCode.localeCompare(b.glCode));

    const payments = Array.from(paymentsMap.values())
      .map((p) => ({ ...p, amount: fmt(p.amount) }))
      .sort((a, b) => a.glCode.localeCompare(b.glCode));

    // 4. Closing cash/bank balance as of endDate
    const closeQb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin('l.entry', 'e')
      .select('l.glAccountId', 'glAccountId')
      .addSelect('SUM(CAST(l.debitAmount AS DECIMAL(15,2)))', 'totDr')
      .addSelect('SUM(CAST(l.creditAmount AS DECIMAL(15,2)))', 'totCr')
      .where('e.status = :status', { status: 'APPROVED' })
      .andWhere('e.transactionDate <= :endDate', { endDate })
      .andWhere('l.glAccountId IN (:...ids)', { ids: Array.from(cashBankIds) })
      .groupBy('l.glAccountId');

    if (dto.fundId) closeQb.andWhere('l.fundId = :fundId', { fundId: dto.fundId });
    if (dto.costCenterId) closeQb.andWhere('l.costCenterId = :ccId', { ccId: dto.costCenterId });
    const closeRows = await closeQb.getRawMany();
    const closeMap = new Map<string, Decimal>();
    for (const r of closeRows) {
      closeMap.set(r.glAccountId, dec(r.totDr).minus(dec(r.totCr)));
    }

    let totClosingActual = new Decimal(0);
    const closingBalances = cashBankAccounts.map((acc) => {
      const bal = closeMap.get(acc.id) || new Decimal(0);
      totClosingActual = totClosingActual.plus(bal);
      return {
        glAccountId: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance: fmt(bal),
      };
    });

    const calculatedClosing = totOpen.plus(totReceipts).minus(totPayments);
    const discrepancy = calculatedClosing.minus(totClosingActual);

    return {
      period: { startDate, endDate },
      filters: { fundId: dto.fundId, costCenterId: dto.costCenterId },
      openingBalances,
      totalOpening: fmt(totOpen),
      receipts,
      totalReceipts: fmt(totReceipts),
      payments,
      totalPayments: fmt(totPayments),
      closingBalances,
      totalClosing: fmt(totClosingActual),
      reconciliationDiscrepancy: fmt(discrepancy),
      isReconciled: discrepancy.abs().lte(0.01),
    };
  }

  /* =========================================================================
   * 3. STATEMENT OF INCOME & EXPENDITURE (Accrual P&L)
   * ========================================================================= */
  async getIncomeAndExpenditure(dto: DateRangeReportDto) {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = dto.startDate || `${today.slice(0, 4)}-01-01`;
    const endDate = dto.endDate || today;

    const qb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin('l.entry', 'e')
      .innerJoin('l.glAccount', 'gl')
      .select('l.glAccountId', 'glAccountId')
      .addSelect('gl.glCode', 'glCode')
      .addSelect('gl.accountName', 'accountName')
      .addSelect('gl.accountType', 'accountType')
      .addSelect('SUM(CAST(l.debitAmount AS DECIMAL(15,2)))', 'totalDebit')
      .addSelect('SUM(CAST(l.creditAmount AS DECIMAL(15,2)))', 'totalCredit')
      .where('e.status = :status', { status: 'APPROVED' })
      .andWhere('e.transactionDate >= :startDate', { startDate })
      .andWhere('e.transactionDate <= :endDate', { endDate })
      .andWhere('gl.accountType IN (:...types)', {
        types: ['REVENUE', 'CONTRA_REVENUE', 'EXPENSE'],
      })
      .groupBy('l.glAccountId')
      .addGroupBy('gl.glCode')
      .addGroupBy('gl.accountName')
      .addGroupBy('gl.accountType')
      .orderBy('gl.glCode', 'ASC');

    if (dto.fundId) qb.andWhere('l.fundId = :fundId', { fundId: dto.fundId });
    if (dto.costCenterId) qb.andWhere('l.costCenterId = :ccId', { ccId: dto.costCenterId });
    const rows = await qb.getRawMany();

    const revenues: any[] = [];
    const contraRevenues: any[] = [];
    const expenses: any[] = [];

    let totGrossRevenue = new Decimal(0);
    let totContraRevenue = new Decimal(0);
    let totExpense = new Decimal(0);

    for (const r of rows) {
      const dr = dec(r.totalDebit);
      const cr = dec(r.totalCredit);

      if (r.accountType === 'REVENUE') {
        const netCr = cr.minus(dr);
        totGrossRevenue = totGrossRevenue.plus(netCr);
        revenues.push({
          glAccountId: r.glAccountId,
          glCode: r.glCode,
          accountName: r.accountName,
          amount: fmt(netCr),
        });
      } else if (r.accountType === 'CONTRA_REVENUE') {
        const netDr = dr.minus(cr);
        totContraRevenue = totContraRevenue.plus(netDr);
        contraRevenues.push({
          glAccountId: r.glAccountId,
          glCode: r.glCode,
          accountName: r.accountName,
          amount: fmt(netDr),
        });
      } else if (r.accountType === 'EXPENSE') {
        const netDr = dr.minus(cr);
        totExpense = totExpense.plus(netDr);
        expenses.push({
          glAccountId: r.glAccountId,
          glCode: r.glCode,
          accountName: r.accountName,
          amount: fmt(netDr),
        });
      }
    }

    const netOperatingRevenue = totGrossRevenue.minus(totContraRevenue);
    const netSurplusDeficit = netOperatingRevenue.minus(totExpense);

    return {
      period: { startDate, endDate },
      filters: { fundId: dto.fundId, costCenterId: dto.costCenterId },
      revenues,
      grossRevenue: fmt(totGrossRevenue),
      contraRevenues,
      totalContraRevenue: fmt(totContraRevenue),
      netOperatingRevenue: fmt(netOperatingRevenue),
      expenses,
      totalExpense: fmt(totExpense),
      netSurplusDeficit: fmt(netSurplusDeficit),
      isSurplus: netSurplusDeficit.gte(0),
    };
  }

  /* =========================================================================
   * 4. STATEMENT OF FINANCIAL POSITION (Balance Sheet)
   * ========================================================================= */
  async getBalanceSheet(dto: BalanceSheetQueryDto) {
    const asOfDate = dto.asOfDate || new Date().toISOString().slice(0, 10);

    // Query all approved lines up to asOfDate
    const qb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin('l.entry', 'e')
      .innerJoin('l.glAccount', 'gl')
      .select('l.glAccountId', 'glAccountId')
      .addSelect('gl.glCode', 'glCode')
      .addSelect('gl.accountName', 'accountName')
      .addSelect('gl.accountType', 'accountType')
      .addSelect('gl.normalBalance', 'normalBalance')
      .addSelect('gl.isCashOrBank', 'isCashOrBank')
      .addSelect('SUM(CAST(l.debitAmount AS DECIMAL(15,2)))', 'totalDebit')
      .addSelect('SUM(CAST(l.creditAmount AS DECIMAL(15,2)))', 'totalCredit')
      .where('e.status = :status', { status: 'APPROVED' })
      .andWhere('e.transactionDate <= :asOfDate', { asOfDate })
      .groupBy('l.glAccountId')
      .addGroupBy('gl.glCode')
      .addGroupBy('gl.accountName')
      .addGroupBy('gl.accountType')
      .addGroupBy('gl.normalBalance')
      .addGroupBy('gl.isCashOrBank')
      .orderBy('gl.glCode', 'ASC');

    if (dto.fundId) qb.andWhere('l.fundId = :fundId', { fundId: dto.fundId });
    const rows = await qb.getRawMany();

    const currentAssets: any[] = [];
    const fixedAssets: any[] = [];
    const currentLiabilities: any[] = [];
    const longTermLiabilities: any[] = [];
    const equityBalances: any[] = [];

    let totAssets = new Decimal(0);
    let totLiabilities = new Decimal(0);
    let totEquity = new Decimal(0);
    let cumulativeNetIncome = new Decimal(0);

    for (const r of rows) {
      const dr = dec(r.totalDebit);
      const cr = dec(r.totalCredit);
      const netDr = dr.minus(cr);
      const netCr = cr.minus(dr);

      if (r.accountType === 'ASSET') {
        totAssets = totAssets.plus(netDr);
        if (r.isCashOrBank || r.glCode.startsWith('11')) {
          currentAssets.push({
            glAccountId: r.glAccountId,
            glCode: r.glCode,
            accountName: r.accountName,
            amount: fmt(netDr),
          });
        } else {
          fixedAssets.push({
            glAccountId: r.glAccountId,
            glCode: r.glCode,
            accountName: r.accountName,
            amount: fmt(netDr),
          });
        }
      } else if (r.accountType === 'CONTRA_ASSET') {
        // Contra-asset reduces total assets (e.g. Accum. Depreciation)
        totAssets = totAssets.minus(netCr);
        fixedAssets.push({
          glAccountId: r.glAccountId,
          glCode: r.glCode,
          accountName: r.accountName,
          amount: fmt(netCr.neg()),
        });
      } else if (r.accountType === 'LIABILITY') {
        totLiabilities = totLiabilities.plus(netCr);
        if (r.glCode.startsWith('22')) {
          longTermLiabilities.push({
            glAccountId: r.glAccountId,
            glCode: r.glCode,
            accountName: r.accountName,
            amount: fmt(netCr),
          });
        } else {
          currentLiabilities.push({
            glAccountId: r.glAccountId,
            glCode: r.glCode,
            accountName: r.accountName,
            amount: fmt(netCr),
          });
        }
      } else if (r.accountType === 'EQUITY') {
        totEquity = totEquity.plus(netCr);
        equityBalances.push({
          glAccountId: r.glAccountId,
          glCode: r.glCode,
          accountName: r.accountName,
          amount: fmt(netCr),
        });
      } else if (r.accountType === 'REVENUE') {
        cumulativeNetIncome = cumulativeNetIncome.plus(netCr);
      } else if (r.accountType === 'CONTRA_REVENUE') {
        cumulativeNetIncome = cumulativeNetIncome.minus(netDr);
      } else if (r.accountType === 'EXPENSE') {
        cumulativeNetIncome = cumulativeNetIncome.minus(netDr);
      }
    }

    const totalEquityWithSurplus = totEquity.plus(cumulativeNetIncome);
    const totalLiabilitiesAndEquity = totLiabilities.plus(totalEquityWithSurplus);
    const discrepancy = totAssets.minus(totalLiabilitiesAndEquity);

    return {
      asOfDate,
      filters: { fundId: dto.fundId },
      assets: {
        current: currentAssets,
        fixed: fixedAssets,
        total: fmt(totAssets),
      },
      liabilities: {
        current: currentLiabilities,
        longTerm: longTermLiabilities,
        total: fmt(totLiabilities),
      },
      fundBalance: {
        accounts: equityBalances,
        totalBeginningBalance: fmt(totEquity),
        currentPeriodSurplusDeficit: fmt(cumulativeNetIncome),
        totalFundBalance: fmt(totalEquityWithSurplus),
      },
      totalLiabilitiesAndEquity: fmt(totalLiabilitiesAndEquity),
      discrepancy: fmt(discrepancy),
      isBalanced: discrepancy.abs().lte(0.01),
    };
  }

  /* =========================================================================
   * 5. STUDENT DEFAULTERS & AGING REPORT
   * ========================================================================= */
  async getDefaulterAging(dto: DefaulterAgingQueryDto) {
    const asOfDate = dto.asOfDate || new Date().toISOString().slice(0, 10);
    const asOfTime = new Date(asOfDate).getTime();

    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.fiscalPeriod', 'period')
      .where('inv.status IN (:...statuses)', {
        statuses: dto.status ? [dto.status] : ['UNPAID', 'PARTIAL', 'OVERDUE'],
      })
      .orderBy('inv.dueDate', 'ASC');

    const invoices = await qb.getMany();

    // Fetch student info
    const studentIds = Array.from(new Set(invoices.map((i) => i.studentId)));
    const users = studentIds.length
      ? await this.userRepo
          .createQueryBuilder('u')
          .where('u.id IN (:...ids)', { ids: studentIds })
          .getMany()
      : [];
    const userMap = new Map<string, User>(users.map((u) => [u.id, u]));

    let totOutstanding = new Decimal(0);
    const bucketTotals = {
      b0_30: new Decimal(0),
      b31_60: new Decimal(0),
      b61_90: new Decimal(0),
      b90Plus: new Decimal(0),
    };

    const items: any[] = [];

    for (const inv of invoices) {
      const net = dec(inv.netAmount);
      const fine = dec(inv.lateFineAmount);
      const paid = dec(inv.paidAmount);
      const due = net.plus(fine).minus(paid);

      if (due.lte(0)) continue;

      const dueDateTime = new Date(inv.dueDate).getTime();
      const diffDays = Math.max(0, Math.floor((asOfTime - dueDateTime) / (1000 * 60 * 60 * 24)));

      let bucket: '0–30 days' | '31–60 days' | '61–90 days' | '90+ days';
      if (diffDays <= 30) {
        bucket = '0–30 days';
        bucketTotals.b0_30 = bucketTotals.b0_30.plus(due);
      } else if (diffDays <= 60) {
        bucket = '31–60 days';
        bucketTotals.b31_60 = bucketTotals.b31_60.plus(due);
      } else if (diffDays <= 90) {
        bucket = '61–90 days';
        bucketTotals.b61_90 = bucketTotals.b61_90.plus(due);
      } else {
        bucket = '90+ days';
        bucketTotals.b90Plus = bucketTotals.b90Plus.plus(due);
      }

      totOutstanding = totOutstanding.plus(due);
      const student = userMap.get(inv.studentId);

      items.push({
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        studentId: inv.studentId,
        studentName: student?.name || 'Unknown Student',
        studentEmail: student?.email || '',
        studentPhone: student?.phone || '',
        billingPeriod: inv.billingPeriod,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        daysOverdue: diffDays,
        agingBucket: bucket,
        netAmount: inv.netAmount,
        lateFineAmount: inv.lateFineAmount,
        paidAmount: inv.paidAmount,
        dueBalance: fmt(due),
        status: inv.status,
      });
    }

    return {
      asOfDate,
      summary: {
        totalDefaulters: items.length,
        totalOutstanding: fmt(totOutstanding),
        buckets: {
          '0–30 days': fmt(bucketTotals.b0_30),
          '31–60 days': fmt(bucketTotals.b31_60),
          '61–90 days': fmt(bucketTotals.b61_90),
          '90+ days': fmt(bucketTotals.b90Plus),
        },
      },
      items,
    };
  }

  /* =========================================================================
   * 6. GENERAL LEDGER / ACCOUNT STATEMENT
   * ========================================================================= */
  async getGeneralLedger(dto: GeneralLedgerQueryDto) {
    const account = await this.coaRepo.findOne({
      where: { id: dto.glAccountId },
      relations: ['parent', 'defaultFund'],
    });
    if (!account) throw new NotFoundException(`GL Account #${dto.glAccountId} not found`);

    const today = new Date().toISOString().slice(0, 10);
    const startDate = dto.startDate || `${today.slice(0, 4)}-01-01`;
    const endDate = dto.endDate || today;

    // 1. Opening balance (< startDate)
    const openQb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin('l.entry', 'e')
      .select('SUM(CAST(l.debitAmount AS DECIMAL(15,2)))', 'totDr')
      .addSelect('SUM(CAST(l.creditAmount AS DECIMAL(15,2)))', 'totCr')
      .where('l.glAccountId = :accId', { accId: dto.glAccountId })
      .andWhere('e.status = :status', { status: 'APPROVED' })
      .andWhere('e.transactionDate < :startDate', { startDate });

    if (dto.fundId) openQb.andWhere('l.fundId = :fundId', { fundId: dto.fundId });
    if (dto.costCenterId) openQb.andWhere('l.costCenterId = :ccId', { ccId: dto.costCenterId });
    const openRaw = await openQb.getRawOne();
    const openDr = dec(openRaw?.totDr);
    const openCr = dec(openRaw?.totCr);

    let openingBalance = new Decimal(0);
    if (account.normalBalance === 'DR') {
      openingBalance = openDr.minus(openCr);
    } else {
      openingBalance = openCr.minus(openDr);
    }

    // 2. Transaction lines
    const lineQb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.entry', 'e')
      .leftJoinAndSelect('l.fund', 'fund')
      .leftJoinAndSelect('l.costCenter', 'cc')
      .where('l.glAccountId = :accId', { accId: dto.glAccountId })
      .andWhere('e.status = :status', { status: 'APPROVED' })
      .andWhere('e.transactionDate >= :startDate', { startDate })
      .andWhere('e.transactionDate <= :endDate', { endDate })
      .orderBy('e.transactionDate', 'ASC')
      .addOrderBy('e.createdAt', 'ASC');

    if (dto.fundId) lineQb.andWhere('l.fundId = :fundId', { fundId: dto.fundId });
    if (dto.costCenterId) lineQb.andWhere('l.costCenterId = :ccId', { ccId: dto.costCenterId });
    const lines = await lineQb.getMany();

    let running = openingBalance;
    let totPeriodDr = new Decimal(0);
    let totPeriodCr = new Decimal(0);

    const statementLines = lines.map((l) => {
      const dr = dec(l.debitAmount);
      const cr = dec(l.creditAmount);
      totPeriodDr = totPeriodDr.plus(dr);
      totPeriodCr = totPeriodCr.plus(cr);

      if (account.normalBalance === 'DR') {
        running = running.plus(dr).minus(cr);
      } else {
        running = running.plus(cr).minus(dr);
      }

      return {
        lineId: l.id,
        voucherId: l.journalEntryId,
        voucherNo: l.entry?.voucherNo || 'N/A',
        voucherType: l.entry?.voucherType || 'JOURNAL',
        transactionDate: l.entry?.transactionDate || '',
        narration: l.entry?.narration || '',
        lineMemo: l.lineMemo,
        fundCode: l.fund?.fundCode,
        costCenterCode: l.costCenter?.centerCode,
        subledgerType: l.subledgerType,
        subledgerId: l.subledgerId,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
        runningBalance: fmt(running),
      };
    });

    return {
      account: {
        id: account.id,
        glCode: account.glCode,
        accountName: account.accountName,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        isControlAccount: account.isControlAccount,
        isCashOrBank: account.isCashOrBank,
      },
      period: { startDate, endDate },
      filters: { fundId: dto.fundId, costCenterId: dto.costCenterId },
      openingBalance: fmt(openingBalance),
      totalDebit: fmt(totPeriodDr),
      totalCredit: fmt(totPeriodCr),
      closingBalance: fmt(running),
      lines: statementLines,
    };
  }
}
