import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { UpsertPageDto } from './page.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Public CMS page content (bilingual) by slug' })
  find(@Param('slug') slug: string) {
    return this.pagesService.findBySlug(slug);
  }

  @Put(':slug')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update a CMS page (bilingual + image)' })
  upsert(@Param('slug') slug: string, @Body() dto: UpsertPageDto) {
    return this.pagesService.upsert(slug, dto);
  }
}
