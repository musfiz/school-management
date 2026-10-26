import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import {
  REQUIRE_PERMISSION_KEY,
  RequirePermissionMetadata,
} from '../decorators/require-permission.decorator';

/**
 * Enforces `@RequirePermission(menuSlug, action)`.
 *
 * Order of evaluation:
 * 1. `@Public()` route → skip (no auth required).
 * 2. No metadata → open route (other guards still apply).
 * 3. `isSuperAdmin` flag or `SUPERADMIN` role on the JWT payload →
 *    unrestricted, no DB check.
 * 4. Otherwise look up `Menu` by slug, then `MenuUserPermission` for this user
 *    + that menu; require the requested action boolean to be true.
 */
@Injectable()
export class MenuPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const meta = this.reflector.get<RequirePermissionMetadata>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    ) ?? this.reflector.get<RequirePermissionMetadata>(
      REQUIRE_PERMISSION_KEY,
      context.getClass(),
    );

    // No @RequirePermission → route is open (JWT auth still applies globally).
    if (!meta) return true;

    const { user } = context.switchToHttp().getRequest();

    // No authenticated user (protected route but no session): cannot satisfy.
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Superadmin bypass: unrestricted access to everything. Matches either
    // the explicit `isSuperAdmin` flag or the SUPERADMIN role (plan Core Rule 1).
    if (user.isSuperAdmin === true || user.role === UserRole.SUPERADMIN) {
      return true;
    }

    const menu = await this.prisma.menu.findUnique({
      where: { slug: meta.menuSlug },
      select: { id: true },
    });

    if (!menu) {
      throw new ForbiddenException(`Menu not found: ${meta.menuSlug}`);
    }

    const isStandardAction = ['canView', 'canCreate', 'canEdit', 'canDelete'].includes(
      meta.action,
    );

    const perm = await this.prisma.menuUserPermission.findFirst({
      where: { userId: user.id, menuId: menu.id },
      select: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        customActions: true,
      },
    });

    if (!perm) {
      throw new ForbiddenException(
        `Missing permission "${meta.action}" on menu "${meta.menuSlug}"`,
      );
    }

    let hasPermission = false;
    if (isStandardAction) {
      hasPermission = Boolean((perm as Record<string, any>)[meta.action]);
    } else {
      const customs = perm.customActions
        ? JSON.parse(perm.customActions)
        : [];
      hasPermission = customs.includes(meta.action);
    }

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing permission "${meta.action}" on menu "${meta.menuSlug}"`,
      );
    }

    return true;
  }
}
