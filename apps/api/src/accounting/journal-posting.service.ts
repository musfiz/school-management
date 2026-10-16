import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Prisma as PrismaTypes } from '../generated/prisma/client';
import { toDateOnly, toDateValue } from '../prisma/wire';
import { UserRole } from '../database/entities/user-role.enum';
import { VoucherSequenceService } from './voucher-sequence.service';
import {
  CreateJournalEntryDto,
  UpdateJournalDraftDto,
  type JournalLineDto,
} from './vouchers.dto';

interface CheckedLine extends JournalLineDto {
  debit: Decimal;
  credit: Decimal;
}

/** Detail include — matches TypeORM `relations: ['lines', 'lines.glAccount', 'lines.fund', 'lines.costCenter', 'fiscalPeriod']`. */
const ENTRY_INCLUDE_ORDERED = {
  fiscalPeriods: true,
  journalLines: {
    include: { chartOfAccounts: true, funds: true, costCenters: true },
    orderBy: { debitAmount: 'desc' },
  },
} satisfies Prisma.JournalEntriesInclude;

const ENTRY_INCLUDE_PLAIN = {
  fiscalPeriods: true,
  journalLines: {
    include: { chartOfAccounts: true, funds: true, costCenters: true },
  },
} satisfies Prisma.JournalEntriesInclude;

const ENTRY_LIST_INCLUDE = { fiscalPeriods: true } satisfies Prisma.JournalEntriesInclude;

type EntryFullPayload = Prisma.JournalEntriesGetPayload<{ include: typeof ENTRY_INCLUDE_PLAIN }>;
type EntryListPayload = Prisma.JournalEntriesGetPayload<{ include: typeof ENTRY_LIST_INCLUDE }>;

/**
 * Reshape a Prisma entry (relation names are pluralised) back to the legacy
 * TypeORM shape the controllers/clients expect: `lines` (with `glAccount`,
 * `fund`, `costCenter`) and `fiscalPeriod`.
 */
function entryToWire(entry: EntryFullPayload) {
  const { fiscalPeriods, journalLines, ...rest } = entry;
  return {
    ...rest,
    fiscalPeriod: fiscalPeriods,
    lines: journalLines.map(({ chartOfAccounts, funds, costCenters, ...line }) => ({
      ...line,
      glAccount: chartOfAccounts,
      fund: funds,
      costCenter: costCenters,
    })),
  };
}

function entryToListWire(entry: EntryListPayload) {
  const { fiscalPeriods, ...rest } = entry;
  return { ...rest, fiscalPeriod: fiscalPeriods };
}

export type JournalEntryWire = ReturnType<typeof entryToWire>;
export type JournalEntryListWire = ReturnType<typeof entryToListWire>;

/**
 * Immutable double-entry posting engine (Phase 2, plan §3 Phase 2).
 *
 * Validation rules (all throw `BadRequestException`):
 *  1. Zero-sum — ΣDr must equal ΣCr and be positive.
 *  2. Line exclusivity — exactly one side positive per line, no negatives.
 *  3. Strict fund isolation — every fund_id in the voucher must zero-sum
 *     on its own (blocks paying General expenses from the Zakat account).
 *  4. Control-account sub-ledger — lines on a control account (e.g. 11401
 *     Student AR) require `subledgerType` + `subledgerId`.
 *  5. Period lock — the transaction date must fall in an open fiscal period.
 *
 * APPROVED entries are immutable: no update, no delete — only a linked
 * REVERSAL mirror entry (spec §1.7 no-delete policy).
 *
 * AD-P5/AD-P7: the transaction handle is a `Prisma.TransactionClient` and
 * every write path runs under `REPEATABLE READ` (same as TypeORM).
 */
@Injectable()
export class JournalPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: VoucherSequenceService,
  ) {}

  /* ---------------- queries ---------------- */

  async findAll(filters: {
    status?: string;
    voucherType?: string;
    search?: string;
    limit?: number;
  }): Promise<JournalEntryListWire[]> {
    const where: Prisma.JournalEntriesWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.voucherType) where.voucherType = filters.voucherType;
    if (filters.search) {
      where.OR = [
        { voucherNo: { contains: filters.search } },
        { narration: { contains: filters.search } },
      ];
    }
    const entries = await this.prisma.journalEntries.findMany({
      where,
      include: ENTRY_LIST_INCLUDE,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(filters.limit ?? 100, 1), 500),
    });
    return entries.map(entryToListWire);
  }

  async findOne(id: string): Promise<JournalEntryWire> {
    const entry = await this.prisma.journalEntries.findUnique({
      where: { id },
      include: ENTRY_INCLUDE_ORDERED,
    });
    if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
    return entryToWire(entry);
  }

  /* ---------------- maker: create draft ---------------- */

  async createDraft(dto: CreateJournalEntryDto, makerId: string): Promise<JournalEntryWire> {
    return this.prisma.$transaction(
      async (tx) => {
        const lines = await this.checkLines(tx, dto.lines);
        const period = await this.resolvePeriod(tx, dto.transactionDate, dto.fiscalPeriodId);
        const voucherNo = await this.sequences.nextVoucherNo(
          tx,
          dto.voucherType,
          dto.transactionDate,
        );
        const saved = await tx.journalEntries.create({
          data: {
            voucherNo,
            voucherType: dto.voucherType,
            transactionDate: toDateValue(dto.transactionDate.slice(0, 10)),
            fiscalPeriodId: period.id,
            sourceModule: dto.sourceModule ?? 'MANUAL',
            sourceReferenceId: dto.sourceReferenceId ?? null,
            narration: dto.narration.trim(),
            status: 'DRAFT',
            createdByUserId: makerId,
          },
        });
        await tx.journalLines.createMany({ data: lines.map((l) => this.lineData(saved.id, l)) });
        return this.findOneIn(tx, saved.id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ---------------- maker: edit draft ---------------- */

  async updateDraft(
    id: string,
    dto: UpdateJournalDraftDto,
    userId: string,
  ): Promise<JournalEntryWire> {
    return this.prisma.$transaction(
      async (tx) => {
        const entry = await tx.journalEntries.findUnique({ where: { id } });
        if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
        if (entry.status !== 'DRAFT') {
          throw new ForbiddenException(`Only DRAFT vouchers can be edited (${entry.status})`);
        }
        const txnDate = (dto.transactionDate ?? toDateOnly(entry.transactionDate)).slice(0, 10);
        const period = await this.resolvePeriod(tx, txnDate, dto.fiscalPeriodId);
        if (dto.lines) {
          const lines = await this.checkLines(tx, dto.lines);
          await tx.journalLines.deleteMany({ where: { journalEntryId: id } });
          await tx.journalLines.createMany({ data: lines.map((l) => this.lineData(id, l)) });
        }
        await tx.journalEntries.update({
          where: { id },
          data: {
            transactionDate: toDateValue(txnDate),
            fiscalPeriodId: period.id,
            ...(dto.narration !== undefined ? { narration: dto.narration.trim() } : {}),
          },
        });
        void userId;
        return this.findOneIn(tx, id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ---------------- maker: delete draft ---------------- */

  async deleteDraft(id: string): Promise<{ deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntries.findUnique({ where: { id } });
      if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
      if (entry.status !== 'DRAFT') {
        throw new ForbiddenException(
          `Only DRAFT vouchers can be deleted — ${entry.voucherNo} is ${entry.status} (post a REVERSAL instead)`,
        );
      }
      // Lines cascade-delete via FK; the delete itself is blocked above
      // for anything past DRAFT (no-delete policy, spec §1.7).
      await tx.journalEntries.delete({ where: { id } });
      return { deleted: true as const };
    });
  }

  /* ---------------- checker: verify ---------------- */

  async verify(id: string, checkerId: string): Promise<JournalEntryWire> {
    return this.prisma.$transaction(
      async (tx) => {
        const entry = await tx.journalEntries.findUnique({
          where: { id },
          include: { journalLines: true },
        });
        if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
        if (entry.status !== 'DRAFT') {
          throw new BadRequestException(`Only DRAFT vouchers can be verified (${entry.status})`);
        }
        if (entry.createdByUserId === checkerId) {
          throw new ForbiddenException('Maker cannot verify their own voucher (checker must differ)');
        }
        const makerRole = await this.roleOf(tx, entry.createdByUserId, 'Maker');
        const checkerRole = await this.roleOf(tx, checkerId, 'Checker');
        // Admin-superior priority: an admin-created voucher advances by admins only.
        this.assertAdminSuperior(checkerRole, makerRole === UserRole.ADMIN, 'verify');
        await this.recheckStoredLines(tx, entry.id);
        await tx.journalEntries.update({
          where: { id },
          data: { status: 'VERIFIED', verifiedByUserId: checkerId },
        });
        return this.findOneIn(tx, id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ---------------- approver: approve ---------------- */

  async approve(id: string, approverId: string): Promise<JournalEntryWire> {
    return this.prisma.$transaction(
      async (tx) => {
        const entry = await tx.journalEntries.findUnique({
          where: { id },
          include: { journalLines: true },
        });
        if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
        if (entry.status !== 'VERIFIED') {
          throw new BadRequestException(`Only VERIFIED vouchers can be approved (${entry.status})`);
        }
        if (entry.createdByUserId === approverId) {
          throw new ForbiddenException('Maker cannot approve their own voucher');
        }
        if (entry.verifiedByUserId === approverId) {
          throw new ForbiddenException('Checker cannot also approve the same voucher');
        }
        const makerRole = await this.roleOf(tx, entry.createdByUserId, 'Maker');
        const verifierRole = entry.verifiedByUserId
          ? await this.roleOf(tx, entry.verifiedByUserId, 'Checker')
          : null;
        const approverRole = await this.roleOf(tx, approverId, 'Approver');
        // Admin-superior priority: anything an admin made or checked is approved by admins only.
        this.assertAdminSuperior(
          approverRole,
          makerRole === UserRole.ADMIN || verifierRole === UserRole.ADMIN,
          'approve',
        );
        // Re-run every rule inside the commit transaction (period may have
        // been closed between verify and approve).
        await this.recheckStoredLines(tx, entry.id);
        await tx.journalEntries.update({
          where: { id },
          data: { status: 'APPROVED', approvedByUserId: approverId, approvedAt: new Date() },
        });
        return this.findOneIn(tx, id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ---------------- approver: reverse (immutable correction) ---------------- */

  async reverse(id: string, approverId: string, reason: string): Promise<JournalEntryWire> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A reversal reason (min 3 chars) is required');
    }
    return this.prisma.$transaction(
      async (tx) => {
        const original = await tx.journalEntries.findUnique({
          where: { id },
          include: { journalLines: true },
        });
        if (!original) throw new NotFoundException(`Voucher #${id} not found`);
        if (original.status !== 'APPROVED') {
          throw new BadRequestException(
            `Only APPROVED vouchers can be reversed (${original.status})`,
          );
        }
        const actorRole = await this.roleOf(tx, approverId, 'Reverser');
        const makerRole = await this.roleOf(tx, original.createdByUserId, 'Maker');
        const verifierRole = original.verifiedByUserId
          ? await this.roleOf(tx, original.verifiedByUserId, 'Checker')
          : null;
        const approverRole = original.approvedByUserId
          ? await this.roleOf(tx, original.approvedByUserId, 'Approver')
          : null;
        // Same superiority chain as approve: admin-involved vouchers reverse by admins only.
        this.assertAdminSuperior(
          actorRole,
          makerRole === UserRole.ADMIN ||
            verifierRole === UserRole.ADMIN ||
            approverRole === UserRole.ADMIN,
          'reverse',
        );
        const period = await this.resolvePeriod(tx, toDateOnly(original.transactionDate));
        const voucherNo = await this.sequences.nextVoucherNo(
          tx,
          'REVERSAL',
          toDateOnly(original.transactionDate),
        );
        const savedMirror = await tx.journalEntries.create({
          data: {
            voucherNo,
            voucherType: 'REVERSAL',
            transactionDate: original.transactionDate,
            fiscalPeriodId: period.id,
            sourceModule: original.sourceModule,
            sourceReferenceId: original.id,
            narration: `REVERSAL of ${original.voucherNo}: ${reason.trim()}`,
            status: 'APPROVED',
            createdByUserId: approverId,
            verifiedByUserId: approverId,
            approvedByUserId: approverId,
            approvedAt: new Date(),
          },
        });
        await tx.journalLines.createMany({
          data: (original.journalLines ?? []).map((l) => ({
            journalEntryId: savedMirror.id,
            glAccountId: l.glAccountId,
            fundId: l.fundId,
            costCenterId: l.costCenterId,
            subledgerType: l.subledgerType,
            subledgerId: l.subledgerId,
            // Mirror image: debits become credits and vice versa.
            debitAmount: new Decimal(l.creditAmount).toFixed(2),
            creditAmount: new Decimal(l.debitAmount).toFixed(2),
            lineMemo: l.lineMemo,
          })),
        });
        await tx.journalEntries.update({
          where: { id: original.id },
          data: { status: 'REVERSED', reversedEntryId: savedMirror.id },
        });
        return this.findOneIn(tx, savedMirror.id);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ---------------- system auto-post (STUDENT_BILLING etc.) ---------------- */

  /**
   * System posting inside the caller's transaction (Phase 3 accrual billing,
   * Phase 4 collections). Runs the same 5 validation rules as manual drafts
   * but persists the entry straight to APPROVED with maker/checker/approver
   * all set to the triggering user — system postings never sit in DRAFT.
   */
  async postSystemJournal(
    tx: PrismaTypes.TransactionClient,
    args: {
      voucherType: 'JOURNAL' | 'RECEIVE' | 'PAYMENT' | 'CONTRA';
      transactionDate: string;
      narration: string;
      sourceModule:
        | 'STUDENT_BILLING'
        | 'MFS_COLLECTION'
        | 'PAYROLL'
        | 'PROCUREMENT'
        | 'ADMISSION'
        | 'MANUAL';
      sourceReferenceId?: string | null;
      actorId: string;
      lines: JournalLineDto[];
    },
  ): Promise<JournalEntryWire> {
    const lines = await this.checkLines(tx, args.lines);
    const period = await this.resolvePeriod(tx, args.transactionDate);
    const voucherNo = await this.sequences.nextVoucherNo(
      tx,
      args.voucherType,
      args.transactionDate,
    );
    const saved = await tx.journalEntries.create({
      data: {
        voucherNo,
        voucherType: args.voucherType,
        transactionDate: toDateValue(args.transactionDate.slice(0, 10)),
        fiscalPeriodId: period.id,
        sourceModule: args.sourceModule,
        sourceReferenceId: args.sourceReferenceId ?? null,
        narration: args.narration.trim(),
        status: 'APPROVED',
        createdByUserId: args.actorId,
        verifiedByUserId: args.actorId,
        approvedByUserId: args.actorId,
        approvedAt: new Date(),
      },
    });
    await tx.journalLines.createMany({ data: lines.map((l) => this.lineData(saved.id, l)) });
    return this.findOneIn(tx, saved.id);
  }

  /* ---------------- rule engine ---------------- */

  /** Role lookup inside the caller's transaction (hierarchy enforcement). */
  private async roleOf(
    tx: PrismaTypes.TransactionClient,
    userId: string,
    who: string,
  ): Promise<UserRole> {
    const user = await tx.users.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`${who} user not found`);
    return user.role as unknown as UserRole;
  }

  /**
   * Admin-superior priority: once an admin has made or checked a voucher,
   * only an admin may advance it. Admins themselves may always act.
   */
  private assertAdminSuperior(actorRole: UserRole, involvedAdmin: boolean, action: string): void {
    if (involvedAdmin && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        `Only an admin can ${action} a voucher created or checked by an admin (admin has superior approval priority)`,
      );
    }
  }

  /** Shape one checked line into a `journal_lines` insert. */
  private lineData(entryId: string, l: CheckedLine) {
    return {
      journalEntryId: entryId,
      glAccountId: l.glAccountId,
      fundId: l.fundId,
      costCenterId: l.costCenterId ?? null,
      subledgerType: l.subledgerType ?? null,
      subledgerId: l.subledgerId ?? null,
      debitAmount: l.debit.toFixed(2),
      creditAmount: l.credit.toFixed(2),
      lineMemo: l.lineMemo ?? null,
    };
  }

  /** Full validation of incoming DTO lines (masters + 5 posting rules). */
  private async checkLines(
    tx: PrismaTypes.TransactionClient,
    dtos: JournalLineDto[],
  ): Promise<CheckedLine[]> {
    if (!dtos || dtos.length < 2) {
      throw new BadRequestException('A voucher needs at least two lines');
    }

    const checked: CheckedLine[] = [];
    for (const [i, dto] of dtos.entries()) {
      const tag = `Line ${i + 1}`;
      const account = await tx.chartOfAccounts.findUnique({ where: { id: dto.glAccountId } });
      if (!account) throw new BadRequestException(`${tag}: GL account not found`);
      if (!account.isActive) {
        throw new BadRequestException(`${tag}: ${account.glCode} is inactive`);
      }
      const fund = await tx.funds.findUnique({ where: { id: dto.fundId } });
      if (!fund) throw new BadRequestException(`${tag}: fund not found`);
      if (fund.isActive === false) {
        throw new BadRequestException(`${tag}: fund "${fund.fundCode}" is inactive`);
      }
      if (dto.costCenterId) {
        const center = await tx.costCenters.findUnique({ where: { id: dto.costCenterId } });
        if (!center) throw new BadRequestException(`${tag}: cost center not found`);
        if (center.isActive === false) {
          throw new BadRequestException(`${tag}: cost center "${center.centerCode}" is inactive`);
        }
      }
      // Rule 4 — control-account sub-ledger enforcement.
      if (account.isControlAccount) {
        if (!dto.subledgerType || !dto.subledgerId) {
          throw new BadRequestException(
            `${tag}: ${account.glCode} is a control account — subledgerType and subledgerId are required`,
          );
        }
      } else if (dto.subledgerType || dto.subledgerId) {
        throw new BadRequestException(
          `${tag}: ${account.glCode} is not a control account — sub-ledger reference not allowed`,
        );
      }
      // Rule 2 — line exclusivity (exactly one positive side, no negatives).
      const debit = this.parseAmount(`${tag} debit`, dto.debitAmount);
      const credit = this.parseAmount(`${tag} credit`, dto.creditAmount);
      const drPos = debit.gt(0);
      const crPos = credit.gt(0);
      if (drPos === crPos) {
        throw new BadRequestException(
          `${tag}: exactly one of debit / credit must be positive (got Dr ${debit.toFixed(2)}, Cr ${credit.toFixed(2)})`,
        );
      }
      checked.push({ ...dto, debit, credit });
    }

    // Rule 1 — voucher zero-sum.
    const totalDr = checked.reduce((s, l) => s.plus(l.debit), new Decimal(0));
    const totalCr = checked.reduce((s, l) => s.plus(l.credit), new Decimal(0));
    if (totalDr.lte(0)) {
      throw new BadRequestException('Voucher total must be positive');
    }
    if (!totalDr.equals(totalCr)) {
      throw new BadRequestException(
        `Unbalanced voucher: total Dr ${totalDr.toFixed(2)} ≠ total Cr ${totalCr.toFixed(2)}`,
      );
    }

    // Rule 3 — strict per-fund isolation.
    const byFund = new Map<string, { dr: Decimal; cr: Decimal }>();
    for (const l of checked) {
      const agg = byFund.get(l.fundId) ?? { dr: new Decimal(0), cr: new Decimal(0) };
      byFund.set(l.fundId, { dr: agg.dr.plus(l.debit), cr: agg.cr.plus(l.credit) });
    }
    for (const [fundId, agg] of byFund) {
      if (!agg.dr.equals(agg.cr)) {
        throw new BadRequestException(
          `Cross-fund leak blocked: fund #${fundId} has Dr ${agg.dr.toFixed(2)} ≠ Cr ${agg.cr.toFixed(2)} — every fund must balance on its own`,
        );
      }
    }
    return checked;
  }

  /** Re-validate already-stored lines (verify/approve race against period close). */
  private async recheckStoredLines(
    tx: PrismaTypes.TransactionClient,
    entryId: string,
  ): Promise<void> {
    const entry = await tx.journalEntries.findUnique({
      where: { id: entryId },
      include: { journalLines: true },
    });
    if (!entry) throw new NotFoundException(`Voucher #${entryId} not found`);
    await this.resolvePeriod(tx, toDateOnly(entry.transactionDate), entry.fiscalPeriodId);
    await this.checkLines(
      tx,
      (entry.journalLines ?? []).map((l) => ({
        glAccountId: l.glAccountId,
        fundId: l.fundId,
        costCenterId: l.costCenterId,
        subledgerType: l.subledgerType as JournalLineDto['subledgerType'],
        subledgerId: l.subledgerId,
        debitAmount: String(l.debitAmount),
        creditAmount: String(l.creditAmount),
        lineMemo: l.lineMemo,
      })),
    );
  }

  /** Rule 5 — resolve the open fiscal period for a transaction date. */
  private async resolvePeriod(
    tx: PrismaTypes.TransactionClient,
    transactionDate: string,
    explicitId?: string,
  ): Promise<{ id: string }> {
    const day = transactionDate.slice(0, 10);
    let period: { id: string; periodName: string; startDate: Date; endDate: Date; isClosed: boolean } | null;
    if (explicitId) {
      const found = await tx.fiscalPeriods.findUnique({ where: { id: explicitId } });
      if (!found) throw new BadRequestException('Fiscal period not found');
      period = found;
      if (day < toDateOnly(period.startDate) || day > toDateOnly(period.endDate)) {
        throw new BadRequestException(
          `Transaction date ${day} is outside fiscal period "${period.periodName}"`,
        );
      }
    } else {
      period = await tx.fiscalPeriods.findFirst({
        where: {
          startDate: { lte: toDateValue(day) },
          endDate: { gte: toDateValue(day) },
        },
      });
      if (!period) {
        throw new BadRequestException(`No fiscal period covers transaction date ${day}`);
      }
    }
    if (period.isClosed) {
      throw new BadRequestException(
        `Fiscal period "${period.periodName}" is closed — posting blocked (period lock)`,
      );
    }
    return period;
  }

  private parseAmount(tag: string, raw: unknown): Decimal {
    let dec: Decimal;
    try {
      dec = new Decimal(String(raw ?? '0').trim() === '' ? '0' : String(raw));
    } catch {
      throw new BadRequestException(`${tag} amount "${raw}" is not a valid decimal`);
    }
    if (!dec.isFinite()) throw new BadRequestException(`${tag} amount must be finite`);
    if (dec.isNegative()) throw new BadRequestException(`${tag} amount cannot be negative`);
    if (dec.dp() > 2) throw new BadRequestException(`${tag} amount allows at most 2 decimals`);
    if (dec.gt(9999999999999.99)) {
      throw new BadRequestException(`${tag} amount exceeds DECIMAL(15,2)`);
    }
    return dec;
  }

  private async findOneIn(
    tx: PrismaTypes.TransactionClient,
    id: string,
  ): Promise<JournalEntryWire> {
    const entry = await tx.journalEntries.findUnique({
      where: { id },
      include: ENTRY_INCLUDE_PLAIN,
    });
    if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
    return entryToWire(entry);
  }
}
