import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NoticesService } from './notices.service';
import { CreateNoticeDto, UpdateNoticeDto } from './notice.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Notices')
@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List active published notices (ordered by pinned then publish date)' })
  findAll() {
    return this.noticesService.findAll(true);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all notices including inactive (admin/management)' })
  findAllAdmin() {
    return this.noticesService.findAll(false);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a notice by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.noticesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new notice' })
  create(@Body() dto: CreateNoticeDto) {
    return this.noticesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a notice by ID' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoticeDto) {
    return this.noticesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a notice by ID' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.noticesService.remove(id);
  }
}
