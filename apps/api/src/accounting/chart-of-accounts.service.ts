import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fund } from '../database/entities/fund.entity';
import { CostCenter } from '../database/entities/cost-center.entity';
import {
  ChartOfAccount,
  NORMAL_BALANCE_BY_TYPE,
} from '../database/entities/chart-of-account.entity';
import { FiscalPeriod } from '../database/entities/fiscal-period.entity';
import {
  CreateFundDto,
  UpdateFundDto,
  CreateCostCenterDto,
  UpdateCostCenterDto,
  CreateAccountDto,
  UpdateAccountDto,
  CreateFiscalPeriodDto,
  UpdateFiscalPeriodDto,
} from './chart-of-accounts.dto';

/** Tree node returned by `accountsTree()` — entity plus nested children. */
export interface AccountTreeNode extends ChartOfAccount {
  children: AccountTreeNode[];
}

@Injectable()
export class ChartOfAccountsService {
  constructor(
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
    @InjectRepository(CostCenter)
    private readonly centerRepo: Repository<CostCenter>,
    @InjectRepository(ChartOfAccount)
    private readonly accountRepo: Repository<ChartOfAccount>,
    @InjectRepository(FiscalPeriod)
    private readonly periodRepo: Repository<FiscalPeriod>,
  ) {}

  /* ---------------- Funds ---------------- */

  findAllFunds(): Promise<Fund[]> {
    return this.fundRepo.find({ order: { fundCode: 'ASC' } });
  }

  async createFund(dto: CreateFundDto): Promise<Fund> {
    const exists = await this.fundRepo.findOne({ where: { fundCode: dto.fundCode } });
    if (exists) {
      throw new BadRequestException(`Fund code "${dto.fundCode}" already exists`);
    }
    return this.fundRepo.save(this.fundRepo.create(dto));
  }

  async updateFund(id: string, dto: UpdateFundDto): Promise<Fund> {
    const fund = await this.fundRepo.findOne({ where: { id } });
    if (!fund) throw new NotFoundException(`Fund #${id} not found`);
    if (dto.fundCode && dto.fundCode !== fund.fundCode) {
      const clash = await this.fundRepo.findOne({ where: { fundCode: dto.fundCode } });
      if (clash) throw new BadRequestException(`Fund code "${dto.fundCode}" already exists`);
    }
    Object.assign(fund, dto);
    return this.fundRepo.save(fund);
  }

  /* ---------------- Cost centers ---------------- */

  findAllCostCenters(): Promise<CostCenter[]> {
    return this.centerRepo.find({
      relations: ['parent'],
      order: { centerCode: 'ASC' },
    });
  }

  async createCostCenter(dto: CreateCostCenterDto): Promise<CostCenter> {
    const exists = await this.centerRepo.findOne({ where: { centerCode: dto.centerCode } });
    if (exists) {
      throw new BadRequestException(`Cost center code "${dto.centerCode}" already exists`);
    }
    if (dto.parentId) {
      const parent = await this.centerRepo.findOne({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException(`Parent cost center #${dto.parentId} not found`);
    }
    return this.centerRepo.save(this.centerRepo.create(dto));
  }

  async updateCostCenter(id: string, dto: UpdateCostCenterDto): Promise<CostCenter> {
    const center = await this.centerRepo.findOne({ where: { id } });
    if (!center) throw new NotFoundException(`Cost center #${id} not found`);
    if (dto.centerCode && dto.centerCode !== center.centerCode) {
      const clash = await this.centerRepo.findOne({ where: { centerCode: dto.centerCode } });
      if (clash) throw new BadRequestException(`Cost center code "${dto.centerCode}" already exists`);
    }
    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestException('A cost center cannot be its own parent');
      const parent = await this.centerRepo.findOne({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException(`Parent cost center #${dto.parentId} not found`);
    }
    Object.assign(center, dto);
    return this.centerRepo.save(center);
  }

  /* ---------------- Chart of accounts ---------------- */

  findAllAccounts(activeOnly = false): Promise<ChartOfAccount[]> {
    return this.accountRepo.find({
      where: activeOnly ? { isActive: true } : undefined,
      relations: ['parent', 'defaultFund'],
      order: { glCode: 'ASC' },
    });
  }

  /** Nested tree (roots = accounts without a parent), children sorted by code. */
  async accountsTree(): Promise<AccountTreeNode[]> {
    const accounts = await this.accountRepo.find({
      relations: ['defaultFund'],
      order: { glCode: 'ASC' },
    });
    const byId = new Map<string, AccountTreeNode>();
    accounts.forEach((a) => byId.set(a.id, { ...a, children: [] }));
    const roots: AccountTreeNode[] = [];
    byId.forEach((node) => {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  async createAccount(dto: CreateAccountDto): Promise<ChartOfAccount> {
    const exists = await this.accountRepo.findOne({ where: { glCode: dto.glCode } });
    if (exists) {
      throw new BadRequestException(`GL code "${dto.glCode}" already exists`);
    }
    if (dto.parentId) {
      await this.assertValidParent(null, dto.parentId, dto.accountType);
    }
    if (dto.defaultFundId) {
      const fund = await this.fundRepo.findOne({ where: { id: dto.defaultFundId } });
      if (!fund) throw new BadRequestException(`Default fund #${dto.defaultFundId} not found`);
    }
    const account = this.accountRepo.create({
      ...dto,
      normalBalance: dto.normalBalance ?? NORMAL_BALANCE_BY_TYPE[dto.accountType],
    });
    return this.accountRepo.save(account);
  }

  async updateAccount(id: string, dto: UpdateAccountDto): Promise<ChartOfAccount> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`GL account #${id} not found`);
    if (dto.glCode && dto.glCode !== account.glCode) {
      const clash = await this.accountRepo.findOne({ where: { glCode: dto.glCode } });
      if (clash) throw new BadRequestException(`GL code "${dto.glCode}" already exists`);
    }
    const nextType = dto.accountType ?? account.accountType;
    if (dto.parentId) {
      await this.assertValidParent(id, dto.parentId, nextType);
    }
    if (dto.defaultFundId) {
      const fund = await this.fundRepo.findOne({ where: { id: dto.defaultFundId } });
      if (!fund) throw new BadRequestException(`Default fund #${dto.defaultFundId} not found`);
    }
    Object.assign(account, {
      ...dto,
      normalBalance: dto.normalBalance ?? NORMAL_BALANCE_BY_TYPE[nextType],
    });
    return this.accountRepo.save(account);
  }

  async removeAccount(id: string): Promise<void> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`GL account #${id} not found`);
    const childCount = await this.accountRepo.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${account.glCode}" — it has ${childCount} child account(s). Reassign them first.`,
      );
    }
    await this.accountRepo.remove(account);
  }

  private isContraPair(
    parentType: ChartOfAccount['accountType'],
    childType: ChartOfAccount['accountType'],
  ): boolean {
    return (
      (parentType === 'REVENUE' && childType === 'CONTRA_REVENUE') ||
      (parentType === 'ASSET' && childType === 'CONTRA_ASSET')
    );
  }

  /** Parent must exist, match the child type, and not create a cycle. */
  private async assertValidParent(
    selfId: string | null,
    parentId: string,
    childType: ChartOfAccount['accountType'],
  ): Promise<void> {
    if (selfId !== null && parentId === selfId) {
      throw new BadRequestException('An account cannot be its own parent');
    }
    const parent = await this.accountRepo.findOne({ where: { id: parentId } });
    if (!parent) throw new BadRequestException(`Parent account #${parentId} not found`);
    if (parent.accountType !== childType && !this.isContraPair(parent.accountType, childType)) {
      throw new BadRequestException(
        `Parent "${parent.glCode}" is type ${parent.accountType} — child must share the parent type (contra accounts may nest under their natural parent)`,
      );
    }
    // Walk up the ancestry chain to rule out a cycle.
    let cursor: ChartOfAccount | null = parent;
    const seen = new Set<string>();
    while (cursor?.parentId) {
      if (cursor.parentId === selfId) {
        throw new BadRequestException('Cannot move an account under one of its own descendants');
      }
      if (seen.has(cursor.parentId)) break;
      seen.add(cursor.parentId);
      cursor = await this.accountRepo.findOne({ where: { id: cursor.parentId } });
    }
  }

  /* ---------------- Fiscal periods ---------------- */

  findAllPeriods(): Promise<FiscalPeriod[]> {
    return this.periodRepo.find({ order: { startDate: 'DESC' } });
  }

  async createPeriod(dto: CreateFiscalPeriodDto): Promise<FiscalPeriod> {
    this.assertValidDateRange(dto.startDate, dto.endDate);
    return this.periodRepo.save(this.periodRepo.create(dto));
  }

  async updatePeriod(id: string, dto: UpdateFiscalPeriodDto): Promise<FiscalPeriod> {
    const period = await this.periodRepo.findOne({ where: { id } });
    if (!period) throw new NotFoundException(`Fiscal period #${id} not found`);
    if (period.isClosed) {
      throw new BadRequestException('Closed fiscal periods are immutable — reopen first');
    }
    this.assertValidDateRange(dto.startDate, dto.endDate);
    Object.assign(period, dto);
    return this.periodRepo.save(period);
  }

  /** Close (or reopen) a period. Phase 2 refuses postings into closed periods. */
  async setPeriodClosed(id: string, closed: boolean, userId?: string): Promise<FiscalPeriod> {
    const period = await this.periodRepo.findOne({ where: { id } });
    if (!period) throw new NotFoundException(`Fiscal period #${id} not found`);
    period.isClosed = closed;
    period.closedByUserId = closed ? (userId ?? null) : null;
    period.closedAt = closed ? new Date() : null;
    return this.periodRepo.save(period);
  }

  private assertValidDateRange(startDate: string, endDate: string): void {
    if (new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }
  }
}
