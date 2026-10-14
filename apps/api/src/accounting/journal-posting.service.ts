import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalLine } from '../database/entities/journal-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { Fund } from '../database/entities/fund.entity';
import { CostCenter } from '../database/entities/cost-center.entity';
import { FiscalPeriod } from '../database/entities/fiscal-period.entity';
import { User } from '../database/entities/user.entity';
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
 */
@Injectable()
export class JournalPostingService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(JournalEntry)
    private readonly entryRepo: Repository<JournalEntry>,
    private readonly sequences: VoucherSequenceService,
  ) {}

  /* ---------------- queries ---------------- */

  findAll(filters: { status?: string; voucherType?: string; search?: string; limit?: number }) {
    const qb = this.entryRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.fiscalPeriod', 'fiscalPeriod')
      .orderBy('e.transactionDate', 'DESC')
      .addOrderBy('e.createdAt', 'DESC')
      .take(Math.min(Math.max(filters.limit ?? 100, 1), 500));
    if (filters.status) qb.andWhere('e.status = :status', { status: filters.status });
    if (filters.voucherType) qb.andWhere('e.voucherType = :t', { t: filters.voucherType });
    if (filters.search) {
      qb.andWhere('(e.voucherNo LIKE :s OR e.narration LIKE :s)', { s: `%${filters.search}%` });
    }
    return qb.getMany();
  }

  async findOne(id: string): Promise<JournalEntry> {
    const entry = await this.entryRepo.findOne({
      where: { id },
      relations: [
        'lines',
        'lines.glAccount',
        'lines.fund',
        'lines.costCenter',
        'fiscalPeriod',
      ],
      order: { lines: { debitAmount: 'DESC' } },
    });
    if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
    return entry;
  }

  /* ---------------- maker: create draft ---------------- */

  async createDraft(dto: CreateJournalEntryDto, makerId: string): Promise<JournalEntry> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const lines = await this.checkLines(manager, dto.lines);
      const period = await this.resolvePeriod(manager, dto.transactionDate, dto.fiscalPeriodId);
      const voucherNo = await this.sequences.nextVoucherNo(
        manager,
        dto.voucherType,
        dto.transactionDate,
      );
      const entry = manager.getRepository(JournalEntry).create({
        voucherNo,
        voucherType: dto.voucherType,
        transactionDate: dto.transactionDate.slice(0, 10),
        fiscalPeriodId: period.id,
        sourceModule: dto.sourceModule ?? 'MANUAL',
        sourceReferenceId: dto.sourceReferenceId ?? null,
        narration: dto.narration.trim(),
        status: 'DRAFT',
        createdByUserId: makerId,
      });
      const saved = await manager.getRepository(JournalEntry).save(entry);
      await manager.getRepository(JournalLine).save(
        lines.map((l) =>
          manager.getRepository(JournalLine).create({
            journalEntryId: saved.id,
            glAccountId: l.glAccountId,
            fundId: l.fundId,
            costCenterId: l.costCenterId ?? null,
            subledgerType: l.subledgerType ?? null,
            subledgerId: l.subledgerId ?? null,
            debitAmount: l.debit.toFixed(2),
            creditAmount: l.credit.toFixed(2),
            lineMemo: l.lineMemo ?? null,
          }),
        ),
      );
      return this.findOneIn(manager, saved.id);
    });
  }

  /* ---------------- maker: edit draft ---------------- */

  async updateDraft(id: string, dto: UpdateJournalDraftDto, userId: string): Promise<JournalEntry> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const repo = manager.getRepository(JournalEntry);
      const entry = await repo.findOne({ where: { id } });
      if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
      if (entry.status !== 'DRAFT') {
        throw new ForbiddenException(`Only DRAFT vouchers can be edited (${entry.status})`);
      }
      const txnDate = (dto.transactionDate ?? entry.transactionDate).slice(0, 10);
      const period = await this.resolvePeriod(manager, txnDate, dto.fiscalPeriodId);
      if (dto.lines) {
        const lines = await this.checkLines(manager, dto.lines);
        await manager.getRepository(JournalLine).delete({ journalEntryId: id });
        await manager.getRepository(JournalLine).save(
          lines.map((l) =>
            manager.getRepository(JournalLine).create({
              journalEntryId: id,
              glAccountId: l.glAccountId,
              fundId: l.fundId,
              costCenterId: l.costCenterId ?? null,
              subledgerType: l.subledgerType ?? null,
              subledgerId: l.subledgerId ?? null,
              debitAmount: l.debit.toFixed(2),
              creditAmount: l.credit.toFixed(2),
              lineMemo: l.lineMemo ?? null,
            }),
          ),
        );
      }
      entry.transactionDate = txnDate;
      entry.fiscalPeriodId = period.id;
      if (dto.narration !== undefined) entry.narration = dto.narration.trim();
      await repo.save(entry);
      void userId;
      return this.findOneIn(manager, id);
    });
  }

  /* ---------------- maker: delete draft ---------------- */

  async deleteDraft(id: string): Promise<{ deleted: true }> {
    return this.dataSource.transaction(async (manager) => {
      const entry = await manager.getRepository(JournalEntry).findOne({ where: { id } });
      if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
      if (entry.status !== 'DRAFT') {
        throw new ForbiddenException(
          `Only DRAFT vouchers can be deleted — ${entry.voucherNo} is ${entry.status} (post a REVERSAL instead)`,
        );
      }
      // Lines cascade-delete via FK; the delete itself is blocked above
      // for anything past DRAFT (no-delete policy, spec §1.7).
      await manager.getRepository(JournalEntry).delete(id);
      return { deleted: true as const };
    });
  }

  /* ---------------- checker: verify ---------------- */

  async verify(id: string, checkerId: string): Promise<JournalEntry> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const repo = manager.getRepository(JournalEntry);
      const entry = await repo.findOne({ where: { id }, relations: ['lines'] });
      if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
      if (entry.status !== 'DRAFT') {
        throw new BadRequestException(`Only DRAFT vouchers can be verified (${entry.status})`);
      }
      if (entry.createdByUserId === checkerId) {
        throw new ForbiddenException('Maker cannot verify their own voucher (checker must differ)');
      }
      const makerRole = await this.roleOf(manager, entry.createdByUserId, 'Maker');
      const checkerRole = await this.roleOf(manager, checkerId, 'Checker');
      // Admin-superior priority: an admin-created voucher advances by admins only.
      this.assertAdminSuperior(checkerRole, makerRole === UserRole.ADMIN, 'verify');
      await this.recheckStoredLines(manager, entry.id);
      entry.status = 'VERIFIED';
      entry.verifiedByUserId = checkerId;
      await repo.save(entry);
      return this.findOneIn(manager, id);
    });
  }

  /* ---------------- approver: approve ---------------- */

  async approve(id: string, approverId: string): Promise<JournalEntry> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const repo = manager.getRepository(JournalEntry);
      const entry = await repo.findOne({ where: { id }, relations: ['lines'] });
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
      const makerRole = await this.roleOf(manager, entry.createdByUserId, 'Maker');
      const verifierRole = entry.verifiedByUserId
        ? await this.roleOf(manager, entry.verifiedByUserId, 'Checker')
        : null;
      const approverRole = await this.roleOf(manager, approverId, 'Approver');
      // Admin-superior priority: anything an admin made or checked is approved by admins only.
      this.assertAdminSuperior(
        approverRole,
        makerRole === UserRole.ADMIN || verifierRole === UserRole.ADMIN,
        'approve',
      );
      // Re-run every rule inside the commit transaction (period may have
      // been closed between verify and approve).
      await this.recheckStoredLines(manager, entry.id);
      entry.status = 'APPROVED';
      entry.approvedByUserId = approverId;
      entry.approvedAt = new Date();
      await repo.save(entry);
      return this.findOneIn(manager, id);
    });
  }

  /* ---------------- approver: reverse (immutable correction) ---------------- */

  async reverse(id: string, approverId: string, reason: string): Promise<JournalEntry> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A reversal reason (min 3 chars) is required');
    }
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const repo = manager.getRepository(JournalEntry);
      const original = await repo.findOne({ where: { id }, relations: ['lines'] });
      if (!original) throw new NotFoundException(`Voucher #${id} not found`);
      if (original.status !== 'APPROVED') {
        throw new BadRequestException(`Only APPROVED vouchers can be reversed (${original.status})`);
      }
      const actorRole = await this.roleOf(manager, approverId, 'Reverser');
      const makerRole = await this.roleOf(manager, original.createdByUserId, 'Maker');
      const verifierRole = original.verifiedByUserId
        ? await this.roleOf(manager, original.verifiedByUserId, 'Checker')
        : null;
      const approverRole = original.approvedByUserId
        ? await this.roleOf(manager, original.approvedByUserId, 'Approver')
        : null;
      // Same superiority chain as approve: admin-involved vouchers reverse by admins only.
      this.assertAdminSuperior(
        actorRole,
        makerRole === UserRole.ADMIN ||
          verifierRole === UserRole.ADMIN ||
          approverRole === UserRole.ADMIN,
        'reverse',
      );
      const period = await this.resolvePeriod(manager, original.transactionDate, undefined);
      const voucherNo = await this.sequences.nextVoucherNo(manager, 'REVERSAL', original.transactionDate);
      const mirror = repo.create({
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
      });
      const savedMirror = await repo.save(mirror);
      await manager.getRepository(JournalLine).save(
        (original.lines ?? []).map((l) =>
          manager.getRepository(JournalLine).create({
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
          }),
        ),
      );
      original.status = 'REVERSED';
      original.reversedEntryId = savedMirror.id;
      await repo.save(original);
      return this.findOneIn(manager, savedMirror.id);
    });
  }

  /* ---------------- rule engine ---------------- */

  /** Role lookup inside the caller's transaction (hierarchy enforcement). */
  private async roleOf(manager: EntityManager, userId: string, who: string): Promise<UserRole> {
    const user = await manager.getRepository(User).findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`${who} user not found`);
    return user.role;
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

  /** Full validation of incoming DTO lines (masters + 5 posting rules). */
  private async checkLines(manager: EntityManager, dtos: JournalLineDto[]): Promise<CheckedLine[]> {
    if (!dtos || dtos.length < 2) {
      throw new BadRequestException('A voucher needs at least two lines');
    }
    const accountRepo = manager.getRepository(ChartOfAccount);
    const fundRepo = manager.getRepository(Fund);
    const centerRepo = manager.getRepository(CostCenter);

    const checked: CheckedLine[] = [];
    for (const [i, dto] of dtos.entries()) {
      const tag = `Line ${i + 1}`;
      const account = await accountRepo.findOne({ where: { id: dto.glAccountId } });
      if (!account) throw new BadRequestException(`${tag}: GL account not found`);
      if (!account.isActive) {
        throw new BadRequestException(`${tag}: ${account.glCode} is inactive`);
      }
      const fund = await fundRepo.findOne({ where: { id: dto.fundId } });
      if (!fund) throw new BadRequestException(`${tag}: fund not found`);
      if (fund.isActive === false) {
        throw new BadRequestException(`${tag}: fund "${fund.fundCode}" is inactive`);
      }
      if (dto.costCenterId) {
        const center = await centerRepo.findOne({ where: { id: dto.costCenterId } });
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
  private async recheckStoredLines(manager: EntityManager, entryId: string): Promise<void> {
    const entry = await manager.getRepository(JournalEntry).findOne({
      where: { id: entryId },
      relations: ['lines'],
    });
    if (!entry) throw new NotFoundException(`Voucher #${entryId} not found`);
    await this.resolvePeriod(manager, entry.transactionDate, entry.fiscalPeriodId);
    await this.checkLines(
      manager,
      (entry.lines ?? []).map((l) => ({
        glAccountId: l.glAccountId,
        fundId: l.fundId,
        costCenterId: l.costCenterId,
        subledgerType: l.subledgerType,
        subledgerId: l.subledgerId,
        debitAmount: String(l.debitAmount),
        creditAmount: String(l.creditAmount),
        lineMemo: l.lineMemo,
      })),
    );
  }

  /** Rule 5 — resolve the open fiscal period for a transaction date. */
  private async resolvePeriod(
    manager: EntityManager,
    transactionDate: string,
    explicitId?: string,
  ): Promise<FiscalPeriod> {
    const repo = manager.getRepository(FiscalPeriod);
    const day = transactionDate.slice(0, 10);
    let period: FiscalPeriod | null;
    if (explicitId) {
      period = await repo.findOne({ where: { id: explicitId } });
      if (!period) throw new BadRequestException('Fiscal period not found');
      if (day < period.startDate || day > period.endDate) {
        throw new BadRequestException(
          `Transaction date ${day} is outside fiscal period "${period.periodName}"`,
        );
      }
    } else {
      period = await repo
        .createQueryBuilder('p')
        .where('p.startDate <= :day', { day })
        .andWhere('p.endDate >= :day', { day })
        .getOne();
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

  private async findOneIn(manager: EntityManager, id: string): Promise<JournalEntry> {
    const entry = await manager.getRepository(JournalEntry).findOne({
      where: { id },
      relations: ['lines', 'lines.glAccount', 'lines.fund', 'lines.costCenter', 'fiscalPeriod'],
    });
    if (!entry) throw new NotFoundException(`Voucher #${id} not found`);
    return entry;
  }
}
