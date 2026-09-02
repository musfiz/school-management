import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PermissionsService } from '../permissions/permissions.service';
import { LoginDto, RegisterDto, AuthResponseDto } from './auth.dto';
import { User } from '../database/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private permissionsService: PermissionsService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await user.comparePassword(loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    await this.usersService.updateLastLogin(user.id);

    // Permissions are additive — never block login if they fail to load.
    let permissions: string[] = [];
    try {
      permissions = await this.permissionsService.getUserPermissions(user.id);
    } catch (err) {
      console.warn(
        `[auth] Could not load permissions for user ${user.id}:`,
        err instanceof Error ? err.message : err,
      );
    }

    const payload = {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      name: user.name,
      permissions,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.usersService.create({
      name: registerDto.name,
      email: registerDto.email,
      password: registerDto.password,
      role: 'student' as any,
    });

    let permissions: string[] = [];
    try {
      permissions = await this.permissionsService.getUserPermissions(user.id);
    } catch (err) {
      console.warn(
        `[auth] Could not load permissions for user ${user.id}:`,
        err instanceof Error ? err.message : err,
      );
    }

    const payload = {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      name: user.name,
      permissions,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      },
    };
  }

  async validateUser(userId: number): Promise<User | null> {
    return this.usersService.findByIdWithPassword(userId);
  }
}
