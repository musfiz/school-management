import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'results.edit',
    description: 'Unique permission name (action.resource)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Edit student results' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Optional module this permission belongs to',
  })
  @IsOptional()
  @IsUUID()
  module_id?: string;
}

export class AssignPermissionDto {
  @ApiProperty({ example: 'results.edit', description: 'Permission name' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  permission!: string;
}

export class SetUserPermissionsDto {
  @ApiProperty({
    example: ['results.view', 'results.edit'],
    description: 'Full list of permission names for the user',
  })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
