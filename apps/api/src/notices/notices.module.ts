import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notice } from '../database/entities/notice.entity';
import { NoticesService } from './notices.service';
import { NoticesController } from './notices.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notice])],
  controllers: [NoticesController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
