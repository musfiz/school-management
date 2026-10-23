import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Modules, Permissions, UserPermissions } from '../generated/prisma/client';
import { CreatePermissionDto, UpdatePermissionDto } from './permissions.dto';

/**
 * Rename Prisma's camelCase fields back to the snake_case wire keys the old
 * TypeORM entities exposed (`created_at`, `module_id`), and drop the relation
 * holders Prisma includes so the response shape is unchanged.
 */
function permissionWire(row: Permissions) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    module_id: row.moduleId,
    created_at: row.createdAt,
  };
}

function moduleWire(row: Modules) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.createdAt,
  };
}

function userPermissionWire(row: UserPermissions) {
  return {
    user_id: row.userId,
    permission_id: row.permissionId,
    assigned_by: row.assignedBy,
    assigned_at: row.assignedAt,
  };
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Permission catalog ----

  async findAllPermissions() {
    const rows = await this.prisma.permissions.findMany({
      orderBy: { name: 'asc' },
      include: { modules: true },
    });
    return rows.map((row) => ({
      ...permissionWire(row),
      module: row.modules ? moduleWire(row.modules) : null,
    }));
  }

  async findOneByName(name: string) {
    const permission = await this.prisma.permissions.findUnique({
      where: { name },
    });
    return permission ? permissionWire(permission) : null;
  }

  async createPermission(dto: CreatePermissionDto) {
    const existing = await this.findOneByName(dto.name);
    if (existing) {
      throw new ConflictException(`Permission "${dto.name}" already exists`);
    }
    if (dto.module_id != null) {
      const module = await this.prisma.modules.findUnique({
        where: { id: dto.module_id },
      });
      if (!module) {
        throw new NotFoundException(`Module ${dto.module_id} not found`);
      }
    }
    const row = await this.prisma.permissions.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        moduleId: dto.module_id ?? null,
      },
      include: { modules: true },
    });
    return {
      ...permissionWire(row),
      module: row.modules ? moduleWire(row.modules) : null,
    };
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    const existing = await this.prisma.permissions.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Permission ${id} not found`);
    }

    if (dto.name && dto.name !== existing.name) {
      const nameCheck = await this.findOneByName(dto.name);
      if (nameCheck) {
        throw new ConflictException(`Permission "${dto.name}" already exists`);
      }
    }

    if (dto.module_id !== undefined && dto.module_id !== null) {
      const module = await this.prisma.modules.findUnique({
        where: { id: dto.module_id },
      });
      if (!module) {
        throw new NotFoundException(`Module ${dto.module_id} not found`);
      }
    }

    const row = await this.prisma.permissions.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.module_id !== undefined ? { moduleId: dto.module_id } : {}),
      },
      include: { modules: true },
    });

    return {
      ...permissionWire(row),
      module: row.modules ? moduleWire(row.modules) : null,
    };
  }

  async deletePermission(id: string) {
    const existing = await this.prisma.permissions.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Permission ${id} not found`);
    }

    await this.prisma.permissions.delete({
      where: { id },
    });

    return { success: true, id };
  }

  // ---- User assignment ----

  /** Return the list of permission names assigned to a user. */
  async getUserPermissions(userId: string): Promise<string[]> {
    const rows = await this.prisma.userPermissions.findMany({
      where: { userId },
      select: { permissions: { select: { name: true } } },
    });

    return rows.map((r) => r.permissions.name);
  }

  /** Assign a single permission (by name) to a user. */
  async assignPermission(
    userId: string,
    permissionName: string,
    assignedBy?: string,
  ) {
    const permission = await this.findOneByName(permissionName);
    if (!permission) {
      throw new NotFoundException(`Permission "${permissionName}" not found`);
    }

    const existing = await this.prisma.userPermissions.findUnique({
      where: {
        userId_permissionId: {
          userId,
          permissionId: permission.id,
        },
      },
    });
    if (existing) {
      return userPermissionWire(existing); // idempotent
    }

    const row = await this.prisma.userPermissions.create({
      data: {
        userId,
        permissionId: permission.id,
        assignedBy: assignedBy ?? null,
      },
    });
    return userPermissionWire(row);
  }

  /** Revoke a single permission (by name) from a user. */
  async revokePermission(
    userId: string,
    permissionName: string,
  ): Promise<void> {
    const permission = await this.findOneByName(permissionName);
    if (!permission) {
      throw new NotFoundException(`Permission "${permissionName}" not found`);
    }

    // `deleteMany` mirrors TypeORM `delete`, which silently removes 0 rows.
    await this.prisma.userPermissions.deleteMany({
      where: { userId, permissionId: permission.id },
    });
  }

  /** Replace the full set of a user's permissions with the given names. */
  async setUserPermissions(
    userId: string,
    permissionNames: string[],
    assignedBy?: string,
  ): Promise<void> {
    const permissions = await this.prisma.permissions.findMany({
      where: { name: { in: permissionNames } },
    });

    const foundNames = permissions.map((p) => p.name);
    const missing = permissionNames.filter((n) => !foundNames.includes(n));
    if (missing.length > 0) {
      throw new NotFoundException(`Unknown permissions: ${missing.join(', ')}`);
    }

    // Replace: delete existing, insert new.
    await this.prisma.userPermissions.deleteMany({ where: { userId } });

    if (permissions.length > 0) {
      await this.prisma.userPermissions.createMany({
        data: permissions.map((p) => ({
          userId,
          permissionId: p.id,
          assignedBy: assignedBy ?? null,
        })),
      });
    }
  }
}
