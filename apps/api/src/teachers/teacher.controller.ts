import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeacherService } from './teacher.service';
import { CreateTeacherDto, UpdateTeacherDto } from './teacher.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';
import { ImagePreset } from '../common/constants/image-presets.constant';
import { UploadImage } from '../common/decorators/upload-image.decorator';
import { ImageOptimizationPipe } from '../common/pipes/image-optimization.pipe';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  isManagedFileKey,
} from '../modules/storage/interfaces/storage-provider.interface';

@ApiTags('Teachers')
@Controller('teachers')
export class TeacherController {
  private readonly logger = new Logger(TeacherController.name);

  constructor(
    private readonly teacherService: TeacherService,
    // Strategy injection — LocalStorageDriver in dev, S3/R2 in production,
    // identical call sites on this side of the boundary.
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all teachers, in display order' })
  findAll() {
    return this.teacherService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a teacher' })
  create(@Body() dto: CreateTeacherDto) {
    return this.teacherService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a teacher' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTeacherDto) {
    return this.teacherService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a teacher' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teacherService.remove(id);
  }

  /**
   * Direct photo upload — the reference endpoint for the new pipeline.
   *
   * The @UploadImage decorator does all intake security (memory-buffer
   * interception, 5 MB cap) and the param-bound pipe enforces the PASSPORT
   * preset (3:4 ±15% against Postman bypasses), strips EXIF, and encodes
   * WebP at 450×600. `file` below is already the final optimized asset.
   */
  @Post(':id/photo')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @UploadImage('photo', ImagePreset.PASSPORT, 5)
  @ApiOperation({
    summary:
      'Upload a teacher photo (cropped 3:4 on the client, optimized server-side)',
  })
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(new ImageOptimizationPipe(ImagePreset.PASSPORT, true))
    file?: Express.Multer.File,
  ) {
    const fileFound = file?.buffer;
    if (!fileFound) {
      throw new BadRequestException('Image file is required.');
    }

    // 1. Store with the canonical key format: schools/<tenant>/teachers/photos/<uuid>.webp
    const { key } = await this.storage.upload({
      buffer: fileFound,
      folder: 'teachers/photos',
      contentType: file.mimetype,
    });

    // 2. Persist ONLY the relative key. Returns the replaced key (or null).
    //    If the DB update fails, roll the FRESH upload back so it cannot
    //    become a permanent orphan on disk (the old file stays untouched —
    //    the DB still points at it).
    let previousKey: string | null = null;
    try {
      previousKey = await this.teacherService.updatePhoto(id, key);
    } catch (error) {
      await this.storage.deleteFile(key).catch((error) =>
        this.logger.warn(
          `Rollback cleanup failed for ${key}: ${String(error)}`,
        ),
      );
      throw error;
    }

    // 3. Orphan cleanup — delete the OLD file only after the DB commit won.
    //    Legacy rows (hand-written "/uploads/x.jpg" or "/logo.png" URLs) are
    //    never managed by this pipeline, so the guard skips them.
    if (previousKey && previousKey !== key && isManagedFileKey(previousKey)) {
      try {
        await this.storage.deleteFile(previousKey);
      } catch (error) {
        // Non-fatal: log for a periodic sweeper, never fail the upload.
        this.logger.warn(
          `Orphan cleanup failed for ${previousKey}: ${String(error)}`,
        );
      }
    }

    return { key, imageUrl: key };
  }
}
