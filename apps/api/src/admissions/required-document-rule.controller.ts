import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequiredDocumentRuleService } from './required-document-rule.service';

@Controller('admissions')
export class RequiredDocumentRuleController {
  constructor(private readonly service: RequiredDocumentRuleService) {}

  /** GET /admissions/required-document-rules — list every rule (active + inactive). */
  @Get('required-document-rules')
  @ApiOperation({ summary: 'List all required-document rules (per-class checklist, active + inactive)' })
  list() {
    return this.service.listAll();
  }

  /** GET /admissions/required-document-rules/class/:classOrDeptId — rules for a specific class. */
  @Get('required-document-rules/class/:classOrDeptId')
  @ApiOperation({ summary: 'Required documents for a specific class or department' })
  listForClass(@Param('classOrDeptId') classOrDeptId: string) {
    return this.service.listForClass(classOrDeptId);
  }

  /** POST /admissions/required-document-rules — add/replace a rule. */
  @Post('required-document-rules')
  @ApiOperation({ summary: 'Add or replace a required-document rule' })
  upsert(@Body() dto: { classOrDeptId: string; documentType: string; isOriginalRequired: boolean }) {
    return this.service.upsert(dto);
  }

  /** PATCH /admissions/required-document-rules/:id — toggle active status. */
  @Patch('required-document-rules/:id')
  @ApiOperation({ summary: 'Toggle active status of a required-document rule' })
  toggleActive(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }

  /** DELETE /admissions/required-document-rules/:id — remove a rule. */
  @Delete('required-document-rules/:id')
  @ApiOperation({ summary: 'Permanently remove a required-document rule' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}