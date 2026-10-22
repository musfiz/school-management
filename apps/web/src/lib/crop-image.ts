"use client";

import type { ImageUploadPresetConfig } from "@/constants/image-upload-presets";

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Promise-wrapped <img> loader. crossOrigin only for remote http(s) sources. */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Could not load the selected image.")),
    );
    if (/^https?:\/\//i.test(url)) image.crossOrigin = "anonymous";
    image.src = url;
  });
}

/** Feature-test canvas → WebP encoding (Safari < 17 cannot encode WebP). */
function supportsWebpEncoding(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

/**
 * HTML5 Canvas slicing utility for react-easy-crop.
 *
 * Pass 1 — redraw the image on an oversized √2-scaled square canvas with the
 *          requested rotation applied, so the crop rect is safe at any angle.
 * Pass 2 — slice exactly the user's crop rectangle out of that bitmap.
 * Pass 3 — cap the output to the preset's max dimensions (the server still
 *          re-encodes to WebP; this just protects upload bandwidth).
 * Pass 4 — encode to image/webp (PNG fallback on engines without WebP
 *          encoding; the NestJS pipe normalizes to WebP either way).
 *
 * The caller owns and revokes the ObjectURL (see GlobalImageUploader).
 */
export async function getCroppedImg(params: {
  imageSrc: string;
  cropArea: CropArea; // react-easy-crop `croppedAreaPixels`
  rotation?: number; // degrees, clockwise
  presetConfig: ImageUploadPresetConfig;
}): Promise<File> {
  const { imageSrc, cropArea, rotation = 0, presetConfig } = params;
  const image = await createImage(imageSrc);

  /* ── Pass 1: rotated, safe-area rendering ────────────────────────── */
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available.");

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));
  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5,
  );

  const rotated = ctx.getImageData(0, 0, canvas.width, canvas.height);

  /* ── Pass 2: slice the exact crop rectangle ──────────────────────── */
  const cropped = document.createElement("canvas");
  const croppedCtx = cropped.getContext("2d");
  if (!croppedCtx) throw new Error("Canvas 2D context is not available.");

  cropped.width = Math.round(cropArea.width);
  cropped.height = Math.round(cropArea.height);

  croppedCtx.putImageData(
    rotated,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - cropArea.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - cropArea.y),
  );

  /* ── Pass 3: cap output dimensions to the preset ─────────────────── */
  const maxOutW = presetConfig.maxWidth ?? presetConfig.width ?? cropped.width;
  const maxOutH =
    presetConfig.maxHeight ?? presetConfig.height ?? cropped.height;
  const scale = Math.min(
    1,
    maxOutW / cropped.width,
    maxOutH / cropped.height,
  );

  let finalCanvas = cropped;
  if (scale < 1) {
    const scaled = document.createElement("canvas");
    const scaledCtx = scaled.getContext("2d");
    if (!scaledCtx) throw new Error("Canvas 2D context is not available.");
    scaled.width = Math.max(1, Math.round(cropped.width * scale));
    scaled.height = Math.max(1, Math.round(cropped.height * scale));
    scaledCtx.drawImage(cropped, 0, 0, scaled.width, scaled.height);
    finalCanvas = scaled;
  }

  /* ── Pass 4: encode ─────────────────────────────────────────────── */
  const isWebp = supportsWebpEncoding(finalCanvas);
  const type = isWebp ? "image/webp" : "image/png";

  const blob = await new Promise<Blob | null>((resolve) =>
    finalCanvas.toBlob(
      resolve,
      type,
      isWebp ? presetConfig.quality : undefined,
    ),
  );
  if (!blob) throw new Error("Could not encode the cropped image.");

  const ext = isWebp ? "webp" : "png";
  return new File(
    [blob],
    `${presetConfig.slug}-crop-${Date.now()}.${ext}`,
    { type, lastModified: Date.now() },
  );
}
