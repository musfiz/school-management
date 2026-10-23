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
      select: {
        menuId: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        customActions: true,
      },
    });

    if (defaults.length === 0) return;

    await tx.menuUserPermission.createMany({
      data: defaults.map((d: any) => ({
        userId,
        menuId: d.menuId,
        canView: d.canView,
        canCreate: d.canCreate,
        canEdit: d.canEdit,
        canDelete: d.canDelete,
        customActions: d.customActions ?? undefined,
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
      select: {
        id: true,
        title: true,
        slug: true,
        path: true,
        actionsConfig: true,
      },
    });

    const perms = await this.prisma.menuUserPermission.findMany({
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
        customActions: Array.isArray(p?.customActions)
          ? (p.customActions as string[])
          : [],
        actionsConfig: m.actionsConfig ?? null,
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

    const isStandard = ['canView', 'canCreate', 'canEdit', 'canDelete'].includes(
      action,
    );

    if (isStandard) {
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

    // Custom action: update customActions array
    const existing = await this.prisma.menuUserPermission.findUnique({
      where: { userId_menuId: { userId, menuId: menu.id } },
    });

    const currentCustoms: string[] = Array.isArray(existing?.customActions)
      ? (existing.customActions as string[])
      : [];
    const set = new Set(currentCustoms);
    if (granted) {
      set.add(action);
    } else {
      set.delete(action);
    }
    const updatedCustoms = Array.from(set);

    return this.prisma.menuUserPermission.upsert({
      where: { userId_menuId: { userId, menuId: menu.id } },
      create: {
        userId,
        menuId: menu.id,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        customActions: updatedCustoms,
      },
      update: { customActions: updatedCustoms },
    });
  }

  /** Bulk upsert / delete rows for a user from the given (menu, action, granted) list. */
  async setUserMenuPermissions(
    userId: string,
    perms: { menuSlug: string; action: MenuAction; granted: boolean }[],
  ) {
    await this.prisma.$transaction(async (tx) => {
      // Group by menuSlug
      const byMenu = new Map<
        string,
        { menuSlug: string; action: MenuAction; granted: boolean }[]
      >();
      for (const p of perms) {
        const list = byMenu.get(p.menuSlug) ?? [];
        list.push(p);
        byMenu.set(p.menuSlug, list);
      }

      for (const [menuSlug, actions] of byMenu.entries()) {
        const menu = await tx.menu.findUnique({ where: { slug: menuSlug } });
        if (!menu) continue;

        const existing = await tx.menuUserPermission.findUnique({
          where: { userId_menuId: { userId, menuId: menu.id } },
        });

        const standardUpdates: Record<string, boolean> = {};
        const customs = new Set<string>(
          Array.isArray(existing?.customActions)
            ? (existing.customActions as string[])
            : [],
        );

        let customTouched = false;
        for (const item of actions) {
          if (
            ['canView', 'canCreate', 'canEdit', 'canDelete'].includes(
              item.action,
            )
          ) {
            standardUpdates[item.action] = item.granted;
          } else {
            customTouched = true;
            if (item.granted) {
              customs.add(item.action);
            } else {
              customs.delete(item.action);
            }
          }
        }

        const dataToUpdate: any = { ...standardUpdates };
        if (customTouched) {
          dataToUpdate.customActions = Array.from(customs);
        }

        const createData: any = {
          userId,
          menuId: menu.id,
          canView: standardUpdates.canView ?? false,
          canCreate: standardUpdates.canCreate ?? false,
          canEdit: standardUpdates.canEdit ?? false,
          canDelete: standardUpdates.canDelete ?? false,
          customActions: Array.from(customs),
        };

        await tx.menuUserPermission.upsert({
          where: { userId_menuId: { userId, menuId: menu.id } },
          create: createData,
          update: dataToUpdate,
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
