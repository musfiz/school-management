import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WaiverCalculatorService } from './waiver-calculator.service';
import { ApplyLillahDto, CalculateWaiverQueryDto, CreatePresetDto, UpdatePresetDto } from './admissions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Admissions — Waiver Calculator')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions')
export class WaiverCalculatorController {
  constructor(private readonly calc: WaiverCalculatorService) {}

  @Get('waivers/calculate')
  @ApiOperation({ summary: 'Workflow 2: GPA/quota/residence → waiver suggestions (Lillah blocked unless zakat-verified)' })
  calculate(@Query() q: CalculateWaiverQueryDto) {
    return this.calc.calculate(q);
  }

  @Post('waivers/lillah')
  @ApiOperation({ summary: 'Grant 100% LILLAH_ZAKAT_ORPHAN waiver (Fund 02 + 41904) for an admitted student — zakat gate enforced' })
  applyLillah(@Body() dto: ApplyLillahDto) {
    return this.calc.applyLillahWaiver(dto.studentId, dto.familyId, dto.remark);
  }

  @Get('waiver-presets')
  @ApiOperation({ summary: 'List waiver preset rules (?activeOnly=true)' })
  presets(@Query('activeOnly') activeOnly?: string) {
    return this.calc.listRules(activeOnly === 'true');
  }

  @Post('waiver-presets/seed-defaults')
  @ApiOperation({ summary: 'Seed standard preset catalogue (Golden GPA5, GPA4+, sibling, freedom-fighter, Lillah…)' })
  seedDefaults() {
    return this.calc.seedDefaults();
  }

  @Post('waiver-presets')
  @ApiOperation({ summary: 'Create a waiver preset rule' })
  createPreset(@Body() dto: CreatePresetDto) {
    return this.calc.createRule(dto);
  }

  @Patch('waiver-presets/:id')
  @ApiOperation({ summary: 'Update / deactivate a waiver preset rule' })
  updatePreset(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePresetDto) {
    return this.calc.updateRule(id, dto as Record<string, unknown>);
  }
}
