import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import {
  CreatePermissionDto,
  AssignPermissionDto,
  SetUserPermissionsDto,
} from './permissions.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Permissions')
@Controller('permissions')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available permissions' })
  findAll() {
    return this.permissionsService.findAllPermissions();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiResponse({ status: 201, description: 'Permission created' })
  @ApiResponse({ status: 409, description: 'Permission already exists' })
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.createPermission(dto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: "List a user's permissions" })
  getUserPermissions(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.getUserPermissions(id);
  }

  @Put('users/:id')
  @ApiOperation({ summary: "Replace a user's permissions" })
  setUserPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetUserPermissionsDto,
    @CurrentUser('id') assignedBy: number,
  ) {
    return this.permissionsService.setUserPermissions(
      id,
      dto.permissions,
      assignedBy,
    );
  }

  @Post('users/:id/assign')
  @ApiOperation({ summary: 'Assign a single permission to a user' })
  assignPermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionDto,
    @CurrentUser('id') assignedBy: number,
  ) {
    return this.permissionsService.assignPermission(
      id,
      dto.permission,
      assignedBy,
    );
  }

  @Post('users/:id/revoke')
  @ApiOperation({ summary: 'Revoke a single permission from a user' })
  revokePermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.permissionsService.revokePermission(id, dto.permission);
  }
}
