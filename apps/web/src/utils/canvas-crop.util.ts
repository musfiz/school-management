"use client";

import type { Area } from "react-easy-crop";
import type { PresetConfig } from "@/constants/image-upload-presets";

/**
 * Canvas slicing engine built on the official ValentinH/react-easy-crop
 * rotation recipe, extended with a dimension cap and a per-preset output
 * envelope. Purely a math/render module — no network, no UI.
 *
 * Two modes (dispatched on `pixelCrop`):
 *  · Cropped mode   (`pixelCrop !== null`) — official flow: render the image
 *    rotated onto an oversized bounding-box canvas, slice the exact
 *    `pixelCrop` rect, scale down ONLY if it exceeds the preset bounds.
 *  · Bypass/Document mode (`pixelCrop === null`) — scale the FULL image
 *    inside maxWidth×maxHeight preserving the exact original aspect ratio
 *    (6:19, 19:6, …) so the server's `fit: 'inside'` never has to crop.
 *
 * Output: `File` encoded as image/webp (quality from the preset, 0.88 for
 * most) with a PNG feature-fallback for engines without canvas WebP encoding
 * (Safari < 17) — the NestJS ImageOptimizationPipe normalizes to WebP either
 * way, so the fallback never reaches storage as PNG.
 */

/** Degrees → radians. */
export function getRadianAngle(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Axis-aligned bounding box that fully contains w×h rotated by `rotation`.
 * This is the official sizing step — it guarantees the rotated bitmap is
 * never clipped at any angle.
 */
export function rotateSize(width: number, height: number, rotation: number) {
  const radian = getRadianAngle(rotation);

  return {
    width:
      Math.abs(Math.cos(radian) * width) +
      Math.abs(Math.sin(radian) * height),
    height:
      Math.abs(Math.sin(radian) * width) +
      Math.abs(Math.cos(radian) * height),
  };
}

/** Promise-wrapped <img> loader. `crossOrigin` only for remote http(s) URLs. */
function loadImage(imageSrc: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Could not load the selected image.")),
    );
    if (/^https?:\/\//i.test(imageSrc)) image.crossOrigin = "anonymous";
    image.src = imageSrc;
  });
}

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
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
 * Proportional shrink factor (≤ 1) so width/height fit the preset's
 * bounds. Never upscales — smaller sources keep their native size so the
 * server pipe receives maximal sharpness.
 */
function fitInsideFactor(width: number, height: number, maxW: number, maxH: number): number {
  return Math.min(1, maxW / width, maxH / height);
}

/** Encode a canvas → File using the preset envelope's quality. */
async function encodeCanvas(canvas: HTMLCanvasElement, quality: number, fileName: string): Promise<File> {
  const useWebp = supportsWebpEncoding(canvas);
  const type = useWebp ? "image/webp" : "image/png";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, useWebp ? quality : undefined),
  );
  if (!blob) throw new Error("Could not encode the cropped image.");

  return new File(
    [blob],
    `${fileName}.${useWebp ? "webp" : "png"}`,
    { type, lastModified: Date.now() },
  );
}

/**
 * Produce the ready-to-upload File for a preset.
 *
 * @param imageSrc     ObjectURL / dataURL / absolute URL of the ORIGINAL,
 *                     uncropped image (never a previously-cropped one).
 * @param pixelCrop    Exact crop rect in image pixels from
 *                     `onCropComplete(_, areaPixels)`, or `null` for the
 *                     Document/Logo bypass (full frame, original ratio).
 * @param rotation     Degrees, clockwise (react-easy-crop convention).
 * @param presetConfig Mirrored backend preset (bounds + quality).
 * @param fileName     Base name WITHOUT extension — `image/webp` (or the
 *                     PNG fallback) extension is appended here.
 */
export async function getCroppedWebpFile(
  imageSrc: string,
  pixelCrop: Area | null,
  rotation: number,
  presetConfig: PresetConfig,
  fileName: string,
): Promise<File> {
  const image = await loadImage(imageSrc);

  if (pixelCrop === null) {
    /* ── Bypass / Document mode: full frame, original ratio ──────────── */
    const scale = fitInsideFactor(
      image.width,
      image.height,
      presetConfig.maxWidth,
      presetConfig.maxHeight,
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    getContext2d(canvas).drawImage(image, 0, 0, canvas.width, canvas.height);

    return encodeCanvas(canvas, presetConfig.outputQuality, fileName);
  }

  /* ── Official Cropped mode ───────────────────────────────────────────── */
  const radian = getRadianAngle(rotation);
  const { width: rotatedWidth, height: rotatedHeight } = rotateSize(
    image.width,
    image.height,
    rotation,
  );

  // Pass 1 — rotated safe-area render. Translate to the canvas centre,
  // rotate, then draw the image from its centre: the same centring the
  // official recipe uses, so pixelCrop stays valid at any rotation.
  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = rotatedWidth;
  rotatedCanvas.height = rotatedHeight;
  const rotatedCtx = getContext2d(rotatedCanvas);

  rotatedCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
  rotatedCtx.rotate(radian);
  rotatedCtx.translate(-image.width / 2, -image.height / 2);
  rotatedCtx.drawImage(image, 0, 0);

  // Pass 2 — slice exactly the react-easy-crop `pixelCrop` rectangle out of
  // the rotated bitmap (source rect → dest rect on a fresh canvas).
  const slicedWidth = Math.max(1, Math.round(pixelCrop.width));
  const slicedHeight = Math.max(1, Math.round(pixelCrop.height));
  const slicedCanvas = document.createElement("canvas");
  slicedCanvas.width = slicedWidth;
  slicedCanvas.height = slicedHeight;

  getContext2d(slicedCanvas).drawImage(
    rotatedCanvas,
    pixelCrop.x,
    pixelCrop.y,
    slicedWidth,
    slicedHeight,
    0,
    0,
    slicedWidth,
    slicedHeight,
  );

  // Free the rotated scratch canvas before the export pass.
  rotatedCanvas.width = 0;
  rotatedCanvas.height = 0;

  // Pass 3 — scale down proportionally ONLY if the crop exceeds the preset
  // bounds (the server re-encodes; this upload is smaller and faster).
  const scale = fitInsideFactor(
    slicedWidth,
    slicedHeight,
    presetConfig.maxWidth,
    presetConfig.maxHeight,
  );

  let finalCanvas = slicedCanvas;
  if (scale < 1) {
    const scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = Math.max(1, Math.round(slicedWidth * scale));
    scaledCanvas.height = Math.max(1, Math.round(slicedHeight * scale));
    getContext2d(scaledCanvas).drawImage(
      slicedCanvas,
      0,
      0,
      scaledCanvas.width,
      scaledCanvas.height,
    );
    slicedCanvas.width = 0;
    slicedCanvas.height = 0;
    finalCanvas = scaledCanvas;
  }

  return encodeCanvas(finalCanvas, presetConfig.outputQuality, fileName);
}
