import { Controller, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Multer disk-storage config for a given destination folder. The returned
 *  public URL (`/uploads/<folder>/<uuid>.<ext>`) is resolved to an absolute
 *  URL on the web side by `resolveImageUrl`, so the folder lives under the
 *  API's static `./uploads` root. */
function imageStorage(destination: string) {
  return diskStorage({
    destination,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  });
}

// Shared interceptor options (limits + file-type gate) for every upload route.
const interceptorOptions = {
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, WebP or SVG images are allowed'), false);
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
    FileInterceptor('file', { ...interceptorOptions, storage: imageStorage('./uploads') }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/${file.filename}` };
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
      ...interceptorOptions,
      storage: imageStorage('./uploads/hero-slider'),
    }),
  )
  uploadHeroSlider(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/hero-slider/${file.filename}` };
  }
}
