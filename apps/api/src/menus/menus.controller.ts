import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MenusService } from './menus.service';
import {
  MenuChildInputDto,
  MenuItemInputDto,
  ReplaceMenuDto,
} from './menu-item.dto';
import { MenuLocation } from '../database/entities/menu-item.entity';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Menus')
@ApiExtraModels(MenuItemInputDto, MenuChildInputDto)
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get(':location')
  @Public()
  @ApiOperation({
    summary: 'Public menu tree (visible items only) for a given location',
  })
  findPublic(@Param('location') location: MenuLocation) {
    return this.menusService.findPublicTree(location);
  }

  @Get(':location/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Full menu tree including hidden items, for the builder',
  })
  findAll(@Param('location') location: MenuLocation) {
    return this.menusService.findFullTree(location);
  }

  @Put(':location')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace the entire menu tree for a location' })
  replace(
    @Param('location') location: MenuLocation,
    @Body() dto: ReplaceMenuDto,
  ) {
    return this.menusService.replaceTree(location, dto.items);
  }
}
