import { IsOptional, IsUUID } from 'class-validator';

/** Shared scope filter for the class/section dropdowns (all fields optional). */
export class LookupsScopeQueryDto {
  @IsOptional() @IsUUID() academicSessionId?: string;
  @IsOptional() @IsUUID() classOrDeptId?: string;
}
