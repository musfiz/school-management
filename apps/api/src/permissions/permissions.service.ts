import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Permission } from '../database/entities/permission.entity';
import { UserPermission } from '../database/entities/user-permission.entity';
import { Module } from '../database/entities/module.entity';
import { CreatePermissionDto } from './permissions.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserPermission)
    private userPermissionRepository: Repository<UserPermission>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
  ) {}

  // ---- Permission catalog ----

  findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find({
      order: { name: 'ASC' },
      relations: { module: true },
    });
  }

  async findOneByName(name: string): Promise<Permission | null> {
    return this.permissionRepository.findOne({ where: { name } });
  }

  async createPermission(dto: CreatePermissionDto): Promise<Permission> {
    const existing = await this.findOneByName(dto.name);
    if (existing) {
      throw new ConflictException(`Permission "${dto.name}" already exists`);
    }
    const entity = this.permissionRepository.create({ ...dto });
    if (dto.module_id != null) {
      const module = await this.moduleRepository.findOne({
        where: { id: dto.module_id },
      });
      if (!module) {
        throw new NotFoundException(`Module ${dto.module_id} not found`);
      }
      entity.module_id = module.id;
    }
    return this.permissionRepository.save(entity);
  }

  // ---- User assignment ----

  /** Return the list of permission names assigned to a user. */
  async getUserPermissions(userId: number): Promise<string[]> {
    const rows = await this.permissionRepository
      .createQueryBuilder('p')
      .innerJoin(
        'user_permissions',
        'up',
        'up.permission_id = p.id',
      )
      .where('up.user_id = :userId', { userId })
      .select('p.name', 'name')
      .getRawMany();

    return rows.map((r) => r.name);
  }

  /** Assign a single permission (by name) to a user. */
  async assignPermission(
    userId: number,
    permissionName: string,
    assignedBy?: number,
  ): Promise<UserPermission> {
    const permission = await this.findOneByName(permissionName);
    if (!permission) {
      throw new NotFoundException(
        `Permission "${permissionName}" not found`,
      );
    }

    const existing = await this.userPermissionRepository.findOne({
      where: { user_id: userId, permission_id: permission.id },
    });
    if (existing) {
      return existing; // idempotent
    }

    return this.userPermissionRepository.save(
      this.userPermissionRepository.create({
        user_id: userId,
        permission_id: permission.id,
        assigned_by: assignedBy ?? null,
      }),
    );
  }

  /** Revoke a single permission (by name) from a user. */
  async revokePermission(
    userId: number,
    permissionName: string,
  ): Promise<void> {
    const permission = await this.findOneByName(permissionName);
    if (!permission) {
      throw new NotFoundException(
        `Permission "${permissionName}" not found`,
      );
    }

    await this.userPermissionRepository.delete({
      user_id: userId,
      permission_id: permission.id,
    });
  }

  /** Replace the full set of a user's permissions with the given names. */
  async setUserPermissions(
    userId: number,
    permissionNames: string[],
    assignedBy?: number,
  ): Promise<void> {
    const permissions = await this.permissionRepository.find({
      where: { name: In(permissionNames) },
    });

    const foundNames = permissions.map((p) => p.name);
    const missing = permissionNames.filter((n) => !foundNames.includes(n));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Unknown permissions: ${missing.join(', ')}`,
      );
    }

    // Replace: delete existing, insert new.
    await this.userPermissionRepository.delete({ user_id: userId });

    if (permissions.length > 0) {
      await this.userPermissionRepository.save(
        permissions.map((p) => ({
          user_id: userId,
          permission_id: p.id,
          assigned_by: assignedBy ?? null,
        })),
      );
    }
  }
}
