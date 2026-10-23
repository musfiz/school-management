import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../database/entities/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Core Rule 1: a superadmin (`isSuperAdmin` flag or the `superadmin`
    // role) has unrestricted access to every role-gated route, regardless
    // of which roles the controller lists.
    if (user?.isSuperAdmin === true || user?.role === UserRole.SUPERADMIN) {
      return true;
    }

    return requiredRoles.includes(user?.role);
  }
}
