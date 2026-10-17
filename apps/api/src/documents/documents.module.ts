import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  controllers: [DocumentsController],
  providers: [PdfService, DocumentsService],
  exports: [PdfService, DocumentsService],
})
export class DocumentsModule {}
