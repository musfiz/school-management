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
import { GoverningBodyService } from './governing-body.service';
import {
  CreateGoverningBodyMemberDto,
  UpdateGoverningBodyMemberDto,
} from './governing-body-member.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Governing Body')
@Controller('governing-body')
export class GoverningBodyController {
  constructor(private readonly governingBodyService: GoverningBodyService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all governing body members, in display order' })
  findAll() {
    return this.governingBodyService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a governing body member' })
  create(@Body() dto: CreateGoverningBodyMemberDto) {
    return this.governingBodyService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a governing body member' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGoverningBodyMemberDto) {
    return this.governingBodyService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a governing body member' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.governingBodyService.remove(id);
  }
}
