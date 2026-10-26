import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { MenuItems } from '../generated/prisma/client';
import type { MenuLocation } from './menu-item.constants';
import { MenuChildInputDto, MenuItemInputDto } from './menu-item.dto';
import { CreateSystemMenuDto, UpdateSystemMenuDto } from './system-menu.dto';

/** One menu entry merged with the current user's action flags. */
export interface MyMenuEntry {
  id: string;
  title: string;
  slug: string;
  path: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  customActions?: string[];
  actionsConfig?: any;
  children: MyMenuEntry[];
}

/** A plain tree node shaped for the frontend — no internal ids beyond `id` itself. */
export interface MenuTreeNode {
  id: string;
  labelEn: string;
  labelBn: string | null;
  href: string;
  isVisible: boolean;
  children: MenuTreeNode[];
}

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  /** Build a nested tree from the flat, sort_order-ordered rows for a location. */
  private buildTree(rows: MenuItems[]): MenuTreeNode[] {
    const byParent = new Map<string | null, MenuItems[]>();
    for (const row of rows) {
      const key = row.parentId ?? null;
      const bucket = byParent.get(key) ?? [];
      bucket.push(row);
      byParent.set(key, bucket);
    }
    const toNode = (row: MenuItems): MenuTreeNode => ({
      id: row.id,
      labelEn: row.labelEn,
      labelBn: row.labelBn ?? null,
      href: row.href,
      isVisible: row.isVisible,
      children: (byParent.get(row.id) ?? []).map(toNode),
    });
    return (byParent.get(null) ?? []).map(toNode);
  }

  /** Public tree — visible items only, for rendering the live site header. */
  async findPublicTree(location: MenuLocation): Promise<MenuTreeNode[]> {
    const rows = await this.prisma.menuItems.findMany({
      where: { menuLocation: location },
      orderBy: { sortOrder: 'asc' },
    });
    return this.buildTree(rows.filter((r) => r.isVisible));
  }

  /** Full tree including hidden items, for the dashboard menu builder. */
  async findFullTree(location: MenuLocation): Promise<MenuTreeNode[]> {
    const rows = await this.prisma.menuItems.findMany({
      where: { menuLocation: location },
      orderBy: { sortOrder: 'asc' },
    });
    return this.buildTree(rows);
  }

  /** Replace the entire tree for a location in one transaction: wipe, then
   *  re-insert in the order submitted (sort_order = array index). */
  async replaceTree(
    location: MenuLocation,
    items: MenuItemInputDto[],
  ): Promise<MenuTreeNode[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.menuItems.deleteMany({ where: { menuLocation: location } });

      const insertLevel = async (
        nodes: (MenuItemInputDto | MenuChildInputDto)[],
        parentId: string | null,
      ) => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const saved = await tx.menuItems.create({
            data: {
              menuLocation: location,
              parentId,
              labelEn: node.labelEn,
              labelBn: node.labelBn ?? null,
              href: node.href,
              isVisible: node.isVisible ?? true,
              sortOrder: i,
            },
          });
          if ('children' in node && node.children?.length) {
            await insertLevel(node.children, saved.id);
          }
        }
      };

      await insertLevel(items, null);
    });

    return this.findFullTree(location);
  }

  /**
   * Hierarchical menu tree for the current user, each node carrying their
   * `canView` / `canCreate` / `canEdit` / `canDelete` flags. Superadmins see
   * every menu with all flags true.
   */
  async getMyMenus(userId: string, isSuperAdmin: boolean): Promise<MyMenuEntry[]> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isSuperAdmin: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const menus = await this.prisma.menu.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        path: true,
        parentId: true,
        sortOrder: true,
        isActive: true,
        actionsConfig: true,
      },
    });

    let perms: {
      menuId: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      customActions?: any;
    }[];
    // Same superadmin rule as the guard: isSuperAdmin flag or the role itself.
    if (user.isSuperAdmin || user.role === 'superadmin') {
      perms = menus.map((m) => {
        const cfg = m.actionsConfig ? JSON.parse(m.actionsConfig) : {};
        const customs = Array.isArray(cfg?.custom)
          ? cfg.custom.map((c: any) => c.action)
          : [];
        return {
          menuId: m.id,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          customActions: customs,
        };
      });
    } else {
      perms = await this.prisma.menuUserPermission.findMany({
        where: { userId },
        select: {
          menuId: true,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          customActions: true,
        },
      });
    }

    const byId = new Map<string, (typeof menus)[number]>();
    for (const m of menus) byId.set(m.id, m);

    const byPerm = new Map<string, (typeof perms)[number]>();
    for (const p of perms) byPerm.set(p.menuId, p);

    const root: MyMenuEntry[] = [];
    const children = new Map<string, MyMenuEntry[]>();

    for (const m of menus) {
      const p = byPerm.get(m.id);
      const entry: MyMenuEntry = {
        id: m.id,
        title: m.title,
        slug: m.slug,
        path: m.path,
        parentId: m.parentId,
        sortOrder: m.sortOrder,
        isActive: m.isActive,
        canView: p?.canView ?? false,
        canCreate: p?.canCreate ?? false,
        canEdit: p?.canEdit ?? false,
        canDelete: p?.canDelete ?? false,
        customActions: p?.customActions ? JSON.parse(p.customActions) : [],
        actionsConfig: m.actionsConfig ? JSON.parse(m.actionsConfig) : null,
        children: [],
      };
      const bucket = children.get(m.parentId ?? null) ?? [];
      bucket.push(entry);
      children.set(m.parentId ?? null, bucket);
    }

    const toTree = (parentId: string | null): MyMenuEntry[] =>
      (children.get(parentId) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((e) => ({
          ...e,
          children: toTree(e.id),
        }));

    return toTree(null);
  }

  // ---------------------------------------------------------------------------
  // System Menu CRUD (for Hybrid RBAC menu registry)
  // ---------------------------------------------------------------------------

  /** List all system menus with their parent info. */
  async findAllSystemMenus() {
    const menus = await this.prisma.menu.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    const byId = new Map(menus.map((m) => [m.id, m]));
    return menus.map((m) => ({
      ...m,
      parent: m.parentId && byId.has(m.parentId)
        ? {
            id: byId.get(m.parentId)!.id,
            slug: byId.get(m.parentId)!.slug,
            title: byId.get(m.parentId)!.title,
          }
        : null,
    }));
  }

  /** Create a new system menu. Automatically grants full defaults to superadmin and admin. */
  async createSystemMenu(dto: CreateSystemMenuDto) {
    const existing = await this.prisma.menu.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Menu with slug "${dto.slug}" already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.menu.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent menu ${dto.parentId} not found`);
      }
    }

    const created = await this.prisma.menu.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        path: dto.path ?? null,
        icon: dto.icon ?? null,
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        actionsConfig: dto.actionsConfig
          ? JSON.stringify(dto.actionsConfig)
          : null,
      },
    });

    const cfg = dto.actionsConfig ?? {};
    const customs = Array.isArray(cfg.custom)
      ? cfg.custom.map((c) => c.action)
      : [];

    // Seed full defaults for superadmin and admin
    await this.prisma.roleDefaultPermission.createMany({
      data: [
        {
          role: 'superadmin' as any,
          menuId: created.id,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          customActions: customs.length > 0 ? JSON.stringify(customs) : null,
        },
        {
          role: 'admin' as any,
          menuId: created.id,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          customActions: customs.length > 0 ? JSON.stringify(customs) : null,
        },
      ],
      skipDuplicates: true,
    });

    return created;
  }

  /** Update an existing system menu. */
  async updateSystemMenu(id: string, dto: UpdateSystemMenuDto) {
    const existing = await this.prisma.menu.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Menu ${id} not found`);
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugCheck = await this.prisma.menu.findUnique({
        where: { slug: dto.slug },
      });
      if (slugCheck) {
        throw new ConflictException(`Slug "${dto.slug}" already in use`);
      }
    }

    if (dto.parentId === id) {
      throw new BadRequestException('A menu cannot be its own parent');
    }

    if (dto.parentId) {
      const parent = await this.prisma.menu.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent menu ${dto.parentId} not found`);
      }
    }

    return this.prisma.menu.update({
      where: { id },
      data: {
        slug: dto.slug,
        title: dto.title,
        path: dto.path,
        icon: dto.icon,
        parentId: dto.parentId === '' ? null : dto.parentId,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        actionsConfig:
          dto.actionsConfig !== undefined
            ? dto.actionsConfig
              ? JSON.stringify(dto.actionsConfig)
              : null
            : undefined,
      },
    });
  }

  /** Delete a system menu and unlink any children. */
  async deleteSystemMenu(id: string) {
    const existing = await this.prisma.menu.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Menu ${id} not found`);
    }

    // Unlink any children first to prevent foreign key errors
    await this.prisma.menu.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    });

    return this.prisma.menu.delete({ where: { id } });
  }
}
