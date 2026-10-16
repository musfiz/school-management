import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Prisma as PrismaTypes } from '../generated/prisma/client';
import {
  CLEARING_GL_BY_CHANNEL,
  DEFAULT_TDR_PERCENT,
  MFS_CHANNELS,
  type PaymentChannel,
} from '../database/entities/payment-collection.entity';
import { JournalPostingService } from './journal-posting.service';
import type { JournalLineDto } from './vouchers.dto';
import type { CollectFeeDto, MfsWebhookDto, SettleCollectionDto } from './collection.dto';

/* ---------------- relation includes + wire reshaping ---------------- */

const COLLECTION_INCLUDE = {
  studentInvoices: true,
  chartOfAccounts: true,
  funds: true,
  journalEntries: true,
} satisfies Prisma.PaymentCollectionsInclude;

const COLLECTION_DETAIL_INCLUDE = {
  studentInvoices: true,
  chartOfAccounts: true,
  funds: true,
  journalEntries: { include: { journalLines: true } },
} satisfies Prisma.PaymentCollectionsInclude;

const INVOICE_COLLECT_INCLUDE = {
  studentInvoiceLines: {
    include: { feeHeads: true, chartOfAccounts: true, funds: true },
  },
} satisfies Prisma.StudentInvoicesInclude;

type CollectionPayload = Prisma.PaymentCollectionsGetPayload<{ include: typeof COLLECTION_INCLUDE }>;
type CollectionDetailPayload = Prisma.PaymentCollectionsGetPayload<{
  include: typeof COLLECTION_DETAIL_INCLUDE;
}>;
type InvoiceCollectPayload = Prisma.StudentInvoicesGetPayload<{
  include: typeof INVOICE_COLLECT_INCLUDE;
}>;

function lineToWire<
  T extends { feeHeads?: unknown; chartOfAccounts?: unknown; funds?: unknown },
>(l: T) {
  const { feeHeads, chartOfAccounts, funds, ...rest } = l;
  return { ...rest, feeHead: feeHeads, glAccount: chartOfAccounts, fund: funds };
}

function invoiceToWire(inv: InvoiceCollectPayload): InvoiceCollectPayload {
  const { studentInvoiceLines, ...rest } = inv;
  return {
    ...(rest as InvoiceCollectPayload),
    lines: studentInvoiceLines.map(lineToWire),
  } as InvoiceCollectPayload;
}

type InvoiceWire = ReturnType<typeof invoiceToWire>;

function receiptToWire(r: CollectionPayload): CollectionPayload {
  const { studentInvoices, chartOfAccounts, funds, journalEntries, ...rest } = r;
  return {
    ...(rest as CollectionPayload),
    invoice: studentInvoices,
    cashGl: chartOfAccounts,
    fund: funds,
    glJournal: journalEntries,
  } as CollectionPayload;
}

function receiptToDetailWire(r: CollectionDetailPayload) {
  const { studentInvoices, chartOfAccounts, funds, journalEntries, ...rest } = r;
  let glJournal: unknown = journalEntries;
  if (journalEntries) {
    const { journalLines, ...jeRest } = journalEntries;
    glJournal = { ...jeRest, lines: journalLines };
  }
  return { ...rest, invoice: studentInvoices, cashGl: chartOfAccounts, fund: funds, glJournal };
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
 *
 * AD-P5/AD-P7: repositories → `PrismaService`; the transaction handle is a
 * `Prisma.TransactionClient`; relation names are remapped to the legacy wire
 * shape (`invoice`, `cashGl`, `fund`, `glJournal`).
 */
@Injectable()
export class FeeCollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: JournalPostingService,
  ) {}

  /* ================= queries ================= */

  async list(filters: { studentId?: string; status?: string; channel?: string; limit?: number }) {
    const where: Prisma.PaymentCollectionsWhereInput = {};
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.status) where.reconciliationStatus = filters.status;
    if (filters.channel) where.paymentChannel = filters.channel;
    const rows = await this.prisma.paymentCollections.findMany({
      where,
      include: COLLECTION_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 500),
    });
    return rows.map(receiptToWire);
  }

  async findOne(id: string) {
    const row = await this.prisma.paymentCollections.findUnique({
      where: { id },
      include: COLLECTION_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException(`Receipt #${id} not found`);
    return receiptToDetailWire(row);
  }

  /** POS lookup: open invoices + AR summary for one student. */
  async duesForStudent(studentId: string) {
    const invoices = await this.prisma.studentInvoices.findMany({
      where: { studentId },
      include: INVOICE_COLLECT_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
    const all = invoices.map(invoiceToWire);
    const open = all.filter((i) => !['PAID', 'REVERSED'].includes(i.status));
    const d = (s: Decimal.Value) => new Decimal(s);
    const due = open.reduce(
      (t, i) => t.plus(d(i.netAmount)).plus(d(i.lateFineAmount)).minus(d(i.paidAmount)),
      new Decimal(0),
    );
    return {
      studentId,
      open,
      all,
      summary: {
        openCount: open.length,
        totalDue: Decimal.max(due, new Decimal(0)).toFixed(2),
      },
    };
  }

  /* ================= counter / POS collection ================= */

  async collect(dto: CollectFeeDto, actorId: string) {
    // Idempotency: a retried POST with the same gateway ref returns the
    // original receipt instead of double-posting (plan §4 acceptance).
    if (dto.gatewayTrxId?.trim()) {
      const dup = await this.prisma.paymentCollections.findFirst({
        where: { gatewayTrxId: dto.gatewayTrxId.trim() },
      });
      if (dup) return this.findOne(dup.id);
    }
    return this.prisma.$transaction((tx) => this.postCollection(tx, dto, actorId), {
      isolationLevel: 'RepeatableRead',
    });
  }

  /**
   * Workflow 4 entry: same posting inside an OUTER (onboarding)
   * transaction. The caller owns atomicity — no nested transaction here.
   */
  async collectIn(tx: PrismaTypes.TransactionClient, dto: CollectFeeDto, actorId: string): Promise<CollectionPayload> {
    return this.postCollection(tx, dto, actorId);
  }

  /* ================= MFS webhook (idempotent) ================= */

  async webhook(gateway: PaymentChannel, dto: MfsWebhookDto, actorId: string) {
    if (!MFS_CHANNELS.includes(gateway)) {
      throw new BadRequestException(`${gateway} is not an MFS channel`);
    }
    this.assertSignature(gateway, dto.gatewayTrxId, dto.signature);
    const existing = await this.prisma.paymentCollections.findFirst({
      where: { gatewayTrxId: dto.gatewayTrxId.trim() },
    });
    if (existing) return { duplicate: true as const, receipt: await this.findOne(existing.id) };
    const invoiceId = dto.invoiceId ?? (await this.oldestOpenInvoiceId(dto.studentId));
    const receipt = await this.prisma.$transaction(
      (tx) =>
        this.postCollection(
          tx,
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
      { isolationLevel: 'RepeatableRead' },
    );
    return { duplicate: false as const, receipt };
  }

  /* ================= settlement (clearing → bank) ================= */

  async settle(id: string, dto: SettleCollectionDto, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.paymentCollections.findUnique({ where: { id } });
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
        const clearing = await tx.chartOfAccounts.findUnique({ where: { id: row.cashGlId } });
        if (!clearing) throw new BadRequestException('Clearing GL not found');
        const bankId = dto.bankGlId ?? (await this.glId(tx, '11201'));
        const net = new Decimal(row.netBankAmount);
        if (net.lte(0)) throw new BadRequestException('Nothing left to settle on this receipt');
        const fundId = row.fundId ?? (await this.generalFundId(tx));
        const txnDate = (dto.transactionDate ?? new Date().toISOString()).slice(0, 10);
        const journal = await this.posting.postSystemJournal(tx, {
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
        await tx.paymentCollections.update({
          where: { id: row.id },
          data: { reconciliationStatus: 'SETTLED', settlementJournalId: journal.id },
        });
        return this.findOneIn(tx, row.id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ================= reversal (immutable correction) ================= */

  async reverse(id: string, reason: string, actorId: string) {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A reversal reason (min 3 chars) is required');
    }
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.paymentCollections.findUnique({ where: { id } });
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
          ? await tx.journalEntries.findUnique({
              where: { id: row.glJournalId },
              include: { journalLines: true },
            })
          : null;
        if (journal?.journalLines?.length) {
          await this.posting.postSystemJournal(tx, {
            voucherType: 'JOURNAL',
            transactionDate: new Date().toISOString().slice(0, 10),
            narration: `REVERSAL of ${row.moneyReceiptNo}: ${reason.trim()}`,
            sourceModule: 'MFS_COLLECTION',
            sourceReferenceId: row.id,
            actorId,
            lines: journal.journalLines.map((l) => ({
              glAccountId: l.glAccountId,
              fundId: l.fundId,
              costCenterId: l.costCenterId,
              subledgerType: l.subledgerType as JournalLineDto['subledgerType'],
              subledgerId: l.subledgerId,
              debitAmount: new Decimal(l.creditAmount).toFixed(2),
              creditAmount: new Decimal(l.debitAmount).toFixed(2),
              lineMemo: `Reversal ${row.moneyReceiptNo}`,
            })),
          });
        }
        // Roll the invoice paid_amount back (never below zero).
        const inv = await tx.studentInvoices.findUnique({ where: { id: row.invoiceId } });
        if (inv) {
          const rolled = new Decimal(inv.paidAmount).minus(new Decimal(row.collectedGrossAmount));
          const paidAmount = Decimal.max(rolled, new Decimal(0)).toFixed(2);
          await tx.studentInvoices.update({
            where: { id: inv.id },
            data: {
              paidAmount,
              status: refreshedStatus(inv.status, inv.netAmount, inv.lateFineAmount, paidAmount),
            },
          });
        }
        await tx.paymentCollections.update({
          where: { id: row.id },
          data: { reconciliationStatus: 'REVERSED' },
        });
        return this.findOneIn(tx, row.id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ================= internals ================= */

  private async postCollection(
    tx: PrismaTypes.TransactionClient,
    dto: CollectFeeDto,
    actorId: string,
  ): Promise<CollectionPayload> {
    const gross = this.dec(dto.amount, 'amount');
    if (new Decimal(gross).lte(0)) throw new BadRequestException('Collection amount must be positive');
    const invRaw = await tx.studentInvoices.findUnique({
      where: { id: dto.invoiceId },
      include: INVOICE_COLLECT_INCLUDE,
    });
    if (!invRaw) throw new NotFoundException(`Invoice #${dto.invoiceId} not found`);
    const inv = invoiceToWire(invRaw);
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
    const debitGl = await this.resolveDebitGl(tx, dto);
    const tdrGl = isMfs && tdr.gt(0) ? await this.gl(tx, '54103') : null;
    const arGl = await this.gl(tx, '11401');
    const fundId = await this.generalFundId(tx);

    // Per-fund AR split: credit each fund that was debited at invoice
    // time, proportional to its net share (keeps fund isolation exact).
    const netByFund = new Map<string, Decimal>();
    for (const l of inv.studentInvoiceLines ?? []) {
      netByFund.set(l.fundId, (netByFund.get(l.fundId) ?? new Decimal(0)).plus(new Decimal(l.netAmount)));
    }
    const totalNet = [...netByFund.values()].reduce((t, v) => t.plus(v), new Decimal(0));
    const fundShares = [...netByFund.entries()].map(([fid, n]) => ({
      fundId: fid,
      share: totalNet.gt(0) ? n.div(totalNet) : new Decimal(1).div(netByFund.size || 1),
      costCenterId: inv.costCenterId ?? (inv.studentInvoiceLines ?? []).find((l) => l.fundId === fid)?.costCenterId ?? null,
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
    const journal = await this.posting.postSystemJournal(tx, {
      voucherType: 'RECEIVE',
      transactionDate: txnDate,
      narration: `${dto.paymentChannel} collection ${inv.invoiceNo} — gross ${new Decimal(gross).toFixed(2)}${isMfs ? ` (TDR ${tdr.toFixed(2)})` : ''}${dto.bankReference ? ` ref ${dto.bankReference}` : ''}`,
      sourceModule: 'MFS_COLLECTION',
      actorId,
      lines,
    });

    // Header paid_amount + PARTIAL/PAID flip (pessimistic-safe in txn).
    const paidAmount = new Decimal(inv.paidAmount).plus(new Decimal(gross)).toFixed(2);
    await tx.studentInvoices.update({
      where: { id: inv.id },
      data: {
        paidAmount,
        status: refreshedStatus(inv.status, inv.netAmount, inv.lateFineAmount, paidAmount),
      },
    });

    const receiptNo = journal.voucherNo.replace(/^(JV|PV|CV|RV)-/, 'MR-');
    const allocation = this.allocationSnapshot(inv, new Decimal(gross));
    const saved = await tx.paymentCollections.create({
      data: {
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
      },
    });
    await tx.journalEntries.update({
      where: { id: journal.id },
      data: { sourceReferenceId: saved.id },
    });
    return this.findOneIn(tx, saved.id);
  }

  /**
   * Counter allocation order (plan §4.2): late fine → tuition (41101)
   * → other fee lines. Snapshot of THIS payment only — header
   * paid_amount stays the single source of truth for dues.
   */
  private allocationSnapshot(
    inv: InvoiceWire,
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
    take('Late fine', '42103', inv.studentInvoiceLines?.[0]?.funds?.fundCode ?? '01', fineRemaining);
    // Spread the rest across fee lines pro-rata by net share so the legs
    // always sum to the paisa (largest-remainder rounding).
    const lines = [...(inv.studentInvoiceLines ?? [])].sort((a, b) =>
      (a.chartOfAccounts?.glCode ?? '').localeCompare(b.chartOfAccounts?.glCode ?? ''),
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
        l.feeHeads?.headCode ?? 'FEE',
        l.chartOfAccounts?.glCode ?? '',
        l.funds?.fundCode ?? '01',
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

  private async resolveDebitGl(tx: PrismaTypes.TransactionClient, dto: CollectFeeDto) {
    if (dto.cashGlId) {
      const acct = await tx.chartOfAccounts.findUnique({ where: { id: dto.cashGlId } });
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
    const acct = await tx.chartOfAccounts.findFirst({ where: { glCode: code } });
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
    const open = await this.prisma.studentInvoices.findMany({
      where: { studentId },
      orderBy: { dueDate: 'asc' },
    });
    const first = open.find((i) => !['PAID', 'REVERSED'].includes(i.status));
    if (!first) throw new BadRequestException('Student has no open invoices to settle');
    return first.id;
  }

  private async findOneIn(tx: PrismaTypes.TransactionClient, id: string): Promise<CollectionPayload> {
    const row = await tx.paymentCollections.findUnique({
      where: { id },
      include: COLLECTION_INCLUDE,
    });
    if (!row) throw new NotFoundException(`Receipt #${id} not found`);
    return receiptToWire(row);
  }

  private async gl(tx: PrismaTypes.TransactionClient, code: string) {
    const acct = await tx.chartOfAccounts.findFirst({ where: { glCode: code } });
    if (!acct) throw new BadRequestException(`GL ${code} missing — run seed:accounting`);
    return acct;
  }

  private async glId(tx: PrismaTypes.TransactionClient, code: string): Promise<string> {
    return (await this.gl(tx, code)).id;
  }

  private async generalFundId(tx: PrismaTypes.TransactionClient): Promise<string> {
    const f = await tx.funds.findFirst({ where: { fundCode: '01' } });
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
