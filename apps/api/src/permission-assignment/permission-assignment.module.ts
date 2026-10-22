import { Module } from '@nestjs/common';
import { PermissionAssignmentController } from './permission-assignment.controller';
import { PermissionAssignmentService } from './permission-assignment.service';

@Module({
  controllers: [PermissionAssignmentController],
  providers: [PermissionAssignmentService],
  exports: [PermissionAssignmentService],
})
export class PermissionAssignmentModule {}
