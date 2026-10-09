import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeroSection } from '../database/entities/hero-section.entity';
import { HeroSectionController } from './hero-section.controller';
import { HeroSectionService } from './hero-section.service';

@Module({
  imports: [TypeOrmModule.forFeature([HeroSection])],
  controllers: [HeroSectionController],
  providers: [HeroSectionService],
  exports: [HeroSectionService],
})
export class HeroSectionModule {}
