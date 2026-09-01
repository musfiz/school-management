import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffMember } from '../database/entities/staff-member.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StaffMember])],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
