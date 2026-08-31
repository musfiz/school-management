import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoverningBodyMember } from '../database/entities/governing-body-member.entity';
import { GoverningBodyService } from './governing-body.service';
import { GoverningBodyController } from './governing-body.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GoverningBodyMember])],
  controllers: [GoverningBodyController],
  providers: [GoverningBodyService],
})
export class GoverningBodyModule {}
