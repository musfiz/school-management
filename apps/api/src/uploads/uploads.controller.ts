import { Controller, Inject, Post, UploadedFile, UseGuards, BadRequestException, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';
import {
  ImagePreset,
} from '../common/constants/image-presets.constant';
import { ImageOptimizationPipe } from '../common/pipes/image-optimization.pipe';
import { UploadImage } from '../common/decorators/upload-image.decorator';
import { IStorageProvider, STORAGE_PROVIDER } from '../modules/storage/interfaces/storage-provider.interface';

const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const ALLOWED_DOC_MIME = ['application/pdf'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOC_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/** Multer disk-storage config for a given destination folder. The returned
 *  public URL (`/uploads/<folder>/<uuid>.<ext>`) is resolved to an absolute
 *  URL on the web side by `resolveImageUrl`, so the folder lives under the
 *  API's static `./uploads` root. */
function uploadStorage(destination: string) {
  return diskStorage({
    destination,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  });
}

// Shared interceptor options for images
const imageInterceptorOptions = {
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, WebP or SVG images are allowed'), false);
      return;
    }
    cb(null, true);
  },
};

// Document interceptor options (PDFs)
const docInterceptorOptions = {
  limits: { fileSize: MAX_DOC_SIZE_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    if (!ALLOWED_DOC_MIME.includes(file.mimetype)) {
      cb(new BadRequestException('Only PDF documents are allowed'), false);
      return;
    }
    cb(null, true);
  },
};

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    // Optimized preset endpoints below store through the storage strategy.
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  /** Generic image upload → `/uploads/<uuid>.<ext>`. */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image, returns its public /uploads URL' })
  @UseInterceptors(
    FileInterceptor('file', { ...imageInterceptorOptions, storage: uploadStorage('./uploads') }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/${file.filename}` };
  }

  /** Notice & general document upload (PDF) → `/uploads/documents/<uuid>.<ext>`. */
  @Post('document')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a PDF document, returns its public /uploads/documents URL' })
  @UseInterceptors(
    FileInterceptor('file', {
      ...docInterceptorOptions,
      storage: uploadStorage('./uploads/documents'),
    }),
  )
  uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/documents/${file.filename}` };
  }

  /** Home slider image upload → `/uploads/hero-slider/<uuid>.<ext>`. */
  @Post('hero-slider')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a hero slider image, returns its public /uploads/hero-slider URL' })
  @UseInterceptors(
    FileInterceptor('file', {
      ...imageInterceptorOptions,
      storage: uploadStorage('./uploads/hero-slider'),
    }),
  )
  uploadHeroSlider(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/hero-slider/${file.filename}` };
  }

  /* ────────────────────────────────────────────────────────────────────
   * Preset-driven optimized endpoints (new pipeline).
   *
   * Unlike the legacy endpoints above, these:
   *  · hold the upload in Multer memoryStorage (validated before any write)
   *  · verify REAL binary magic bytes (mimetype/extension are ignored)
   *  · refuse pixel-flood rasters (64 MP decode cap)
   *  · enforce the preset's aspect ratio (±15%) so bypassing the UI cropper
   *    with Postman fails with 400 instead of producing a broken asset
   *  · strip all EXIF/metadata and normalize to WebP
   *  · store via the storage strategy under schools/<tenant>/<folder>/<uuid>.webp
   * ──────────────────────────────────────────────────────────────────── */

  /** Member/ID-style photo — strict 1:1, cropped and re-encoded to WebP. */
  @Post('avatar')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @UploadImage('file', ImagePreset.AVATAR, 5)
  @ApiOperation({
    summary:
      'Upload a square avatar photo (AVATAR preset pipeline), returns its storage key',
  })
  uploadAvatarImage(
    @UploadedFile(new ImageOptimizationPipe(ImagePreset.AVATAR, true))
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    return this.storage.upload({
      buffer: file.buffer,
      folder: 'avatars',
      contentType: file.mimetype,
    });
  }

  /** Optimized generic image — max 1800 px bounds, ratio preserved, WebP. */
  @Post('optimized')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @UploadImage('file', ImagePreset.DOCUMENT, 15)
  @ApiOperation({
    summary:
      'Upload an optimized image (DOCUMENT preset pipeline), returns its storage key',
  })
  uploadOptimizedImage(
    @UploadedFile(new ImageOptimizationPipe(ImagePreset.DOCUMENT, true))
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    return this.storage.upload({
      buffer: file.buffer,
      folder: 'optimized',
      contentType: file.mimetype,
    });
  }
}
