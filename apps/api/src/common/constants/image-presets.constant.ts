/**
 * Single source of truth for the image upload pipeline.
 *
 * The Next.js app mirrors this file (apps/web/src/constants/image-upload-presets.ts).
 * Keep both files byte-for-byte in sync when a preset changes; the server is
 * the real enforcer — the frontend copy exists only for UX (cropper geometry,
 * file-size pre-checks).
 */
export enum ImagePreset {
  AVATAR = 'AVATAR',
  PASSPORT = 'PASSPORT',
  BANNER_16_9 = 'BANNER_16_9',
  BANNER_19_6 = 'BANNER_19_6',
  DOCUMENT = 'DOCUMENT',
  LOGO = 'LOGO',
  GALLERY = 'GALLERY',
}

export interface ImagePresetConfig {
  /** Exact final dimensions — used when `fit: 'cover'` (image is cropped server-side). */
  width: number | null;
  height: number | null;
  /** Hard size bounds — used when `fit: 'inside'` (ratio preserved, never crops a pixel). */
  maxWidth: number | null;
  maxHeight: number | null;
  /** Source aspect ratio (w/h) enforced with tolerance. `null` = free-form. */
  aspectRatio: number | null;
  /** sharp resize fit: 'cover' = crop to the exact box, 'inside' = shrink to bounds. */
  fit: 'cover' | 'inside';
  /** Frontend must open the crop modal (ratio-locked presets only). */
  requiresCrop: boolean;
  /** WebP quality 1–100. */
  quality: number;
}

/**
 * Bot-bypass guard: how far the source image may deviate from the preset's
 * aspect ratio. The React cropper always outputs the exact ratio, so a legit
 * browser flow never trips this — a Postman client bypassing the cropper does.
 */
export const ASPECT_RATIO_TOLERANCE = 0.15; // 15%

/** Decompression-bomb guard: ~64 MP input cap (~8000×8000). sharp refuses
 *  to decode anything larger, so memory usage stays bounded. */
export const MAX_INPUT_PIXELS = 64_000_000;

export const IMAGE_PRESET_CONFIG: Record<ImagePreset, ImagePresetConfig> = {
  [ImagePreset.AVATAR]: {
    width: 500,
    height: 500,
    maxWidth: null,
    maxHeight: null,
    aspectRatio: 500 / 500, // 1:1
    fit: 'cover',
    requiresCrop: true,
    quality: 82,
  },
  [ImagePreset.PASSPORT]: {
    width: 450,
    height: 600,
    maxWidth: null,
    maxHeight: null,
    aspectRatio: 450 / 600, // 3:4
    fit: 'cover',
    requiresCrop: true,
    quality: 85,
  },
  [ImagePreset.BANNER_16_9]: {
    width: 1920,
    height: 1080,
    maxWidth: null,
    maxHeight: null,
    aspectRatio: 1920 / 1080, // 16:9
    fit: 'cover',
    requiresCrop: true,
    quality: 80,
  },
  [ImagePreset.BANNER_19_6]: {
    width: 1900,
    height: 600,
    maxWidth: null,
    maxHeight: null,
    aspectRatio: 1900 / 600, // 19:6
    fit: 'cover',
    requiresCrop: true,
    quality: 80,
  },
  [ImagePreset.DOCUMENT]: {
    width: null,
    height: null,
    maxWidth: 1800,
    maxHeight: 1800,
    aspectRatio: null, // preserves 6:19, 19:6, or ANY ratio without cropping
    fit: 'inside',
    requiresCrop: false,
    quality: 85,
  },
  [ImagePreset.LOGO]: {
    width: null,
    height: null,
    maxWidth: 500,
    maxHeight: 500,
    aspectRatio: null,
    fit: 'inside',
    requiresCrop: false,
    quality: 90, // higher quality — transparency survives compression better
  },
  [ImagePreset.GALLERY]: {
    width: 1200,
    height: 800,
    maxWidth: null,
    maxHeight: null,
    aspectRatio: 1200 / 800, // 3:2 standard photo ratio
    fit: 'cover',
    requiresCrop: true,
    quality: 85,
  },
};
