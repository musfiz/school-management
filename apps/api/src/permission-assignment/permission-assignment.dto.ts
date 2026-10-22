import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../database/entities/user-role.enum';
import type { MenuAction } from '../common/decorators/require-permission.decorator';

/** A single menu action flag for a specific menu + user. */
export class MenuPermissionDto {
  @ApiProperty({ example: 'dashboard' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  menuSlug!: string;

  @ApiProperty({ enum: ['canView', 'canCreate', 'canEdit', 'canDelete'] })
  @IsEnum(['canView', 'canCreate', 'canEdit', 'canDelete'] as const)
  action!: MenuAction;

  @ApiProperty()
  @IsBoolean()
  granted!: boolean;
}

/** Bulk upsert of a user's menu-level permissions. */
export class SetUserMenuPermissionsDto {
  @ApiProperty({ description: 'One entry per (menu, action) to set' })
  @IsArray()
  permissions!: MenuPermissionDto[];
}

/** Resets a user's menu permissions back to their role default template. */
export class ResetUserMenuPermissionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  menuSlug?: string; // if omitted, reset all menus for the user
}

/** Single (menu, action) grant/revoke. */
export class ToggleUserMenuPermissionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  menuSlug!: string;

  @ApiProperty({ enum: ['canView', 'canCreate', 'canEdit', 'canDelete'] })
  @IsEnum(['canView', 'canCreate', 'canEdit', 'canDelete'] as const)
  action!: MenuAction;

  @ApiProperty()
  @IsBoolean()
  granted!: boolean;
}

/** Wire shape returned for one menu merged with a user's current flags. */
export class MenuPermissionWire {
  @ApiProperty()
  menuSlug!: string;

  @ApiProperty({ example: 'Dashboard' })
  title!: string;

  @ApiPropertyOptional({ example: '/dashboard' })
  path?: string;

  @ApiProperty({ enum: ['canView', 'canCreate', 'canEdit', 'canDelete'] })
  action!: MenuAction;

  @ApiProperty()
  @IsBoolean()
  granted!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

/** Response for GET /api/permissions/user/:userId — full permission matrix. */
export class UserPermissionMatrixDto {
  @ApiProperty({ type: [MenuPermissionWire] })
  menus!: MenuPermissionWire[];
}
