import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HomepageService } from './homepage.service';
import { CreateHomepageSectionDto, UpdateHomepageSectionDto } from './homepage.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Homepage')
@Controller('homepage/sections')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Visible home page sections with their items (public)' })
  findVisible() {
    return this.homepageService.findVisible();
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'All sections including hidden, for the manager' })
  findAll() {
    return this.homepageService.findAll();
  }

  @Get(':id/items')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Items belonging to one section, including hidden' })
  findItems(@Param('id', ParseIntPipe) id: number) {
    return this.homepageService.findItems(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a homepage section' })
  create(@Body() dto: CreateHomepageSectionDto) {
    return this.homepageService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a section; sending items replaces the whole list' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHomepageSectionDto) {
    return this.homepageService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a section and its items' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.homepageService.remove(id);
  }
}