import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { FamilyRegistryService } from './family-registry.service';
import { FamilyLookupQueryDto } from './admissions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

class FamilyListQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() zakatEligible?: string;
  @IsOptional() @IsString() limit?: string;
}

class VerifyFamilyDto {
  @IsBoolean() zakatEligible!: boolean;
}

@ApiTags('Admissions — Family Registry')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions/families')
export class FamilyRegistryController {
  constructor(private readonly registry: FamilyRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'Family directory (?search=&zakatEligible=&limit=) with multi-sibling linkage' })
  list(@Query() q: FamilyListQuery) {
    return this.registry.listFamilies({
      search: q.search,
      zakatEligible: q.zakatEligible === undefined ? undefined : q.zakatEligible === 'true',
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Get('lookup')
  @ApiOperation({
    summary:
      'Workflow 1: lookup family by guardian phone / father NID with siblings + sibling-waiver suggestion (<100ms target)',
  })
  lookup(@Query() dto: FamilyLookupQueryDto) {
    return this.registry.lookupByPhoneOrNid(dto.query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Family detail: profile + full child/sibling roster with active enrollment' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.registry.getFamily(id);
  }

  @Patch(':id/verify')
  @ApiOperation({ summary: 'Verify / unverify zakat eligibility (human gate for Fund 02 Lillah boarding)' })
  verify(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyFamilyDto) {
    return this.registry.setZakatVerified(id, dto.zakatEligible);
  }
}
