import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto, QueryRoutineDto, UpdateRoutineDto } from './routine.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Routines')
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List active routines with optional filters (public for students)',
  })
  findActive(@Query() query: QueryRoutineDto) {
    return this.routinesService.findActive(query);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all routines including inactive (for admin & teacher management)',
  })
  findAll(@Query() query: QueryRoutineDto) {
    return this.routinesService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single routine by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.routinesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a routine (admin or teacher)' })
  create(@Body() dto: CreateRoutineDto) {
    return this.routinesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a routine (admin or teacher)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoutineDto,
  ) {
    return this.routinesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a routine (admin or teacher)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.routinesService.remove(id);
  }
}
