import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Vendor } from '../database/entities/vendor.entity';
import {
  VENDOR_BILL_STATUSES,
  VendorBill,
} from '../database/entities/vendor-bill.entity';
import {
  TaxChallan,
} from '../database/entities/tax-challan.entity';
import { TaxChallanItem } from '../database/entities/tax-challan-item.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { Fund } from '../database/entities/fund.entity';
import { CostCenter } from '../database/entities/cost-center.entity';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalPostingService } from './journal-posting.service';
import type { JournalLineDto } from './vouchers.dto';
import type {
  CreateTaxChallanDto,
  CreateVendorBillDto,
  CreateVendorDto,
  PayVendorBillDto,
} from './procurement.dto';

/**
 * Phase 5 — procurement, vendor payables & NBR withholding
 * (docs/AGENT_IMPLEMENTATION_PLAN.md Phase 5, spec §1.4/§2).
 *
 * Bill approval (JOURNAL, one fund):
 *   Dr 5xxxx Expense / 121xx Asset              = gross
 *   Cr 21101 AP – Vendor (VENDOR sub-ledger)    = net payable
 *   Cr 21302 TDS Payable – Suppliers           = tds
 *   Cr 21304 VDS Payable to Govt Treasury      = vds
 *
 * Vendor payment (PAYMENT): Dr 21101 (VENDOR) / Cr cash/bank.
 * Treasury remittance (PAYMENT): Dr 21302/21304 / Cr 11201 bank.
 *
 * Money arrives as decimal strings and is computed with decimal.js —
 * never float. TDS/VDS round HALF_UP per NBR practice.
 */
@Injectable()
export class VendorBillService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly posting: JournalPostingService,
    @InjectRepository(Vendor)
    private readonly vendors: Repository<Vendor>,
    @InjectRepository(VendorBill)
    private readonly bills: Repository<VendorBill>,
    @InjectRepository(TaxChallan)
    private readonly challans: Repository<TaxChallan>,
  ) {}

  /* ================= vendors ================= */

  listVendors(activeOnly = true): Promise<Vendor[]> {
    return this.vendors.find({
      where: activeOnly ? { isActive: true } : {},
      order: { vendorName: 'ASC' },
      take: 500,
    });
  }

  async createVendor(dto: CreateVendorDto): Promise<Vendor> {
    const row = this.vendors.create({
      vendorCode: dto.vendorCode?.trim() || null,
      vendorName: dto.vendorName.trim(),
      binNo: dto.binNo?.trim() || null,
      tradeLicenseNo: dto.tradeLicenseNo?.trim() || null,
      contactPerson: dto.contactPerson?.trim() || null,
      contactPhone: dto.contactPhone?.trim() || null,
      address: dto.address?.trim() || null,
    });
    try {
      return await this.vendors.save(row);
    } catch (e: any) {
      if (String(e?.code) === 'ER_DUP_ENTRY') {
        throw new BadRequestException(`Vendor code "${dto.vendorCode}" already exists`);
      }
      throw e;
    }
  }

  /* ================= bills ================= */

  listBills(filters: { vendorId?: string; status?: string; limit?: number }): Promise<VendorBill[]> {
    const qb = this.bills
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.vendor', 'vendor')
      .leftJoinAndSelect('b.expenseGl', 'expenseGl')
      .leftJoinAndSelect('b.fund', 'fund')
      .leftJoinAndSelect('b.costCenter', 'costCenter')
      .leftJoinAndSelect('b.glJournal', 'glJournal')
      .orderBy('b.billDate', 'DESC')
      .addOrderBy('b.createdAt', 'DESC')
      .take(Math.min(Math.max(filters.limit ?? 100, 1), 500));
    if (filters.vendorId) qb.andWhere('b.vendorId = :v', { v: filters.vendorId });
    if (filters.status) {
      if (!VENDOR_BILL_STATUSES.includes(filters.status as (typeof VENDOR_BILL_STATUSES)[number])) {
        throw new BadRequestException(`Unknown bill status "${filters.status}"`);
      }
      qb.andWhere('b.status = :st', { st: filters.status });
    }
    return qb.getMany();
  }

  findBill(id: string): Promise<VendorBill> {
    return this.findBillIn(this.dataSource.manager, id);
  }

  /** DRAFT entry — taxes computed, nothing posted yet. */
  async createBill(dto: CreateVendorBillDto, actorId: string): Promise<VendorBill> {
    const vendor = await this.vendors.findOne({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (!vendor.isActive) throw new BadRequestException('Vendor is inactive');
    const expenseGl = await this.gl(dto.expenseGlId);
    if (expenseGl.accountType !== 'EXPENSE' && expenseGl.glCode !== '12101' && !expenseGl.glCode.startsWith('1210')) {
      throw new BadRequestException(`${expenseGl.glCode} is not a 5xxxx expense or 121xx asset account`);
    }
    const fund = await this.dataSource.getRepository(Fund).findOne({ where: { id: dto.fundId } });
    if (!fund) throw new NotFoundException('Fund not found');
    let costCenter: CostCenter | null = null;
    if (dto.costCenterId) {
      costCenter = await this.dataSource.getRepository(CostCenter).findOne({ where: { id: dto.costCenterId } });
      if (!costCenter) throw new NotFoundException('Cost center not found');
    }
    const gross = this.money(dto.grossAmount, 'grossAmount', { min: '0.01' });
    const tdsRate = this.rate(dto.tdsRate ?? '0', 'tdsRate');
    const vdsRate = this.rate(dto.vdsRate ?? '0', 'vdsRate');
    if (tdsRate.plus(vdsRate).gt(100)) {
      throw new BadRequestException('TDS rate + VDS rate cannot exceed 100%');
    }
    const tds = gross.times(tdsRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const vds = gross.times(vdsRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const net = gross.minus(tds).minus(vds);
    if (net.lt(0)) throw new BadRequestException('Withholding exceeds gross — net payable would be negative');

    const billDate = dto.billDate.slice(0, 10);
    const dueDate = dto.dueDate?.slice(0, 10) ?? null;
    if (dueDate && dueDate < billDate) throw new BadRequestException('Due date cannot precede bill date');

    // VB-YYYY-XXXXXX with a retry on the (unlikely) race duplicate.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const billNo = await this.nextBillNo(billDate.slice(0, 4));
      try {
        return await this.bills.save(
          this.bills.create({
            billNo,
            vendorId: vendor.id,
            expenseGlId: expenseGl.id,
            fundId: fund.id,
            costCenterId: costCenter?.id ?? null,
            billDate,
            dueDate,
            supplierInvoiceNo: dto.supplierInvoiceNo?.trim() || null,
            grossAmount: gross.toFixed(2),
            tdsRate: tdsRate.toFixed(2),
            tdsAmount: tds.toFixed(2),
            vdsRate: vdsRate.toFixed(2),
            vdsAmount: vds.toFixed(2),
            netPayable: net.toFixed(2),
            mushak63Received: dto.mushak63Received ?? false,
            status: 'DRAFT',
            narration: dto.narration?.trim() || null,
            createdByUserId: actorId,
          }),
        );
      } catch (e: any) {
        if (String(e?.code) === 'ER_DUP_ENTRY' && attempt < 2) continue;
        throw e;
      }
    }
    throw new BadRequestException('Could not allocate a bill number — retry');
  }

  /** Approve a DRAFT bill and auto-post the accrual journal. */
  approveBill(id: string, actorId: string): Promise<VendorBill> {
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const bill = await this.findBillIn(m, id);
      if (bill.status !== 'DRAFT') throw new BadRequestException(`Only DRAFT bills can be approved (now ${bill.status})`);
      const gross = new Decimal(bill.grossAmount);
      const tds = new Decimal(bill.tdsAmount);
      const vds = new Decimal(bill.vdsAmount);
      const net = new Decimal(bill.netPayable);

      const lines: JournalLineDto[] = [
        {
          glAccountId: bill.expenseGlId,
          fundId: bill.fundId,
          costCenterId: bill.costCenterId,
          debitAmount: gross.toFixed(2),
          creditAmount: '0.00',
          lineMemo: `Bill ${bill.billNo} ${bill.vendor?.vendorName ?? ''}`.trim().slice(0, 255),
        },
        {
          glAccountId: await this.glId(m, '21101'),
          fundId: bill.fundId,
          costCenterId: bill.costCenterId,
          subledgerType: 'VENDOR',
          subledgerId: bill.vendorId,
          debitAmount: '0.00',
          creditAmount: net.toFixed(2),
          lineMemo: `AP ${bill.billNo}`,
        },
      ];
      if (tds.gt(0)) {
        lines.push({
          glAccountId: await this.glId(m, '21302'),
          fundId: bill.fundId,
          costCenterId: bill.costCenterId,
          debitAmount: '0.00',
          creditAmount: tds.toFixed(2),
          lineMemo: `TDS ${bill.tdsRate}% on ${bill.billNo}`,
        });
      }
      if (vds.gt(0)) {
        lines.push({
          glAccountId: await this.glId(m, '21304'),
          fundId: bill.fundId,
          costCenterId: bill.costCenterId,
          debitAmount: '0.00',
          creditAmount: vds.toFixed(2),
          lineMemo: `VDS ${bill.vdsRate}% on ${bill.billNo}`,
        });
      }
      const journal = await this.posting.postSystemJournal(m, {
        voucherType: 'JOURNAL',
        transactionDate: bill.billDate,
        narration: `Vendor bill ${bill.billNo} — gross ${gross.toFixed(2)} (TDS ${tds.toFixed(2)}, VDS ${vds.toFixed(2)}, net ${net.toFixed(2)})${bill.narration ? ` — ${bill.narration}` : ''}`.slice(0, 500),
        sourceModule: 'PROCUREMENT',
        actorId,
        lines,
      });
      bill.status = net.gt(0) ? 'APPROVED' : 'PAID';
      bill.glJournalId = journal.id;
      await m.getRepository(VendorBill).save(bill);
      journal.sourceReferenceId = bill.id;
      await m.getRepository(JournalEntry).save(journal);
      return this.findBillIn(m, bill.id);
    });
  }

  /** Pay the vendor in full or part (PAYMENT: Dr 21101 / Cr bank). */
  payBill(id: string, dto: PayVendorBillDto, actorId: string): Promise<VendorBill> {
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const bill = await this.findBillIn(m, id);
      if (!['APPROVED', 'PARTIAL'].includes(bill.status)) {
        throw new BadRequestException(`Only APPROVED/PARTIAL bills can be paid (now ${bill.status})`);
      }
      const amount = this.money(dto.amount, 'amount', { min: '0.01' });
      const outstanding = new Decimal(bill.netPayable).minus(new Decimal(bill.paidAmount));
      if (amount.gt(outstanding)) {
        throw new BadRequestException(`Amount ${amount.toFixed(2)} exceeds outstanding ${outstanding.toFixed(2)} — overpayment blocked`);
      }
      const bank = dto.bankGlId
        ? await m.getRepository(ChartOfAccount).findOne({ where: { id: dto.bankGlId } })
        : await m.getRepository(ChartOfAccount).findOne({ where: { glCode: '11201' } });
      if (!bank) throw new BadRequestException('Bank GL not found — run seed:accounting');
      if (!bank.isCashOrBank) throw new BadRequestException(`${bank.glCode} is not a cash/bank account`);

      const journal = await this.posting.postSystemJournal(m, {
        voucherType: 'PAYMENT',
        transactionDate: (dto.transactionDate ?? new Date().toISOString()).slice(0, 10),
        narration: `Vendor payment ${bill.billNo} — ${amount.toFixed(2)} to ${bill.vendor?.vendorName ?? bill.vendorId}`.slice(0, 500),
        sourceModule: 'PROCUREMENT',
        actorId,
        lines: [
          {
            glAccountId: await this.glId(m, '21101'),
            fundId: bill.fundId,
            costCenterId: bill.costCenterId,
            subledgerType: 'VENDOR',
            subledgerId: bill.vendorId,
            debitAmount: amount.toFixed(2),
            creditAmount: '0.00',
            lineMemo: `Pay ${bill.billNo}`,
          },
          {
            glAccountId: bank.id,
            fundId: bill.fundId,
            costCenterId: bill.costCenterId,
            debitAmount: '0.00',
            creditAmount: amount.toFixed(2),
            lineMemo: `Pay ${bill.billNo}`,
          },
        ],
      });
      const paid = new Decimal(bill.paidAmount).plus(amount);
      bill.paidAmount = paid.toFixed(2);
      bill.status = paid.gte(new Decimal(bill.netPayable)) ? 'PAID' : 'PARTIAL';
      await m.getRepository(VendorBill).save(bill);
      journal.sourceReferenceId = bill.id;
      await m.getRepository(JournalEntry).save(journal);
      return this.findBillIn(m, bill.id);
    });
  }

  /** Delete an unposted DRAFT bill (posted bills correct via reversal). */
  async voidBill(id: string): Promise<{ deleted: boolean; billNo: string }> {
    const bill = await this.findBill(id);
    if (bill.status !== 'DRAFT') throw new BadRequestException('Only DRAFT bills can be voided');
    await this.bills.remove(bill);
    return { deleted: true, billNo: bill.billNo };
  }

  /* ================= NBR challan ================= */

  /** Withheld legs not yet deposited: { bill, taxType, deducted, remitted, pending }. */
  async pendingTaxes(taxType?: 'TDS' | 'VDS') {
    const bills = await this.bills.find({
      where: {},
      relations: ['vendor'],
      order: { billDate: 'ASC' },
      take: 500,
    });
    const open = bills.filter((b) => ['APPROVED', 'PARTIAL', 'PAID'].includes(b.status));
    const legs: Array<{
      billId: string;
      billNo: string;
      vendorName: string;
      billDate: string;
      taxType: 'TDS' | 'VDS';
      rate: string;
      deducted: string;
      remitted: string;
      pending: string;
    }> = [];
    for (const b of open) {
      const push = (kind: 'TDS' | 'VDS', deducted: string, remitted: string, rate: string) => {
        const pending = new Decimal(deducted).minus(new Decimal(remitted));
        if (pending.gt(0) && (!taxType || taxType === kind)) {
          legs.push({
            billId: b.id,
            billNo: b.billNo,
            vendorName: b.vendor?.vendorName ?? '',
            billDate: b.billDate,
            taxType: kind,
            rate,
            deducted: new Decimal(deducted).toFixed(2),
            remitted: new Decimal(remitted).toFixed(2),
            pending: pending.toFixed(2),
          });
        }
      };
      push('TDS', b.tdsAmount, b.tdsRemittedAmount, b.tdsRate);
      push('VDS', b.vdsAmount, b.vdsRemittedAmount, b.vdsRate);
    }
    const total = legs.reduce((t, l) => t.plus(new Decimal(l.pending)), new Decimal(0));
    return { legs, totalPending: total.toFixed(2) };
  }

  listChallans(limit = 100): Promise<TaxChallan[]> {
    return this.challans.find({
      relations: ['bankGl', 'items', 'items.vendorBill', 'glJournal'],
      order: { challanDate: 'DESC', createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  findChallan(id: string): Promise<TaxChallan> {
    return this.findChallanIn(this.dataSource.manager, id);
  }

  /**
   * Deposit selected withheld legs under one Treasury challan.
   * Each selected leg remits its FULL pending amount (no partial legs —
   * the bank stamp covers the whole deduction line).
   */
  remitChallan(dto: CreateTaxChallanDto, actorId: string): Promise<TaxChallan> {
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const dup = await m.getRepository(TaxChallan).findOne({ where: { challanNo: dto.challanNo.trim() } });
      if (dup) throw new BadRequestException(`Challan "${dto.challanNo.trim()}" already deposited`);
      const bank = dto.bankGlId
        ? await m.getRepository(ChartOfAccount).findOne({ where: { id: dto.bankGlId } })
        : await m.getRepository(ChartOfAccount).findOne({ where: { glCode: '11201' } });
      if (!bank) throw new BadRequestException('Bank GL not found — run seed:accounting');
      if (!bank.isCashOrBank) throw new BadRequestException(`${bank.glCode} is not a cash/bank account`);

      // De-duplicate legs; resolve + lock each bill's pending amount.
      const seen = new Set<string>();
      const legs: Array<{ bill: VendorBill; taxType: 'TDS' | 'VDS'; pending: Decimal }> = [];
      for (const r of dto.remit) {
        const key = `${r.billId}:${r.taxType}`;
        if (seen.has(key)) throw new BadRequestException(`Duplicate leg ${key}`);
        seen.add(key);
        const bill = await this.findBillIn(m, r.billId);
        if (!['APPROVED', 'PARTIAL', 'PAID'].includes(bill.status)) {
          throw new BadRequestException(`Bill ${bill.billNo} is ${bill.status} — withholding not yet posted`);
        }
        const pending =
          r.taxType === 'TDS'
            ? new Decimal(bill.tdsAmount).minus(new Decimal(bill.tdsRemittedAmount))
            : new Decimal(bill.vdsAmount).minus(new Decimal(bill.vdsRemittedAmount));
        if (pending.lte(0)) throw new BadRequestException(`Bill ${bill.billNo} has no pending ${r.taxType}`);
        legs.push({ bill, taxType: r.taxType, pending });
      }

      const lines: JournalLineDto[] = [];
      for (const leg of legs) {
        lines.push({
          glAccountId: await this.glId(m, leg.taxType === 'TDS' ? '21302' : '21304'),
          fundId: leg.bill.fundId,
          costCenterId: leg.bill.costCenterId,
          debitAmount: leg.pending.toFixed(2),
          creditAmount: '0.00',
          lineMemo: `${leg.taxType} remit ${leg.bill.billNo}`.slice(0, 255),
        });
      }
      const total = legs.reduce((t, l) => t.plus(l.pending), new Decimal(0));
      // Single credit leg per fund (fund isolation: each fund's debit legs
      // net against that fund's share of the bank credit).
      const byFund = new Map<string, Decimal>();
      for (const leg of legs) {
        byFund.set(leg.bill.fundId, (byFund.get(leg.bill.fundId) ?? new Decimal(0)).plus(leg.pending));
      }
      for (const [fundId, amt] of byFund) {
        const cc = legs.find((l) => l.bill.fundId === fundId)?.bill.costCenterId ?? null;
        lines.push({
          glAccountId: bank.id,
          fundId,
          costCenterId: cc,
          debitAmount: '0.00',
          creditAmount: amt.toFixed(2),
          lineMemo: `Treasury challan ${dto.challanNo.trim()}`.slice(0, 255),
        });
      }
      const journal = await this.posting.postSystemJournal(m, {
        voucherType: 'PAYMENT',
        transactionDate: dto.challanDate.slice(0, 10),
        narration: `NBR Treasury challan ${dto.challanNo.trim()} — ${legs.length} leg(s), total ${total.toFixed(2)}${dto.depositBankName ? ` via ${dto.depositBankName}` : ''}`.slice(0, 500),
        sourceModule: 'PROCUREMENT',
        actorId,
        lines,
      });

      const challanRepo = m.getRepository(TaxChallan);
      const saved = await challanRepo.save(
        challanRepo.create({
          challanNo: dto.challanNo.trim(),
          challanDate: dto.challanDate.slice(0, 10),
          bankGlId: bank.id,
          depositBankName: dto.depositBankName?.trim() || null,
          totalAmount: total.toFixed(2),
          glJournalId: journal.id,
          status: 'POSTED',
          createdByUserId: actorId,
        }),
      );
      const itemRepo = m.getRepository(TaxChallanItem);
      const billRepo = m.getRepository(VendorBill);
      for (const leg of legs) {
        await itemRepo.save(
          itemRepo.create({
            challanId: saved.id,
            vendorBillId: leg.bill.id,
            taxType: leg.taxType,
            amount: leg.pending.toFixed(2),
          }),
        );
        if (leg.taxType === 'TDS') {
          leg.bill.tdsRemittedAmount = new Decimal(leg.bill.tdsRemittedAmount).plus(leg.pending).toFixed(2);
        } else {
          leg.bill.vdsRemittedAmount = new Decimal(leg.bill.vdsRemittedAmount).plus(leg.pending).toFixed(2);
        }
        await billRepo.save(leg.bill);
      }
      journal.sourceReferenceId = saved.id;
      await m.getRepository(JournalEntry).save(journal);
      return this.findChallanIn(m, saved.id);
    });
  }

  /* ================= helpers ================= */

  private async findBillIn(m: EntityManager, id: string): Promise<VendorBill> {
    const bill = await m.getRepository(VendorBill).findOne({
      where: { id },
      relations: ['vendor', 'expenseGl', 'fund', 'costCenter', 'glJournal', 'glJournal.lines'],
    });
    if (!bill) throw new NotFoundException(`Vendor bill #${id} not found`);
    return bill;
  }

  private async findChallanIn(m: EntityManager, id: string): Promise<TaxChallan> {
    const row = await m.getRepository(TaxChallan).findOne({
      where: { id },
      relations: ['bankGl', 'items', 'items.vendorBill', 'glJournal', 'glJournal.lines'],
    });
    if (!row) throw new NotFoundException(`Tax challan #${id} not found`);
    return row;
  }

  private async nextBillNo(year: string): Promise<string> {
    const last = await this.bills
      .createQueryBuilder('b')
      .where('b.billNo LIKE :p', { p: `VB-${year}-%` })
      .orderBy('b.billNo', 'DESC')
      .getOne();
    const seq = last ? Number(last.billNo.split('-').pop() ?? '0') + 1 : 1;
    return `VB-${year}-${String(seq).padStart(6, '0')}`;
  }

  private async gl(id: string): Promise<ChartOfAccount> {
    const acct = await this.dataSource.getRepository(ChartOfAccount).findOne({ where: { id } });
    if (!acct) throw new NotFoundException('GL account not found');
    return acct;
  }

  private async glId(m: EntityManager, code: string): Promise<string> {
    const acct = await m.getRepository(ChartOfAccount).findOne({ where: { glCode: code } });
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

  private rate(raw: unknown, tag: string): Decimal {
    let d: Decimal;
    try {
      d = new Decimal(String(raw ?? '').trim() === '' ? '0' : String(raw));
    } catch {
      throw new BadRequestException(`${tag} "${raw}" is not a valid percent`);
    }
    if (!d.isFinite() || d.isNegative() || d.gt(100)) {
      throw new BadRequestException(`${tag} must be a percent between 0 and 100`);
    }
    if (d.dp() > 2) throw new BadRequestException(`${tag} allows at most 2 decimals`);
    return d;
  }
}
