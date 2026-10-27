import {
  BadRequestException,
  Injectable,
  Logger,
  PipeTransform,
} from '@nestjs/common';
import * as sharpModule from 'sharp';
import type { Metadata as SharpMetadata } from 'sharp';

// Robust CJS/ESM interop: in CommonJS under ts-node without esModuleInterop,
// require('sharp') returns the callable function directly, so default is undefined.
const sharp: typeof sharpModule.default =
  typeof (sharpModule as any).default === 'function'
    ? (sharpModule as any).default
    : (sharpModule as any);
import {
  ASPECT_RATIO_TOLERANCE,
  IMAGE_PRESET_CONFIG,
  ImagePreset,
  MAX_INPUT_PIXELS,
} from '../constants/image-presets.constant';

/**
 * Input formats accepted, checked against the REAL binary content reported by
 * sharp (decoded from magic bytes) — never against file.mimetype or the
 * filename extension, both of which a Postman client trivially forges.
 *
 * Notably ABSENT: 'svg' (vector XML can embed <script>/event handlers →
 * stored XSS and lateral scripting), 'pdf' (not an image), 'raw' formats.
 */
const ALLOWED_INPUT_FORMATS = new Set([
  'jpeg',
  'png',
  'webp',
  'avif',
  'heif',
  'tiff',
  'gif',
]);

/**
 * XML/SVG sniff — checked BEFORE sharp so scriptable vector payloads are
 * rejected explicitly and never reach the vector loader (vector XML can
 * embed <script>/event handlers → stored XSS). Keeps the error message
 * truthful instead of a misleading decode failure.
 */
function looksLikeVectorXml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 512).toString('latin1').trimStart();
  return /^(<\?xml[\s\S]{0,256}|<!DOCTYPE\s+svg|<svg[\s>])/i.test(head);
}

/**
 * Image optimization + security pipe.
 *
 * Bound with `@UploadedFile(new ImageOptimizationPipe(preset, required))`
 * next to an `@UploadImage(...)` route — the pipe MUST be constructed with
 * the preset (parameter pipes cannot read route metadata, so the preset is
 * passed explicitly; the decorator keeps the same enum for reflector/docs).
 *
 * Trust nothing:
 *  1. Magic bytes  — sharp decodes the real binary header: a renamed
 *     .exe/.html/.php is rejected; mimetype/extension are ignored entirely.
 *  2. Pixel flood  — limitInputPixels caps decode memory; a 100k×100k
 *     "photo" (decompression bomb) is rejected in metadata(), before any
 *     full rasterization.
 *  3. Aspect ratio — strict presets verify the SOURCE ratio (±15%), so
 *     bypassing the frontend cropper with an uncropped/wrong-ratio image
 *     fails with 400 instead of being letterboxed into a broken banner.
 *  4. Sanitize     — auto-orient from EXIF, strip ALL metadata (GPS coords,
 *     device fingerprints, embedded payloads), resize per preset fit,
 *     encode to WebP.
 *
 * Downstream code only ever sees the sanitized WebP asset: the Multer file's
 * buffer/mimetype/originalname are replaced in place.
 */
@Injectable()
export class ImageOptimizationPipe
  implements
    PipeTransform<
      Express.Multer.File | undefined,
      Promise<Express.Multer.File | undefined>
    >
{
  private readonly logger = new Logger(ImageOptimizationPipe.name);

  constructor(
    private readonly preset: ImagePreset,
    private readonly required = true,
  ) {}

  async transform(
    file: Express.Multer.File | undefined,
    metadata?: { type: string },
  ): Promise<Express.Multer.File | undefined> {
    // Param pipes fire only for the bound parameter, but guard defensively
    // in case the pipe is ever reused in a broader scope.
    if (metadata && metadata.type !== 'custom') return file;

    if (!file?.buffer || file.buffer.length === 0) {
      if (this.required) {
        throw new BadRequestException('Image file is required.');
      }
      return undefined; // optional upload — the controller decides
    }

    const config = IMAGE_PRESET_CONFIG[this.preset];
    if (!config) {
      throw new BadRequestException(`Unknown image preset: ${this.preset}`);
    }

    /* ────────────────────────────────────────────────────────────────
     * STEP 1 — Inspect actual binary magic bytes.
     * A non-image payload throws here; an oversized raster (pixel flood)
     * is refused by sharp before any decode buffers are materialized.
     * XML/SVG is sniffed first so scriptable vectors can never reach the
     * vector loader (faceted rejected with a truthful message instead).
     * ──────────────────────────────────────────────────────────────── */
    if (looksLikeVectorXml(file.buffer)) {
      throw new BadRequestException(
        'Unsupported image format (vector XML/SVG is not accepted for upload).',
      );
    }

    let meta: SharpMetadata;
    try {
      meta = await sharp(file.buffer, {
        limitInputPixels: MAX_INPUT_PIXELS,
        failOn: 'error', // refuse truncated / corrupt raster data
      }).metadata();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to decode image for preset ${this.preset} (file: ${file.originalname}, size: ${file.size ?? file.buffer?.length}B): ${message}`,
      );
      if (/dimensions|pixel/i.test(message)) {
        throw new BadRequestException(
          'Image exceeds the maximum allowed dimensions (pixel flood attempt blocked).',
        );
      }
      throw new BadRequestException(
        `Invalid or corrupted image file — the upload is not a decodable image: ${message}`,
      );
    }

    if (!meta.format || !ALLOWED_INPUT_FORMATS.has(meta.format)) {
      throw new BadRequestException(
        `Unsupported image format (${meta.format ?? 'unknown'}). ` +
          'Allowed: JPEG, PNG, WebP, AVIF, HEIF, TIFF, GIF.',
      );
    }

    /* ────────────────────────────────────────────────────────────────
     * STEP 2 — Effective dimensions, EXIF-orientation aware.
     * metadata.width/height are PRE-rotation values; orientations 5–8
     * display the image rotated 90°, so the visible axes are swapped.
     * Without this, a wide banner with orientation=6 can fake a square.
     * ──────────────────────────────────────────────────────────────── */
    const swapAxes = meta.orientation !== undefined && meta.orientation >= 5;
    const srcWidth = (swapAxes ? meta.height : meta.width) ?? 0;
    const srcHeight = (swapAxes ? meta.width : meta.height) ?? 0;

    if (srcWidth < 1 || srcHeight < 1) {
      throw new BadRequestException('Invalid or corrupted image file.');
    }

    /* ────────────────────────────────────────────────────────────────
     * STEP 3 — Aspect-ratio gate for strict presets (anti-Postman).
     * ──────────────────────────────────────────────────────────────── */
    if (config.aspectRatio !== null) {
      const actualRatio = srcWidth / srcHeight;
      const deviation =
        Math.abs(actualRatio - config.aspectRatio) / config.aspectRatio;

      if (deviation > ASPECT_RATIO_TOLERANCE) {
        throw new BadRequestException(
          `Invalid aspect ratio — preset ${this.preset} expects ` +
            `~${config.aspectRatio.toFixed(2)}:1 ` +
            `(${config.width}x${config.height} ±15%), received ` +
            `${actualRatio.toFixed(2)}:1 (${srcWidth}x${srcHeight}). ` +
            'Crop the image with the UI before uploading.',
        );
      }
    }

    /* ────────────────────────────────────────────────────────────────
     * STEP 4 — Sanitize + optimize.
     *  · .rotate()    → auto-orient from EXIF (sharp strips ALL metadata by
     *                   default — GPS coordinates and malicious payloads go
     *                   with it; nothing is re-attached afterwards).
     *  · fit 'cover'  → exact preset box (AVATAR / PASSPORT / BANNERS)
     *  · fit 'inside' → shrink to bounds, ratio preserved, never upscaled
     *                   (DOCUMENT / LOGO — zero pixels cropped)
     *  · .webp()      → single normalized output format for every asset.
     * ──────────────────────────────────────────────────────────────── */
    const pipeline = sharp(file.buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: 'error',
    }).rotate(); // no args = auto-orient

    if (config.fit === 'cover' && config.width && config.height) {
      pipeline.resize(config.width, config.height, {
        fit: 'cover',
        position: 'centre',
      });
    } else {
      pipeline.resize({
        width: config.maxWidth ?? undefined,
        height: config.maxHeight ?? undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const optimized = await pipeline
      .webp({ quality: config.quality, effort: 4 })
      .toBuffer();

    if (!optimized.length) {
      throw new BadRequestException('Image processing produced empty output.');
    }

    /* ────────────────────────────────────────────────────────────────
     * STEP 5 — REPLACE the Multer file in place.
     * ──────────────────────────────────────────────────────────────── */
    file.buffer = optimized;
    file.size = optimized.length;
    file.mimetype = 'image/webp';
    file.originalname = `${(file.originalname || 'image').replace(
      /\.[^./\\]+$/,
      '',
    )}.webp`;

    return file;
  }
}
