import { Module } from '@nestjs/common';
import { RoutinesController } from './routines.controller';
import { RoutinesService } from './routines.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../modules/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [RoutinesController],
  providers: [RoutinesService],
  exports: [RoutinesService],
})
export class RoutinesModule {}
