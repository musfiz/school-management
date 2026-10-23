import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MenusService } from './menus.service';
import { CreateSystemMenuDto, UpdateSystemMenuDto } from './system-menu.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('System Menus')
@Controller('system-menus')
// JwtAuthGuard and MenuPermissionsGuard are registered globally in AppModule (APP_GUARD).
// RolesGuard verifies role hierarchy against req.user.role.
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@ApiBearerAuth()
export class SystemMenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get()
  @RequirePermission('permission_management', 'canView')
  @ApiOperation({ summary: 'List all system menus' })
  findAll() {
    return this.menusService.findAllSystemMenus();
  }

  @Post()
  @RequirePermission('permission_management', 'canCreate')
  @ApiOperation({ summary: 'Create a new system menu' })
  @ApiResponse({ status: 201, description: 'Menu created' })
  create(@Body() dto: CreateSystemMenuDto) {
    return this.menusService.createSystemMenu(dto);
  }

  @Patch(':id')
  @RequirePermission('permission_management', 'canEdit')
  @ApiOperation({ summary: 'Update a system menu' })
  update(@Param('id') id: string, @Body() dto: UpdateSystemMenuDto) {
    return this.menusService.updateSystemMenu(id, dto);
  }

  @Delete(':id')
  @RequirePermission('permission_management', 'canDelete')
  @ApiOperation({ summary: 'Delete a system menu' })
  remove(@Param('id') id: string) {
    return this.menusService.deleteSystemMenu(id);
  }
}
