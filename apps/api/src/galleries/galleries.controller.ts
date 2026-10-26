import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GalleriesService } from './galleries.service';
import { CreateGalleryDto, UpdateGalleryDto } from './gallery.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Galleries')
@Controller('galleries')
export class GalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List active gallery photos, in display order (public)' })
  findActive() {
    return this.galleriesService.findActive();
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all gallery photos including inactive, for the manager' })
  findAll() {
    return this.galleriesService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single gallery photo by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.galleriesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a gallery photo' })
  create(@Body() dto: CreateGalleryDto) {
    return this.galleriesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a gallery photo' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGalleryDto) {
    return this.galleriesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a gallery photo' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.galleriesService.remove(id);
  }
}
