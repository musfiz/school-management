import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HeroSectionService } from './hero-section.service';
import { UpdateHeroSectionDto } from './hero-section.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Hero Section')
@Controller('hero-section')
export class HeroSectionController {
  constructor(private readonly heroSectionService: HeroSectionService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Public hero section settings for the homepage' })
  find() {
    return this.heroSectionService.find();
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the hero section settings' })
  update(@Body() dto: UpdateHeroSectionDto) {
    return this.heroSectionService.update(dto);
  }
}
