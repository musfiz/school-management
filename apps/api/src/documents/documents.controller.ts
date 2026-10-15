import { Body, Controller, Get, Header, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiProduces } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';
import { DocumentsService } from './documents.service';
import { GenericReportPdfDto } from './documents.dto';

/**
 * Global server-side PDF documents (pdf-lib — pure JS, identical output on
 * Windows / Linux / macOS; no Chromium or OS-level print drivers needed).
 */
@ApiTags('Documents — Printable PDFs')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT, UserRole.TEACHER)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('money-receipt/:id/pdf')
  @ApiOperation({ summary: 'Printable money receipt PDF (POS collection)' })
  @ApiProduces('application/pdf')
  @Header('Content-Type', 'application/pdf')
  async moneyReceipt(@Param('id') id: string): Promise<StreamableFile> {
    const { filename, buffer } = await this.documentsService.moneyReceiptPdf(id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get('student-invoice/:id/pdf')
  @ApiOperation({ summary: 'Printable student invoice / bill PDF' })
  @ApiProduces('application/pdf')
  @Header('Content-Type', 'application/pdf')
  async studentInvoice(@Param('id') id: string): Promise<StreamableFile> {
    const { filename, buffer } = await this.documentsService.studentInvoicePdf(id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Post('report/pdf')
  @ApiOperation({ summary: 'Generic tabular report PDF (trial balance, aging, audit …)' })
  @ApiProduces('application/pdf')
  @Header('Content-Type', 'application/pdf')
  async genericReport(@Body() dto: GenericReportPdfDto): Promise<StreamableFile> {
    const { filename, buffer } = await this.documentsService.genericReportPdf(dto);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
  }
}
