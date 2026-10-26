import { Controller, Delete, Inject, Post, Query, UploadedFile, UseGuards, BadRequestException, UseInterceptors } from '@nestjs/common';
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
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  isManagedFileKey,
} from '../modules/storage/interfaces/storage-provider.interface';

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

  /** ID/passport-style photo — strict 3:4, server re-crops to 450×600 WebP.
   *  Pairs with the PASSPORT crop flow on the web (teachers photo form):
   *  posting a 3:4 crop at the AVATAR endpoint would fail its 1:1 ±15% gate. */
  @Post('passport')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @UploadImage('file', ImagePreset.PASSPORT, 5)
  @ApiOperation({
    summary:
      'Upload a passport-style photo (PASSPORT preset pipeline), returns its storage key',
  })
  uploadPassportImage(
    @UploadedFile(new ImageOptimizationPipe(ImagePreset.PASSPORT, true))
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    return this.storage.upload({
      buffer: file.buffer,
      folder: 'passports',
      contentType: file.mimetype,
    });
  }

  /** Wide slider / notice banner — strict 16:9 → 1920×1080 WebP. */
  @Post('banner-16-9')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @UploadImage('file', ImagePreset.BANNER_16_9, 10)
  @ApiOperation({
    summary:
      'Upload a widescreen banner (BANNER_16_9 preset pipeline), returns its storage key',
  })
  uploadBanner169Image(
    @UploadedFile(new ImageOptimizationPipe(ImagePreset.BANNER_16_9, true))
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    return this.storage.upload({
      buffer: file.buffer,
      folder: 'banners/16-9',
      contentType: file.mimetype,
    });
  }

  /** Ultra-wide header banner — strict 19:6 → 1900×600 WebP. */
  @Post('banner-19-6')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @UploadImage('file', ImagePreset.BANNER_19_6, 10)
  @ApiOperation({
    summary:
      'Upload an ultra-wide header banner (BANNER_19_6 preset pipeline), returns its storage key',
  })
  uploadBanner196Image(
    @UploadedFile(new ImageOptimizationPipe(ImagePreset.BANNER_19_6, true))
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    return this.storage.upload({
      buffer: file.buffer,
      folder: 'banners/19-6',
      contentType: file.mimetype,
    });
  }

  /** Logo / signature — transparency preserved, ≤500×500 'inside', WebP. */
  @Post('logo')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @UploadImage('file', ImagePreset.LOGO, 5)
  @ApiOperation({
    summary:
      'Upload a logo or signature (LOGO preset pipeline), returns its storage key',
  })
  uploadLogoImage(
    @UploadedFile(new ImageOptimizationPipe(ImagePreset.LOGO, true))
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    return this.storage.upload({
      buffer: file.buffer,
      folder: 'logos',
      contentType: file.mimetype,
    });
  }

  /** Gallery photo — 3:2 ratio → 1200×800 WebP with crop. */
  @Post('gallery')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @UploadImage('file', ImagePreset.GALLERY, 10)
  @ApiOperation({
    summary:
      'Upload a gallery photo (GALLERY preset pipeline), returns its storage key',
  })
  uploadGalleryImage(
    @UploadedFile(new ImageOptimizationPipe(ImagePreset.GALLERY, true))
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    return this.storage.upload({
      buffer: file.buffer,
      folder: 'gallery',
      contentType: file.mimetype,
    });
  }

  /**
   * Removes a pipeline-managed file from storage. Used by the uploader when
   * the user discards a freshly-uploaded (not yet persisted) image — the key
   * is deleted idempotently. Legacy values (`/uploads/…`, `/logo.png`) and
   * anything outside the managed `schools/` namespace are rejected, so hand
   * -placed static assets can never be reached through this route.
   */
  @Delete()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a managed storage file by key' })
  deleteStored(@Query('key') key: string) {
    if (!key?.trim()) throw new BadRequestException('File key is required');
    if (!isManagedFileKey(key)) {
      throw new BadRequestException('Not a managed storage key');
    }
    return this.storage.deleteFile(key.trim()).then(() => ({ deleted: true }));
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
