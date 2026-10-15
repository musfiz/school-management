import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentCollection } from '../database/entities/payment-collection.entity';
import { StudentInvoice } from '../database/entities/student-invoice.entity';
import { StudentInvoiceLine } from '../database/entities/student-invoice-line.entity';
import { SiteSetting } from '../database/entities/site-setting.entity';
import { User } from '../database/entities/user.entity';
import { PdfService } from './pdf.service';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentCollection, StudentInvoice, StudentInvoiceLine, SiteSetting, User]),
  ],
  controllers: [DocumentsController],
  providers: [PdfService, DocumentsService],
  exports: [PdfService, DocumentsService],
})
export class DocumentsModule {}
