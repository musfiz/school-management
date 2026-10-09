import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomepageSection } from '../database/entities/homepage-section.entity';
import { HomepageItem } from '../database/entities/homepage-item.entity';
import { HomepageService } from './homepage.service';
import { HomepageController } from './homepage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HomepageSection, HomepageItem])],
  controllers: [HomepageController],
  providers: [HomepageService],
  exports: [HomepageService],
})
export class HomepageModule {}