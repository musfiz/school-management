"use client";

import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  AlertCircle,
  Crop,
  RefreshCw,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { PresetConfig } from "@/constants/image-upload-presets";
import { getCroppedWebpFile } from "@/utils/canvas-crop.util";

export interface CropState {
  crop: Point;
  zoom: number;
  rotation: number;
}

export interface CropModalProps {
  isOpen: boolean;
  /** Original (never previously-cropped) ObjectURL. */
  imageSrc: string;
  presetConfig: PresetConfig;
  /** Restored crop position — enables non-destructive re-cropping. */
  initialCrop: Point;
  initialZoom: number;
  initialRotation: number;
  onClose: () => void;
  /** Fires with the slice-ready WebP File + the crop position that made it. */
  onConfirm: (croppedFile: File, cropState: CropState) => void;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.05;
const FINE_ROTATION_MIN = -45;
const FINE_ROTATION_MAX = 45;
const QUICK_ROTATION_STEP = 90;

/** Normalize degrees into [−180, 180). */
function normalizeDegrees(degrees: number): number {
  return (((degrees % 360) + 360) % 360) - 180;
}

/**
 * Interactive cropper for ratio-locked presets. The dark stage
 * (`bg-navy-950`, the repo's near-black palette tone) hosts the
 * react-easy-crop viewport locked to the preset aspect; below it sit the
 * zoom slider (−/+ nudges) and the rotation controls (±90° quick steps,
 * ±45° fine-tune, Reset). The footer follows the shared modal standard —
 * Cancel / "Apply Crop" with a `disabled:opacity-50` processing state.
 *
 * Rotation is modeled as coarse ±90° steps + a ±45° fine-tune; the Cropper
 * receives their sum so the slider stays meaningful at any accumulated angle.
 */
export default function CropModal({
  isOpen,
  imageSrc,
  presetConfig,
  initialCrop,
  initialZoom,
  initialRotation,
  onClose,
  onConfirm,
}: CropModalProps) {
  const [crop, setCrop] = useState<Point>(initialCrop);
  const [zoom, setZoom] = useState(initialZoom);
  const [baseRotation, setBaseRotation] = useState(initialRotation);
  const [fineRotation, setFineRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref mirror so the cropper→viewer rotation sync below never goes stale
  // inside the onRotationChange callback.
  const fineRotationRef = useRef(fineRotation);
  fineRotationRef.current = fineRotation;

  // Escape closes while idle — never mid-slice (avoids a double action).
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processing) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [processing, onClose]);

  if (!isOpen) return null;

  const busy = processing;
  const rotation = baseRotation + fineRotation;

  const clampZoom = (value: number) =>
    Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(4))));

  const nudgeZoom = (direction: 1 | -1) =>
    setZoom((current) => clampZoom(current + direction * ZOOM_STEP));

  const stepRotation = (direction: 1 | -1) =>
    setBaseRotation((current) => normalizeDegrees(current + direction * QUICK_ROTATION_STEP));

  const resetTransform = () => {
    setCrop(initialCrop);
    setZoom(initialZoom);
    setBaseRotation(initialRotation);
    setFineRotation(0);
    setError(null);
  };

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);
    try {
      // skipCrop presets pass `pixelCrop: null` → full-frame bypass inside
      // canvas-crop.util (kept wired for future "adjust only" dialogs).
      const croppedFile = await getCroppedWebpFile(
        imageSrc,
        presetConfig.skipCrop ? null : croppedAreaPixels,
        rotation,
        presetConfig,
        presetConfig.slug,
      );
      onConfirm(croppedFile, { crop, zoom, rotation });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop image.");
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Crop ${presetConfig.label}`}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xs bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">{presetConfig.label}</h3>
            <p className="mt-0.5 text-xs text-ink-500">{presetConfig.helperText}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close cropper"
            title="Close"
            className="cursor-pointer rounded-xs p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cropper stage — dark viewport, ratio locked by the preset */}
        <div className="relative mt-3 h-[400px] w-full overflow-hidden rounded-xs bg-navy-950">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={presetConfig.aspect ?? 1}
            cropShape={presetConfig.cropShape}
            showGrid={presetConfig.showGrid}
            minZoom={ZOOM_MIN}
            maxZoom={ZOOM_MAX}
            zoomSpeed={0.4}
            zoomWithScroll
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={(nextTotal) => {
              // The cropper is fully controlled; sync the coarse component so
              // base + fine always equals whatever the viewer reports.
              setBaseRotation(normalizeDegrees(nextTotal - fineRotationRef.current));
            }}
            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
          />
        </div>

        {/* Zoom — slider + −/+ nudge buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex min-w-56 flex-1 items-center gap-2">
            <span className="text-xs font-medium text-ink-700">Zoom</span>
            <span className="w-12 font-mono text-xs text-ink-500">{zoom.toFixed(2)}×</span>
            <button
              type="button"
              onClick={() => nudgeZoom(-1)}
              aria-label="Zoom out"
              title="Zoom out (−0.05)"
              className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-xs border border-ink-200 bg-white text-ink-700 hover:bg-ink-100"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <input
              aria-label="Zoom"
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(event) => setZoom(clampZoom(Number(event.target.value)))}
              className="w-full cursor-pointer accent-brand-600"
            />
            <button
              type="button"
              onClick={() => nudgeZoom(1)}
              aria-label="Zoom in"
              title="Zoom in (+0.05)"
              className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-xs border border-ink-200 bg-white text-ink-700 hover:bg-ink-100"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </label>
        </div>

        {/* Rotation — ±90° quick steps + ±45° fine-tune + reset */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => stepRotation(-1)}
            title="Rotate −90°"
            aria-label="Rotate counter-clockwise 90 degrees"
            className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-xs border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            −90°
          </button>
          <button
            type="button"
            onClick={() => stepRotation(1)}
            title="Rotate +90°"
            aria-label="Rotate clockwise 90 degrees"
            className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-xs border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
          >
            <RotateCw className="h-3.5 w-3.5" />
            +90°
          </button>

          <label className="flex min-w-56 flex-1 items-center gap-2">
            <span className="text-xs font-medium text-ink-700">Fine</span>
            <span className="w-10 font-mono text-xs text-ink-500">{fineRotation}°</span>
            <input
              aria-label={`Fine rotation, total ${Math.round(rotation)}°`}
              type="range"
              min={FINE_ROTATION_MIN}
              max={FINE_ROTATION_MAX}
              step={1}
              value={fineRotation}
              onChange={(event) => setFineRotation(Math.round(Number(event.target.value)))}
              className="w-full cursor-pointer accent-brand-600"
            />
          </label>

          <button
            type="button"
            onClick={resetTransform}
            title="Reset zoom and rotation"
            className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-xs border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>

        {error && (
          <p
            className="mt-3 flex items-start gap-1.5 rounded-xs border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {/* Modal footer — shared 38px standard */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="cursor-pointer rounded-xs border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || (!presetConfig.skipCrop && !croppedAreaPixels)}
            className="flex cursor-pointer items-center gap-2 rounded-xs border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Crop className="h-4 w-4" aria-hidden />
            )}
            {processing ? "Processing..." : "Apply Crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
