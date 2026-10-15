import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  CLEARING_GL_BY_CHANNEL,
  DEFAULT_TDR_PERCENT,
  MFS_CHANNELS,
  PaymentCollection,
  type PaymentChannel,
} from '../database/entities/payment-collection.entity';
import { StudentInvoice } from '../database/entities/student-invoice.entity';
import { StudentInvoiceLine } from '../database/entities/student-invoice-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { Fund } from '../database/entities/fund.entity';
import { JournalPostingService } from './journal-posting.service';
import type { JournalLineDto } from './vouchers.dto';
import type {
  CollectFeeDto,
  MfsWebhookDto,
  SettleCollectionDto,
} from './collection.dto';

/**
 * Phase 4 — counter/bank collection, MFS webhooks with TDR split,
 * and clearing → bank settlement (docs/AGENT_IMPLEMENTATION_PLAN.md
 * Phase 4, spec §1.4).
 *
 * Counter cash / bank challan:
 *   Dr Cash/Bank (11101 / 11201)            = gross (per-fund split)
 *   Cr 11401 Student AR (STUDENT sub-ledger) = gross (per-fund split)
 *
 * MFS (bKash/Nagad/SSLCommerz/EkPay):
 *   Dr 1130x Clearing (net)   + Dr 54103 TDR / Cr 11401 AR (gross)
 *   Student ledger always sees the FULL gross (plan acceptance §4).
 *
 * Settlement (CONTRA): Dr 11201 Mother Bank / Cr 1130x Clearing (net).
 * Every leg stays inside ONE fund so the Phase-2 per-fund isolation
 * rule always holds, even on multi-fund (General + Lillah) invoices.
 */
@Injectable()
export class FeeCollectionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly posting: JournalPostingService,
    @InjectRepository(PaymentCollection)
    private readonly receipts: Repository<PaymentCollection>,
  ) {}

  /* ================= queries ================= */

  list(filters: {
    studentId?: string;
    status?: string;
    channel?: string;
    limit?: number;
  }): Promise<PaymentCollection[]> {
    const qb = this.receipts
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.invoice', 'invoice')
      .leftJoinAndSelect('r.cashGl', 'cashGl')
      .leftJoinAndSelect('r.fund', 'fund')
      .leftJoinAndSelect('r.glJournal', 'glJournal')
      .orderBy('r.createdAt', 'DESC')
      .take(Math.min(Math.max(filters.limit ?? 100, 1), 500));
    if (filters.studentId) qb.andWhere('r.studentId = :s', { s: filters.studentId });
    if (filters.status) qb.andWhere('r.reconciliationStatus = :st', { st: filters.status });
    if (filters.channel) qb.andWhere('r.paymentChannel = :ch', { ch: filters.channel });
    return qb.getMany();
  }

  async findOne(id: string): Promise<PaymentCollection> {
    const row = await this.receipts.findOne({
      where: { id },
      relations: ['invoice', 'cashGl', 'fund', 'glJournal', 'glJournal.lines'],
    });
    if (!row) throw new NotFoundException(`Receipt #${id} not found`);
    return row;
  }

  /** POS lookup: open invoices + AR summary for one student. */
  async duesForStudent(studentId: string) {
    const invoices = await this.dataSource.getRepository(StudentInvoice).find({
      where: { studentId },
      relations: ['lines', 'lines.feeHead', 'lines.glAccount', 'lines.fund'],
      order: { dueDate: 'ASC' },
    });
    const open = invoices.filter((i) => !['PAID', 'REVERSED'].includes(i.status));
    const d = (s: string) => new Decimal(s);
    const due = open.reduce(
      (t, i) => t.plus(d(i.netAmount)).plus(d(i.lateFineAmount)).minus(d(i.paidAmount)),
      new Decimal(0),
    );
    return {
      studentId,
      open,
      all: invoices,
      summary: {
        openCount: open.length,
        totalDue: Decimal.max(due, new Decimal(0)).toFixed(2),
      },
    };
  }

  /* ================= counter / POS collection ================= */

  async collect(dto: CollectFeeDto, actorId: string): Promise<PaymentCollection> {
    // Idempotency: a retried POST with the same gateway ref returns the
    // original receipt instead of double-posting (plan §4 acceptance).
    if (dto.gatewayTrxId?.trim()) {
      const dup = await this.receipts.findOne({
        where: { gatewayTrxId: dto.gatewayTrxId.trim() },
      });
      if (dup) return this.findOne(dup.id);
    }
    return this.dataSource.transaction('REPEATABLE READ', (m) =>
      this.postCollection(m, dto, actorId),
    );
  }

  /**
   * Workflow 4 entry: same posting inside an OUTER (onboarding)
   * transaction. The caller owns atomicity — no nested transaction here.
   */
  async collectIn(
    m: EntityManager,
    dto: CollectFeeDto,
    actorId: string,
  ): Promise<PaymentCollection> {
    return this.postCollection(m, dto, actorId);
  }

  /* ================= MFS webhook (idempotent) ================= */

  async webhook(
    gateway: PaymentChannel,
    dto: MfsWebhookDto,
    actorId: string,
  ): Promise<{ duplicate: boolean; receipt: PaymentCollection }> {
    if (!MFS_CHANNELS.includes(gateway)) {
      throw new BadRequestException(`${gateway} is not an MFS channel`);
    }
    this.assertSignature(gateway, dto.gatewayTrxId, dto.signature);
    const existing = await this.receipts.findOne({
      where: { gatewayTrxId: dto.gatewayTrxId.trim() },
    });
    if (existing) return { duplicate: true, receipt: await this.findOne(existing.id) };
    const invoiceId = dto.invoiceId ?? (await this.oldestOpenInvoiceId(dto.studentId));
    const receipt = await this.dataSource.transaction('REPEATABLE READ', (m) =>
      this.postCollection(
        m,
        {
          studentId: dto.studentId,
          invoiceId,
          amount: dto.amount,
          paymentChannel: gateway,
          gatewayTrxId: dto.gatewayTrxId.trim(),
          tdrFee: dto.tdrFee ?? null,
          transactionDate: dto.transactionDate,
          remark: `MFS ${gateway} auto-post`,
        },
        actorId,
      ),
    );
    return { duplicate: false, receipt };
  }

  /* ================= settlement (clearing → bank) ================= */

  async settle(id: string, dto: SettleCollectionDto, actorId: string): Promise<PaymentCollection> {
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const repo = m.getRepository(PaymentCollection);
      const row = await repo.findOne({ where: { id } });
      if (!row) throw new NotFoundException(`Receipt #${id} not found`);
      if (row.reconciliationStatus === 'REVERSED') {
        throw new BadRequestException('Cannot settle a reversed receipt');
      }
      if (row.reconciliationStatus === 'SETTLED' || row.reconciliationStatus === 'COLLECTED') {
        throw new BadRequestException(
          row.reconciliationStatus === 'SETTLED'
            ? 'Receipt already settled'
            : 'Cash/bank receipts settle instantly — only MFS clearing (PENDING) needs settlement',
        );
      }
      const clearing = await m.getRepository(ChartOfAccount).findOne({
        where: { id: row.cashGlId },
      });
      if (!clearing) throw new BadRequestException('Clearing GL not found');
      const bankId = dto.bankGlId ?? (await this.glId(m, '11201'));
      const net = new Decimal(row.netBankAmount);
      if (net.lte(0)) throw new BadRequestException('Nothing left to settle on this receipt');
      const fundId = row.fundId ?? (await this.generalFundId(m));
      const txnDate = (dto.transactionDate ?? new Date().toISOString()).slice(0, 10);
      const journal = await this.posting.postSystemJournal(m, {
        voucherType: 'CONTRA',
        transactionDate: txnDate,
        narration: `MFS settlement ${row.moneyReceiptNo} → bank (${net.toFixed(2)})${dto.settlementRef ? ` ref ${dto.settlementRef}` : ''}`,
        sourceModule: 'MFS_COLLECTION',
        sourceReferenceId: row.id,
        actorId,
        lines: [
          {
            glAccountId: bankId, fundId, costCenterId: null,
            debitAmount: net.toFixed(2), creditAmount: '0.00',
            lineMemo: `Settle ${row.moneyReceiptNo}`,
          },
          {
            glAccountId: clearing.id, fundId, costCenterId: null,
            debitAmount: '0.00', creditAmount: net.toFixed(2),
            lineMemo: `Clear ${row.moneyReceiptNo}`,
          },
        ] as JournalLineDto[],
      });
      row.reconciliationStatus = 'SETTLED';
      row.settlementJournalId = journal.id;
      await repo.save(row);
      return this.findOneIn(m, row.id);
    });
  }

  /* ================= reversal (immutable correction) ================= */

  async reverse(id: string, reason: string, actorId: string): Promise<PaymentCollection> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A reversal reason (min 3 chars) is required');
    }
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const repo = m.getRepository(PaymentCollection);
      const row = await repo.findOne({ where: { id } });
      if (!row) throw new NotFoundException(`Receipt #${id} not found`);
      if (row.reconciliationStatus === 'REVERSED') {
        throw new BadRequestException('Receipt already reversed');
      }
      if (row.reconciliationStatus === 'SETTLED') {
        throw new BadRequestException(
          'Clearing already settled to the bank — reverse the CONTRA settlement voucher first',
        );
      }
      const journal = row.glJournalId
        ? await m.getRepository((await import('../database/entities/journal-entry.entity')).JournalEntry).findOne({
            where: { id: row.glJournalId },
            relations: ['lines'],
          })
        : null;
      if (journal?.lines) {
        await this.posting.postSystemJournal(m, {
          voucherType: 'JOURNAL',
          transactionDate: new Date().toISOString().slice(0, 10),
          narration: `REVERSAL of ${row.moneyReceiptNo}: ${reason.trim()}`,
          sourceModule: 'MFS_COLLECTION',
          sourceReferenceId: row.id,
          actorId,
          lines: journal.lines.map((l) => ({
            glAccountId: l.glAccountId,
            fundId: l.fundId,
            costCenterId: l.costCenterId,
            subledgerType: l.subledgerType,
            subledgerId: l.subledgerId,
            debitAmount: new Decimal(l.creditAmount).toFixed(2),
            creditAmount: new Decimal(l.debitAmount).toFixed(2),
            lineMemo: `Reversal ${row.moneyReceiptNo}`,
          })),
        });
      }
      // Roll the invoice paid_amount back (never below zero).
      const invRepo = m.getRepository(StudentInvoice);
      const inv = await invRepo.findOne({ where: { id: row.invoiceId } });
      if (inv) {
        const rolled = new Decimal(inv.paidAmount).minus(new Decimal(row.collectedGrossAmount));
        inv.paidAmount = Decimal.max(rolled, new Decimal(0)).toFixed(2);
        this.refreshStatus(inv);
        await invRepo.save(inv);
      }
      row.reconciliationStatus = 'REVERSED';
      await repo.save(row);
      return this.findOneIn(m, row.id);
    });
  }

  /* ================= internals ================= */

  private async postCollection(
    m: EntityManager,
    dto: CollectFeeDto,
    actorId: string,
  ): Promise<PaymentCollection> {
    const gross = this.dec(dto.amount, 'amount');
    if (new Decimal(gross).lte(0)) throw new BadRequestException('Collection amount must be positive');
    const invRepo = m.getRepository(StudentInvoice);
    const inv = await invRepo.findOne({
      where: { id: dto.invoiceId },
      relations: ['lines', 'lines.feeHead', 'lines.glAccount', 'lines.fund'],
    });
    if (!inv) throw new NotFoundException(`Invoice #${dto.invoiceId} not found`);
    if (inv.studentId !== dto.studentId) {
      throw new BadRequestException('Invoice belongs to a different student');
    }
    if (inv.status === 'REVERSED') throw new BadRequestException('Cannot collect against a reversed invoice');
    if (inv.status === 'PAID') throw new BadRequestException(`${inv.invoiceNo} is already fully paid`);

    const due = new Decimal(inv.netAmount).plus(new Decimal(inv.lateFineAmount)).minus(new Decimal(inv.paidAmount));
    if (new Decimal(gross).gt(due)) {
      throw new BadRequestException(
        `${inv.invoiceNo} due is ${due.toFixed(2)} — ${gross} overpays. Record the excess as advance tuition (21201) instead.`,
      );
    }

    const isMfs = MFS_CHANNELS.includes(dto.paymentChannel);
    // TDR: explicit override wins; else channel % × gross (cash = 0).
    let tdr = new Decimal(0);
    if (isMfs) {
      tdr =
        dto.tdrFee != null && String(dto.tdrFee).trim() !== ''
          ? new Decimal(this.dec(dto.tdrFee, 'tdrFee'))
          : new Decimal(gross).times(DEFAULT_TDR_PERCENT[dto.paymentChannel] ?? 1).div(100).toDecimalPlaces(2);
      if (tdr.lt(0) || tdr.gte(new Decimal(gross))) {
        throw new BadRequestException('TDR fee must be ≥ 0 and < gross amount');
      }
      if (!dto.gatewayTrxId?.trim()) {
        throw new BadRequestException(`${dto.paymentChannel} needs a gateway_trx_id (idempotency key)`);
      }
    } else if (dto.tdrFee != null && new Decimal(this.dec(dto.tdrFee, 'tdrFee')).gt(0)) {
      throw new BadRequestException('TDR applies to MFS channels only — cash/bank must post tdrFee 0');
    }
    const net = new Decimal(gross).minus(tdr);

    // Debit GL: explicit override → channel default (cash 11101,
    // challan 11201, MFS 1130x clearing). Must be cash/bank-class.
    const debitGl = await this.resolveDebitGl(m, dto);
    const tdrGl = isMfs && tdr.gt(0) ? await this.gl(m, '54103') : null;
    const arGl = await this.gl(m, '11401');
    const fundId = await this.generalFundId(m);

    // Per-fund AR split: credit each fund that was debited at invoice
    // time, proportional to its net share (keeps fund isolation exact).
    const netByFund = new Map<string, Decimal>();
    for (const l of inv.lines ?? []) {
      netByFund.set(l.fundId, (netByFund.get(l.fundId) ?? new Decimal(0)).plus(new Decimal(l.netAmount)));
    }
    const totalNet = [...netByFund.values()].reduce((t, v) => t.plus(v), new Decimal(0));
    const fundShares = [...netByFund.entries()].map(([fid, n]) => ({
      fundId: fid,
      share: totalNet.gt(0) ? n.div(totalNet) : new Decimal(1).div(netByFund.size || 1),
      costCenterId: inv.costCenterId ?? (inv.lines ?? []).find((l) => l.fundId === fid)?.costCenterId ?? null,
    }));
    const splitByShare = (total: Decimal): Array<{ fundId: string; costCenterId: string | null; amt: Decimal }> => {
      if (fundShares.length === 0) return [{ fundId, costCenterId: inv.costCenterId ?? null, amt: total }];
      // Largest-remainder rounding so the legs sum to the paisa.
      const legs = fundShares.map((f) => ({ ...f, amt: total.times(f.share).toDecimalPlaces(2, Decimal.ROUND_DOWN) }));
      let remainder = total.minus(legs.reduce((t, l) => t.plus(l.amt), new Decimal(0)));
      let i = 0;
      while (remainder.gt(0) && legs.length > 0) {
        legs[i % legs.length].amt = legs[i % legs.length].amt.plus('0.01');
        remainder = remainder.minus('0.01');
        i += 1;
      }
      return legs;
    };

    const lines: JournalLineDto[] = [];
    for (const leg of splitByShare(net)) {
      if (leg.amt.gt(0)) {
        lines.push({
          glAccountId: debitGl.id, fundId: leg.fundId, costCenterId: leg.costCenterId,
          debitAmount: leg.amt.toFixed(2), creditAmount: '0.00',
          lineMemo: `${dto.paymentChannel} ${inv.invoiceNo}`,
        });
      }
    }
    if (tdrGl && tdr.gt(0)) {
      for (const leg of splitByShare(tdr)) {
        if (leg.amt.gt(0)) {
          lines.push({
            glAccountId: tdrGl.id, fundId: leg.fundId, costCenterId: leg.costCenterId,
            debitAmount: leg.amt.toFixed(2), creditAmount: '0.00',
            lineMemo: `TDR ${dto.paymentChannel} ${inv.invoiceNo}`,
          });
        }
      }
    }
    for (const leg of splitByShare(new Decimal(gross))) {
      if (leg.amt.gt(0)) {
        lines.push({
          glAccountId: arGl.id, fundId: leg.fundId, costCenterId: leg.costCenterId,
          subledgerType: 'STUDENT', subledgerId: dto.studentId,
          debitAmount: '0.00', creditAmount: leg.amt.toFixed(2),
          lineMemo: `Collect ${inv.invoiceNo}`,
        });
      }
    }

    const txnDate = (dto.transactionDate ?? new Date().toISOString()).slice(0, 10);
    const journal = await this.posting.postSystemJournal(m, {
      voucherType: 'RECEIVE',
      transactionDate: txnDate,
      narration: `${dto.paymentChannel} collection ${inv.invoiceNo} — gross ${new Decimal(gross).toFixed(2)}${isMfs ? ` (TDR ${tdr.toFixed(2)})` : ''}${dto.bankReference ? ` ref ${dto.bankReference}` : ''}`,
      sourceModule: 'MFS_COLLECTION',
      actorId,
      lines,
    });

    // Header paid_amount + PARTIAL/PAID flip (pessimistic-safe in txn).
    inv.paidAmount = new Decimal(inv.paidAmount).plus(new Decimal(gross)).toFixed(2);
    this.refreshStatus(inv);
    await invRepo.save(inv);

    const receiptNo = journal.voucherNo.replace(/^(JV|PV|CV|RV)-/, 'MR-');
    const allocation = this.allocationSnapshot(inv, new Decimal(gross));
    const repo = m.getRepository(PaymentCollection);
    const saved = await repo.save(
      repo.create({
        moneyReceiptNo: receiptNo,
        studentId: dto.studentId,
        invoiceId: inv.id,
        paymentChannel: dto.paymentChannel,
        gatewayTrxId: dto.gatewayTrxId?.trim() || null,
        collectedGrossAmount: new Decimal(gross).toFixed(2),
        gatewayTdrFee: tdr.toFixed(2),
        netBankAmount: net.toFixed(2),
        cashGlId: debitGl.id,
        fundId: fundShares.length === 1 ? fundShares[0].fundId : null,
        reconciliationStatus: isMfs ? 'PENDING' : 'COLLECTED',
        glJournalId: journal.id,
        bankReference: dto.bankReference?.trim() || null,
        allocation: JSON.stringify(allocation),
        collectedByUserId: actorId,
        remark: dto.remark?.trim() || null,
      }),
    );
    journal.sourceReferenceId = saved.id;
    await m.getRepository((await import('../database/entities/journal-entry.entity')).JournalEntry).save(journal);
    return this.findOneIn(m, saved.id);
  }

  /**
   * Counter allocation order (plan §4.2): late fine → tuition (41101)
   * → other fee lines. Snapshot of THIS payment only — header
   * paid_amount stays the single source of truth for dues.
   */
  private allocationSnapshot(
    inv: StudentInvoice,
    gross: Decimal,
  ): Array<{ label: string; glCode: string; fundCode: string; amount: string }> {
    let remaining = gross;
    const out: Array<{ label: string; glCode: string; fundCode: string; amount: string }> = [];
    const take = (label: string, glCode: string, fundCode: string, cap: Decimal) => {
      if (remaining.lte(0)) return;
      const amt = Decimal.min(cap, remaining).toDecimalPlaces(2, Decimal.ROUND_DOWN);
      if (amt.lte(0)) return;
      out.push({ label, glCode, fundCode, amount: amt.toFixed(2) });
      remaining = remaining.minus(amt);
    };
    const net = new Decimal(inv.netAmount);
    const fine = new Decimal(inv.lateFineAmount);
    const paid = new Decimal(inv.paidAmount);
    // Prior payments (same fine-first order) already absorbed part of the
    // fine once paid spilled past net — only the remainder is still open.
    const fineRemaining = Decimal.max(fine.minus(Decimal.max(paid.minus(net), new Decimal(0))), new Decimal(0));
    take('Late fine', '42103', inv.lines?.[0]?.fund?.fundCode ?? '01', fineRemaining);
    // Spread the rest across fee lines pro-rata by net share so the legs
    // always sum to the paisa (largest-remainder rounding).
    const lines = [...(inv.lines ?? [])].sort((a, b) =>
      (a.glAccount?.glCode ?? '').localeCompare(b.glAccount?.glCode ?? ''),
    );
    const totalNet = lines.reduce((t, l) => t.plus(new Decimal(l.netAmount)), new Decimal(0));
    lines.forEach((l, idx) => {
      if (remaining.lte(0)) return;
      let cap: Decimal;
      if (idx === lines.length - 1) {
        cap = remaining;
      } else if (totalNet.gt(0)) {
        cap = remaining.times(new Decimal(l.netAmount).div(totalNet)).toDecimalPlaces(2, Decimal.ROUND_DOWN);
      } else {
        cap = new Decimal(0);
      }
      take(
        l.feeHead?.headCode ?? 'FEE',
        l.glAccount?.glCode ?? '',
        l.fund?.fundCode ?? '01',
        cap,
      );
    });
    // Rounding dust (≤ a paisa × lines) lands on the first fee leg.
    if (remaining.gt(0) && out.length > 0) {
      const firstFee = out.find((l) => l.label !== 'Late fine') ?? out[0];
      firstFee.amount = new Decimal(firstFee.amount).plus(remaining).toFixed(2);
      remaining = new Decimal(0);
    }
    return out;
  }

  private async resolveDebitGl(m: EntityManager, dto: CollectFeeDto) {
    const glRepo = m.getRepository(ChartOfAccount);
    if (dto.cashGlId) {
      const acct = await glRepo.findOne({ where: { id: dto.cashGlId } });
      if (!acct) throw new BadRequestException('cashGlId not found');
      if (!acct.isCashOrBank && !acct.glCode.startsWith('113')) {
        throw new BadRequestException(`${acct.glCode} is not a cash/bank/clearing account`);
      }
      return acct;
    }
    const code =
      dto.paymentChannel === 'BANK_CHALLAN'
        ? '11201'
        : (CLEARING_GL_BY_CHANNEL[dto.paymentChannel] ?? '11101');
    const acct = await glRepo.findOne({ where: { glCode: code } });
    if (!acct) throw new BadRequestException(`GL ${code} missing — run seed:accounting`);
    return acct;
  }

  private assertSignature(gateway: PaymentChannel, trxId: string, signature?: string | null): void {
    const secret = process.env[`WEBHOOK_SECRET_${gateway}`];
    if (!secret) return; // open mode (dev) — enforce when the secret is configured
    if (!signature || signature !== secret) {
      throw new BadRequestException(`Invalid webhook signature for ${gateway} trx ${trxId}`);
    }
  }

  private async oldestOpenInvoiceId(studentId: string): Promise<string> {
    const open = await this.dataSource.getRepository(StudentInvoice).find({
      where: { studentId },
      order: { dueDate: 'ASC' },
    });
    const first = open.find((i) => !['PAID', 'REVERSED'].includes(i.status));
    if (!first) throw new BadRequestException('Student has no open invoices to settle');
    return first.id;
  }

  private refreshStatus(inv: StudentInvoice): void {
    const due = new Decimal(inv.netAmount).plus(new Decimal(inv.lateFineAmount));
    const paid = new Decimal(inv.paidAmount);
    if (paid.gte(due) && due.gt(0)) inv.status = 'PAID';
    else if (paid.gt(0)) inv.status = 'PARTIAL';
    else if (inv.status === 'PAID') inv.status = 'UNPAID';
  }

  private async findOneIn(m: EntityManager, id: string): Promise<PaymentCollection> {
    const row = await m.getRepository(PaymentCollection).findOne({
      where: { id },
      relations: ['invoice', 'cashGl', 'fund', 'glJournal'],
    });
    if (!row) throw new NotFoundException(`Receipt #${id} not found`);
    return row;
  }

  private async gl(m: EntityManager, code: string): Promise<ChartOfAccount> {
    const acct = await m.getRepository(ChartOfAccount).findOne({ where: { glCode: code } });
    if (!acct) throw new BadRequestException(`GL ${code} missing — run seed:accounting`);
    return acct;
  }

  private async glId(m: EntityManager, code: string): Promise<string> {
    return (await this.gl(m, code)).id;
  }

  private async generalFundId(m: EntityManager): Promise<string> {
    const f = await m.getRepository(Fund).findOne({ where: { fundCode: '01' } });
    if (!f) throw new BadRequestException('Fund 01 (General) missing — run seed:accounting');
    return f.id;
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

/** Line type for the student-invoice relation (avoids circular import). */
export type { StudentInvoiceLine };
