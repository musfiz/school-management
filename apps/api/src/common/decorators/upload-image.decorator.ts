import { SetMetadata, applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ImagePreset } from '../constants/image-presets.constant';

/** Route metadata — documents the binding and is available to reflectors,
 *  guards, and future audit tooling. */
export const IMAGE_UPLOAD_META = 'IMAGE_UPLOAD_META';

export interface ImageUploadMeta {
  preset: ImagePreset;
  maxSizeMB: number;
  required: boolean;
  fieldName: string;
}

/**
 * Method-level upload wiring — one line next to @Post / @Patch:
 *
 *   @Post(':id/photo')
 *   @UploadImage('photo', ImagePreset.AVATAR, 5)
 *   @UploadedFile(new ImageOptimizationPipe(ImagePreset.AVATAR))
 *   upload(@UploadedFile() file) { ... }   ← see full signature below
 *
 * What it composes:
 *  1. FileInterceptor with Multer memoryStorage() — the raw upload never
 *     touches disk before passing security validation. A rejected file
 *     leaves zero residue (nothing to clean up), and only optimized WebP
 *     buffers reach the storage layer.
 *  2. Hard file-size limit (limits.fileSize) — oversized bodies are
 *     rejected by Multer BEFORE the full buffer is materialized.
 *  3. Swagger metadata so the OpenAPI UI offers a file picker.
 *
 * Pair it with the pipe bound to the param — parameter pipes cannot read
 * route metadata, so the preset is declared explicitly on both the
 * decorator and the pipe constructor (single source is the enum itself):
 *
 *   @UploadImage('photo', ImagePreset.AVATAR, 5, true)
 *   async handler(
 *     ...
 *     @UploadedFile(new ImageOptimizationPipe(ImagePreset.AVATAR, true))
 *     file?: Express.Multer.File,
 *   ) {}
 */
export function UploadImage(
  fieldName: string,
  preset: ImagePreset,
  maxSizeMB = 5,
  required = true,
) {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        storage: memoryStorage(),
        limits: {
          fileSize: maxSizeMB * 1024 * 1024,
          files: 1,
        },
      }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: { [fieldName]: { type: 'string', format: 'binary' } },
        required: required ? [fieldName] : [],
      },
    }),
    SetMetadata(IMAGE_UPLOAD_META, {
      preset,
      maxSizeMB,
      required,
      fieldName,
    } satisfies ImageUploadMeta),
  );
}
