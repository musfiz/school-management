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
import { ExPrincipalsService } from './ex-principals.service';
import { CreateExPrincipalDto, UpdateExPrincipalDto } from './ex-principal.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Ex-Principals')
@Controller('ex-principals')
export class ExPrincipalsController {
  constructor(private readonly exPrincipalsService: ExPrincipalsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all former principals, in display order' })
  findAll() {
    return this.exPrincipalsService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a former principal' })
  create(@Body() dto: CreateExPrincipalDto) {
    return this.exPrincipalsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a former principal' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExPrincipalDto) {
    return this.exPrincipalsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a former principal' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.exPrincipalsService.remove(id);
  }
}
