import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PermissionAssignmentModule } from '../permission-assignment/permission-assignment.module';

@Module({
  imports: [PermissionAssignmentModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
