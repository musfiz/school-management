import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slider } from '../database/entities/slider.entity';
import { SlidersService } from './sliders.service';
import { SlidersController } from './sliders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Slider])],
  controllers: [SlidersController],
  providers: [SlidersService],
})
export class SlidersModule {}
