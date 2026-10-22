/**
 * Mirror of the backend single source of truth
 * (apps/api/src/common/constants/image-presets.constant.ts).
 *
 * The server enforces the same numbers (aspect ratio ±15%, WebP re-encode);
 * this copy exists for client-side UX: cropper geometry, dimension caps,
 * and instant file-size feedback before any bytes hit the network.
 */
export const ImagePreset = {
  AVATAR: "AVATAR",
  PASSPORT: "PASSPORT",
  BANNER_16_9: "BANNER_16_9",
  BANNER_19_6: "BANNER_19_6",
  DOCUMENT: "DOCUMENT",
  LOGO: "LOGO",
} as const;

export type ImagePreset = (typeof ImagePreset)[keyof typeof ImagePreset];

export interface ImageUploadPresetConfig {
  /** Exact final dimensions — used with `fit: "cover"` (ratio-locked presets). */
  width: number | null;
  height: number | null;
  /** Hard dimension bounds — used with `fit: "inside"` (DOCUMENT/LOGO). */
  maxWidth: number | null;
  maxHeight: number | null;
  /** Target aspect ratio (w/h) enforced by the server with ±15% tolerance. */
  aspectRatio: number | null;
  fit: "cover" | "inside";
  /** Ratio-locked → the uploader opens the crop modal for this preset. */
  requiresCrop: boolean;
  quality: number;
  /** Matches @UploadImage(field, preset, maxSizeMB) on the backend. */
  maxFileSizeMB: number;
  /** Human label rendered by the uploader. */
  label: string;
  /** Stored filename prefix in the cropped File. */
  slug: string;
}

export const IMAGE_UPLOAD_PRESETS: Record<
  ImagePreset,
  ImageUploadPresetConfig
> = {
  AVATAR: {
    width: 500,
    height: 500,
    maxWidth: null,
    maxHeight: null,
    aspectRatio: 1,
    fit: "cover",
    requiresCrop: true,
    quality: 82,
    maxFileSizeMB: 5,
    label: "Avatar",
    slug: "avatar",
  },
  PASSPORT: {
    width: 450,
    height: 600,
    maxWidth: null,
    maxHeight: null,
    aspectRatio: 0.75,
    fit: "cover",
    requiresCrop: true,
    quality: 85,
    maxFileSizeMB: 5,
    label: "Photo",
    slug: "passport",
  },
  BANNER_16_9: {
    width: 1920,
    height: 1080,
    maxWidth: null,
    maxHeight: null,
    aspectRatio: 16 / 9,
    fit: "cover",
    requiresCrop: true,
    quality: 80,
    maxFileSizeMB: 10,
    label: "Banner (16:9)",
    slug: "banner-16-9",
  },
  BANNER_19_6: {
    width: 1900,
    height: 600,
    maxWidth: null,
    maxHeight: null,
    aspectRatio: 19 / 6,
    fit: "cover",
    requiresCrop: true,
    quality: 80,
    maxFileSizeMB: 10,
    label: "Banner (19:6)",
    slug: "banner-19-6",
  },
  DOCUMENT: {
    width: null,
    height: null,
    maxWidth: 1800,
    maxHeight: 1800,
    aspectRatio: null, // preserves 6:19, 19:6, or ANY ratio — no crop, ever
    fit: "inside",
    requiresCrop: false,
    quality: 85,
    maxFileSizeMB: 15,
    label: "Image",
    slug: "document",
  },
  LOGO: {
    width: null,
    height: null,
    maxWidth: 500,
    maxHeight: 500,
    aspectRatio: null,
    fit: "inside",
    requiresCrop: false,
    quality: 90,
    maxFileSizeMB: 5,
    label: "Logo",
    slug: "logo",
  },
};
