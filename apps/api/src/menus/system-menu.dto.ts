import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export interface CustomActionDef {
  action: string;
  label: string;
}

export interface MenuActionsConfig {
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  custom?: CustomActionDef[];
}

export class CreateSystemMenuDto {
  @ApiProperty({ example: 'fee_management' })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and underscores',
  })
  slug!: string;

  @ApiProperty({ example: 'Fee Management' })
  @IsString()
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ example: '/admin/accounting/collection' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  path?: string;

  @ApiPropertyOptional({ example: 'Zap' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({ example: 'uuid-of-parent' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      custom: [{ action: 'excel', label: 'Excel Export' }],
    },
  })
  @IsOptional()
  actionsConfig?: MenuActionsConfig;
}

export class UpdateSystemMenuDto {
  @ApiPropertyOptional({ example: 'fee_management' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and underscores',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Fee Management' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ example: '/admin/accounting/collection' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  path?: string;

  @ApiPropertyOptional({ example: 'Zap' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({ example: 'uuid-of-parent' })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      custom: [],
    },
  })
  @IsOptional()
  actionsConfig?: MenuActionsConfig;
}
