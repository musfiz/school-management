import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ example: 'Website Management', description: 'Unique module name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class UpdateModuleDto {
  @ApiProperty({ example: 'Website Management', description: 'Unique module name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
