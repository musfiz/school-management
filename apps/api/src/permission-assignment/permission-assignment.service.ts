import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { MenuAction } from '../common/decorators/require-permission.decorator';

/**
 * Menu-level permission management for the hybrid RBAC model.
 *
 * - Role defaults (`role_default_permissions`) seed a new user's menu
 *   permissions on creation (see `UsersService.create()`).
 * - `MenuUserPermission` rows override those defaults per user.
 * - `isSuperAdmin` users bypass every check (handled in the guard).
 */
@Injectable()
export class PermissionAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Copy role-default permission templates into user-level rows.
   * When `tx` is provided (e.g. inside a $transaction callback) writes join
   * that transaction; otherwise they use this.prisma directly.
   */
  async assignRoleDefaultsToUser(
    userId: string,
    role: string,
    tx?: any,
  ): Promise<void> {
    await this.assignRoleDefaultsTx(tx ?? this.prisma, userId, role);
  }

  private async assignRoleDefaultsTx(
    tx: any,
    userId: string,
    role: string,
    menuId?: string,
  ) {
    const defaults = await tx.roleDefaultPermission.findMany({
      where: { role: role as any, ...(menuId ? { menuId } : {}) },
      select: { menuId: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
    });

    if (defaults.length === 0) return;

    await tx.menuUserPermission.createMany({
      data: defaults.map((d) => ({
        userId,
        menuId: d.menuId,
        canView: d.canView,
        canCreate: d.canCreate,
        canEdit: d.canEdit,
        canDelete: d.canDelete,
      })),
      skipDuplicates: true,
    });
  }

  /** Return every menu merged with a user's current action flags (permission matrix). */
  async getUserPermissionMatrix(userId: string) {
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
      select: { id: true, title: true, slug: true, path: true },
    });

    const perms = await this.prisma.menuUserPermission.findMany({
      where: { userId },
      select: { menuId: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
    });

    const byMenu = new Map<string, (typeof perms)[number]>();
    for (const p of perms) byMenu.set(p.menuId, p);

    return menus.map((m) => {
      const p = byMenu.get(m.id);
      return {
        menuSlug: m.slug,
        title: m.title,
        path: m.path ?? null,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        canView: p?.canView ?? false,
        canCreate: p?.canCreate ?? false,
        canEdit: p?.canEdit ?? false,
        canDelete: p?.canDelete ?? false,
      };
    });
  }

  /** Set a single (menu, action) flag for a user (upsert). */
  async setMenuPermission(
    userId: string,
    menuSlug: string,
    action: MenuAction,
    granted: boolean,
  ) {
    const menu = await this.prisma.menu.findUnique({ where: { slug: menuSlug } });
    if (!menu) {
      throw new NotFoundException(`Menu ${menuSlug} not found`);
    }

    return this.prisma.menuUserPermission.upsert({
      where: { userId_menuId: { userId, menuId: menu.id } },
      create: {
        userId,
        menuId: menu.id,
        canView: action === 'canView' ? granted : false,
        canCreate: action === 'canCreate' ? granted : false,
        canEdit: action === 'canEdit' ? granted : false,
        canDelete: action === 'canDelete' ? granted : false,
      },
      update: { [action]: granted },
    });
  }

  /** Bulk upsert / delete rows for a user from the given (menu, action, granted) list. */
  async setUserMenuPermissions(userId: string, perms: { menuSlug: string; action: MenuAction; granted: boolean }[]) {
    await this.prisma.$transaction(async (tx) => {
      for (const p of perms) {
        const menu = await tx.menu.findUnique({ where: { slug: p.menuSlug } });
        if (!menu) continue;
        await tx.menuUserPermission.upsert({
          where: { userId_menuId: { userId, menuId: menu.id } },
          create: {
            userId,
            menuId: menu.id,
            canView: p.action === 'canView' ? p.granted : false,
            canCreate: p.action === 'canCreate' ? p.granted : false,
            canEdit: p.action === 'canEdit' ? p.granted : false,
            canDelete: p.action === 'canDelete' ? p.granted : false,
          },
          update: { [p.action]: p.granted },
        });
      }
    });
  }

  /** Reset a user's menu permissions back to their role-default template.
   *  If menuSlug is given, only that menu is reset. */
  async resetUserPermissions(userId: string, menuSlug?: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (menuSlug) {
        const menu = await tx.menu.findUnique({ where: { slug: menuSlug } });
        if (!menu) throw new NotFoundException(`Menu ${menuSlug} not found`);
        await tx.menuUserPermission.deleteMany({ where: { userId, menuId: menu.id } });
        await this.assignRoleDefaultsTx(tx, userId, user.role, menu.id);
      } else {
        await tx.menuUserPermission.deleteMany({ where: { userId } });
        await this.assignRoleDefaultsTx(tx, userId, user.role);
      }
    });
  }

}
