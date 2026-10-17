import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDateValue } from '../prisma/wire';
import { NORMAL_BALANCE_BY_TYPE } from '../database/entities/chart-of-account.entity';
import type {
  ChartOfAccounts,
  CostCenters,
  Funds,
  FiscalPeriods,
} from '../generated/prisma/client';
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

type AccountType = CreateAccountDto['accountType'];

/** Cost center wire shape — `parent` (legacy relation name) + scalars. */
type CostCenterWire = CostCenters & { parent: CostCenters | null };
type AccountWithFund = ChartOfAccounts & { defaultFund: Funds | null };
type AccountWithFundAndParent = AccountWithFund & { parent: ChartOfAccounts | null };

/** Tree node returned by `accountsTree()` — account plus nested children. */
export interface AccountTreeNode extends AccountWithFund {
  children: AccountTreeNode[];
}

/**
 * Accounting masters (Phase 2): funds, cost centers, chart of accounts and
 * fiscal periods. Pure CRUD + hierarchy validation (no posting logic).
 *
 * AD-P5: repositories are now `PrismaService` models; `parent`/`defaultFund`
 * relation names are remapped to their legacy wire names.
 */
@Injectable()
export class ChartOfAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------------- Funds ---------------- */

  findAllFunds(): Promise<Funds[]> {
    return this.prisma.funds.findMany({ orderBy: { fundCode: 'asc' } });
  }

  async createFund(dto: CreateFundDto): Promise<Funds> {
    const exists = await this.prisma.funds.findFirst({ where: { fundCode: dto.fundCode } });
    if (exists) {
      throw new BadRequestException(`Fund code "${dto.fundCode}" already exists`);
    }
    return this.prisma.funds.create({ data: { ...dto } });
  }

  async updateFund(id: string, dto: UpdateFundDto): Promise<Funds> {
    const fund = await this.prisma.funds.findUnique({ where: { id } });
    if (!fund) throw new NotFoundException(`Fund #${id} not found`);
    if (dto.fundCode && dto.fundCode !== fund.fundCode) {
      const clash = await this.prisma.funds.findFirst({ where: { fundCode: dto.fundCode } });
      if (clash) throw new BadRequestException(`Fund code "${dto.fundCode}" already exists`);
    }
    return this.prisma.funds.update({ where: { id }, data: { ...dto } });
  }

  /* ---------------- Cost centers ---------------- */

  async findAllCostCenters(): Promise<CostCenterWire[]> {
    const centers = await this.prisma.costCenters.findMany({
      include: { costCenters: true },
      orderBy: { centerCode: 'asc' },
    });
    return centers.map(({ costCenters, ...rest }) => ({ ...rest, parent: costCenters }));
  }

  async createCostCenter(dto: CreateCostCenterDto): Promise<CostCenters> {
    const exists = await this.prisma.costCenters.findFirst({
      where: { centerCode: dto.centerCode },
    });
    if (exists) {
      throw new BadRequestException(`Cost center code "${dto.centerCode}" already exists`);
    }
    if (dto.parentId) {
      const parent = await this.prisma.costCenters.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException(`Parent cost center #${dto.parentId} not found`);
    }
    return this.prisma.costCenters.create({ data: { ...dto } });
  }

  async updateCostCenter(id: string, dto: UpdateCostCenterDto): Promise<CostCenters> {
    const center = await this.prisma.costCenters.findUnique({ where: { id } });
    if (!center) throw new NotFoundException(`Cost center #${id} not found`);
    if (dto.centerCode && dto.centerCode !== center.centerCode) {
      const clash = await this.prisma.costCenters.findFirst({
        where: { centerCode: dto.centerCode },
      });
      if (clash) throw new BadRequestException(`Cost center code "${dto.centerCode}" already exists`);
    }
    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestException('A cost center cannot be its own parent');
      const parent = await this.prisma.costCenters.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException(`Parent cost center #${dto.parentId} not found`);
    }
    return this.prisma.costCenters.update({ where: { id }, data: { ...dto } });
  }

  /* ---------------- Chart of accounts ---------------- */

  async findAllAccounts(activeOnly = false): Promise<AccountWithFundAndParent[]> {
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { chartOfAccounts: true, funds: true },
      orderBy: { glCode: 'asc' },
    });
    return accounts.map(({ chartOfAccounts, funds, ...rest }) => ({
      ...rest,
      parent: chartOfAccounts,
      defaultFund: funds,
    }));
  }

  /** Nested tree (roots = accounts without a parent), children sorted by code. */
  async accountsTree(): Promise<AccountTreeNode[]> {
    const accounts = await this.prisma.chartOfAccounts.findMany({
      include: { funds: true },
      orderBy: { glCode: 'asc' },
    });
    const byId = new Map<string, AccountTreeNode>();
    accounts.forEach((a) => {
      const { funds, ...rest } = a;
      byId.set(a.id, { ...rest, defaultFund: funds, children: [] });
    });
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

  async createAccount(dto: CreateAccountDto): Promise<ChartOfAccounts> {
    const exists = await this.prisma.chartOfAccounts.findFirst({ where: { glCode: dto.glCode } });
    if (exists) {
      throw new BadRequestException(`GL code "${dto.glCode}" already exists`);
    }
    if (dto.parentId) {
      await this.assertValidParent(null, dto.parentId, dto.accountType);
    }
    if (dto.defaultFundId) {
      const fund = await this.prisma.funds.findUnique({ where: { id: dto.defaultFundId } });
      if (!fund) throw new BadRequestException(`Default fund #${dto.defaultFundId} not found`);
    }
    return this.prisma.chartOfAccounts.create({
      data: {
        ...dto,
        normalBalance: dto.normalBalance ?? NORMAL_BALANCE_BY_TYPE[dto.accountType],
      },
    });
  }

  async updateAccount(id: string, dto: UpdateAccountDto): Promise<ChartOfAccounts> {
    const account = await this.prisma.chartOfAccounts.findUnique({ where: { id } });
    if (!account) throw new NotFoundException(`GL account #${id} not found`);
    if (dto.glCode && dto.glCode !== account.glCode) {
      const clash = await this.prisma.chartOfAccounts.findFirst({ where: { glCode: dto.glCode } });
      if (clash) throw new BadRequestException(`GL code "${dto.glCode}" already exists`);
    }
    const nextType = (dto.accountType ?? account.accountType) as AccountType;
    if (dto.parentId) {
      await this.assertValidParent(id, dto.parentId, nextType);
    }
    if (dto.defaultFundId) {
      const fund = await this.prisma.funds.findUnique({ where: { id: dto.defaultFundId } });
      if (!fund) throw new BadRequestException(`Default fund #${dto.defaultFundId} not found`);
    }
    return this.prisma.chartOfAccounts.update({
      where: { id },
      data: { ...dto, normalBalance: dto.normalBalance ?? NORMAL_BALANCE_BY_TYPE[nextType] },
    });
  }

  async removeAccount(id: string): Promise<void> {
    const account = await this.prisma.chartOfAccounts.findUnique({ where: { id } });
    if (!account) throw new NotFoundException(`GL account #${id} not found`);
    const childCount = await this.prisma.chartOfAccounts.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${account.glCode}" — it has ${childCount} child account(s). Reassign them first.`,
      );
    }
    await this.prisma.chartOfAccounts.delete({ where: { id } });
  }

  private isContraPair(parentType: AccountType, childType: AccountType): boolean {
    return (
      (parentType === 'REVENUE' && childType === 'CONTRA_REVENUE') ||
      (parentType === 'ASSET' && childType === 'CONTRA_ASSET')
    );
  }

  /** Parent must exist, match the child type, and not create a cycle. */
  private async assertValidParent(
    selfId: string | null,
    parentId: string,
    childType: AccountType,
  ): Promise<void> {
    if (selfId !== null && parentId === selfId) {
      throw new BadRequestException('An account cannot be its own parent');
    }
    const parent = await this.prisma.chartOfAccounts.findUnique({ where: { id: parentId } });
    if (!parent) throw new BadRequestException(`Parent account #${parentId} not found`);
    const parentType = parent.accountType as AccountType;
    if (parentType !== childType && !this.isContraPair(parentType, childType)) {
      throw new BadRequestException(
        `Parent "${parent.glCode}" is type ${parent.accountType} — child must share the parent type (contra accounts may nest under their natural parent)`,
      );
    }
    // Walk up the ancestry chain to rule out a cycle.
    let cursor: ChartOfAccounts | null = parent;
    const seen = new Set<string>();
    while (cursor?.parentId) {
      if (cursor.parentId === selfId) {
        throw new BadRequestException('Cannot move an account under one of its own descendants');
      }
      if (seen.has(cursor.parentId)) break;
      seen.add(cursor.parentId);
      cursor = await this.prisma.chartOfAccounts.findUnique({ where: { id: cursor.parentId } });
    }
  }

  /* ---------------- Fiscal periods ---------------- */

  findAllPeriods(): Promise<FiscalPeriods[]> {
    return this.prisma.fiscalPeriods.findMany({ orderBy: { startDate: 'desc' } });
  }

  async createPeriod(dto: CreateFiscalPeriodDto): Promise<FiscalPeriods> {
    this.assertValidDateRange(dto.startDate, dto.endDate);
    return this.prisma.fiscalPeriods.create({
      data: {
        periodName: dto.periodName,
        startDate: toDateValue(dto.startDate.slice(0, 10)),
        endDate: toDateValue(dto.endDate.slice(0, 10)),
      },
    });
  }

  async updatePeriod(id: string, dto: UpdateFiscalPeriodDto): Promise<FiscalPeriods> {
    const period = await this.prisma.fiscalPeriods.findUnique({ where: { id } });
    if (!period) throw new NotFoundException(`Fiscal period #${id} not found`);
    if (period.isClosed) {
      throw new BadRequestException('Closed fiscal periods are immutable — reopen first');
    }
    this.assertValidDateRange(dto.startDate, dto.endDate);
    return this.prisma.fiscalPeriods.update({
      where: { id },
      data: {
        periodName: dto.periodName,
        startDate: toDateValue(dto.startDate.slice(0, 10)),
        endDate: toDateValue(dto.endDate.slice(0, 10)),
      },
    });
  }

  /** Close (or reopen) a period. Phase 2 refuses postings into closed periods. */
  async setPeriodClosed(id: string, closed: boolean, userId?: string): Promise<FiscalPeriods> {
    const period = await this.prisma.fiscalPeriods.findUnique({ where: { id } });
    if (!period) throw new NotFoundException(`Fiscal period #${id} not found`);
    return this.prisma.fiscalPeriods.update({
      where: { id },
      data: {
        isClosed: closed,
        closedByUserId: closed ? (userId ?? null) : null,
        closedAt: closed ? new Date() : null,
      },
    });
  }

  private assertValidDateRange(startDate: string, endDate: string): void {
    if (new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }
  }
}
