import { Controller, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

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
}
