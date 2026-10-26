/**
 * Mirror of the backend single source of truth
 * (apps/api/src/common/constants/image-presets.constant.ts).
 *
 * Geometry + quality numbers (aspectRatio, maxWidth/maxHeight, fit) MUST match
 * the server preset map — the server is the real enforcer (aspect gate ±15%,
 * metadata strip, WebP re-encode, Multer size caps). UI-only fields
 * (label, helperText, cropShape, showGrid) live here and need no backend
 * counterpart; the backend copy never imports this file.
 */
export const ImagePreset = {
  AVATAR: "AVATAR",
  PASSPORT: "PASSPORT",
  BANNER_16_9: "BANNER_16_9",
  BANNER_19_6: "BANNER_19_6",
  DOCUMENT: "DOCUMENT",
  LOGO: "LOGO",
  GALLERY: "GALLERY",
} as const;

export type ImagePreset = (typeof ImagePreset)[keyof typeof ImagePreset];

/** Crop shape accepted directly by `react-easy-crop`'s `cropShape` prop. */
export type PresetCropShape = "round" | "rect";

export interface PresetConfig {
  /** Target aspect ratio (w/h). `null` for skipCrop presets — the original
   *  ratio (6:19, 19:6, anything) is preserved without cropping a pixel. */
  aspect: number | null;
  /** Hard output bounds — the canvas engine scales down proportionally
   *  when the crop/output exceeds these. */
  maxWidth: number;
  maxHeight: number;
  /** `true` (DOCUMENT / LOGO): the uploader bypasses the crop modal and
   *  delivers the full original frame — matches the server `fit: 'inside'`. */
  skipCrop: boolean;
  /** Visual form of the crop viewport + preview. */
  cropShape: PresetCropShape;
  /** Rule-of-thirds grid inside the crop viewport. */
  showGrid: boolean;
  /** Human label rendered above the widget / in the modal header. */
  label: string;
  /** One-line helper rendered under the widget. */
  helperText: string;
  /** Canvas WebP export quality (the server re-encodes afterwards). */
  outputQuality: number;
  /** Raw input cap — mirrors the backend `@UploadImage(field, preset, maxMB)`. */
  maxFileSizeMB: number;
  /** Stored filename prefix for cropped/optimized files. */
  slug: string;
}

export const IMAGE_UPLOAD_PRESETS: Record<ImagePreset, PresetConfig> = {
  [ImagePreset.AVATAR]: {
    aspect: 1 / 1,
    maxWidth: 500,
    maxHeight: 500,
    skipCrop: false,
    cropShape: "round",
    showGrid: false,
    label: "Profile Photo (1:1)",
    helperText: "Square ratio, ideal for student/teacher avatars",
    outputQuality: 0.88,
    maxFileSizeMB: 5, // backend: @UploadImage(..., AVATAR, 5)
    slug: "avatar",
  },
  [ImagePreset.PASSPORT]: {
    aspect: 3 / 4,
    maxWidth: 450,
    maxHeight: 600,
    skipCrop: false,
    cropShape: "rect",
    showGrid: true,
    label: "ID Card Photo (3:4)",
    helperText: "Passport ratio (3:4) for printable ID cards",
    outputQuality: 0.88,
    maxFileSizeMB: 5, // backend: @UploadImage(..., PASSPORT, 5)
    slug: "passport",
  },
  [ImagePreset.BANNER_16_9]: {
    aspect: 16 / 9,
    maxWidth: 1920,
    maxHeight: 1080,
    skipCrop: false,
    cropShape: "rect",
    showGrid: true,
    label: "Event Banner (16:9)",
    helperText: "Widescreen banner (1920x1080)",
    outputQuality: 0.88,
    maxFileSizeMB: 10,
    slug: "banner-16-9",
  },
  [ImagePreset.BANNER_19_6]: {
    aspect: 19 / 6,
    maxWidth: 1900,
    maxHeight: 600,
    skipCrop: false,
    cropShape: "rect",
    showGrid: true,
    label: "Website Header (19:6)",
    helperText: "Ultra-wide header banner (1900x600)",
    outputQuality: 0.88,
    maxFileSizeMB: 10,
    slug: "banner-19-6",
  },
  [ImagePreset.DOCUMENT]: {
    aspect: null, // preserves 6:19 / 19:6 / ANY ratio — no crop, ever
    maxWidth: 1800,
    maxHeight: 1800,
    skipCrop: true,
    cropShape: "rect",
    showGrid: false,
    label: "Notice / Document (Original Ratio)",
    helperText: "Preserves full original aspect ratio (e.g., 6:19 or 19:6) without cropping",
    outputQuality: 0.88,
    maxFileSizeMB: 15, // backend: @UploadImage(..., DOCUMENT, 15)
    slug: "document",
  },
  [ImagePreset.LOGO]: {
    aspect: null,
    maxWidth: 500,
    maxHeight: 500,
    skipCrop: true,
    cropShape: "rect",
    showGrid: false,
    label: "School Logo / Signature",
    helperText: "Preserves transparency and original aspect ratio",
    outputQuality: 0.9, // higher — transparency survives compression better
    maxFileSizeMB: 5,
    slug: "logo",
  },
  [ImagePreset.GALLERY]: {
    aspect: 3 / 2,
    maxWidth: 1200,
    maxHeight: 800,
    skipCrop: false,
    cropShape: "rect",
    showGrid: true,
    label: "Gallery Photo (3:2)",
    helperText: "Standard 3:2 ratio, ideal for campus events & photo gallery",
    outputQuality: 0.88,
    maxFileSizeMB: 10,
    slug: "gallery",
  },
};

/**
 * Client-side MIME gate mirrors the spec'd intake: JPEG / PNG / WebP.
 * (The server pipe additionally accepts AVIF/HEIF/TIFF/GIF binaries via its
 * magic-byte list; the UI keeps the fast path strict and predictable.)
 */
export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Fallback when a preset has no dedicated cap. */
export const DEFAULT_MAX_RAW_FILE_SIZE_MB = 10;
