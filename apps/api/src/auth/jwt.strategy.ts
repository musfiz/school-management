import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { config } from '../config';
import { UsersService } from '../users/users.service';
import { PermissionsService } from '../permissions/permissions.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  name?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private usersService: UsersService,
    private permissionsService: PermissionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config().jwt.secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findByIdWithPassword(
      parseInt(payload.sub),
    );
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Load direct permissions. If the permissions tables aren't migrated yet
    // (or the query fails for any reason), fall back to an empty list so the
    // auth flow still works — permissions are additive, never required to load.
    let permissions: string[] = [];
    try {
      permissions = await this.permissionsService.getUserPermissions(user.id);
    } catch (err) {
      console.warn(
        `[jwt] Could not load permissions for user ${user.id}:`,
        err instanceof Error ? err.message : err,
      );
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      permissions,
    };
  }
}
