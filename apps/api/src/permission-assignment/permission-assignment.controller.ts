import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MenuPermissionsGuard } from '../common/guards/menu-permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionAssignmentService } from './permission-assignment.service';
import {
  SetUserMenuPermissionsDto,
  ResetUserMenuPermissionsDto,
  UserPermissionMatrixDto,
} from './permission-assignment.dto';
import { UserRole } from '../database/entities/user-role.enum';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Permission Assignment')
@Controller('permissions')
@UseGuards(JwtAuthGuard, MenuPermissionsGuard, RolesGuard)
@ApiBearerAuth()
export class PermissionAssignmentController {
  constructor(private readonly service: PermissionAssignmentService) {}

  /** Full permission matrix for a user (all menus × actions with granted flags). */
  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Get a user's menu-level permission matrix" })
  @ApiResponse({ status: 200, type: UserPermissionMatrixDto })
  getUserPermissions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.getUserPermissionMatrix(userId);
  }

  /** Bulk upsert of a user's menu-level permissions. */
  @Put('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @RequirePermission('permission_management', 'canEdit')
  @ApiOperation({ summary: "Set a user's menu-level permissions" })
  @ApiResponse({ status: 200, description: 'Permissions updated' })
  setUserPermissions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetUserMenuPermissionsDto,
  ) {
    return this.service.setUserMenuPermissions(
      userId,
      dto.permissions.map((p) => ({
        menuSlug: p.menuSlug,
        action: p.action,
        granted: p.granted,
      })),
    );
  }

  /** Reset a user's permissions to their role-default template (all menus, or one menu). */
  @Post('user/:userId/reset')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @RequirePermission('permission_management', 'canEdit')
  @ApiOperation({ summary: "Reset a user's permissions to role defaults" })
  @ApiResponse({ status: 200, description: 'Permissions reset' })
  resetUserPermissions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ResetUserMenuPermissionsDto,
  ) {
    return this.service.resetUserPermissions(userId, dto.menuSlug ?? undefined);
  }
}
