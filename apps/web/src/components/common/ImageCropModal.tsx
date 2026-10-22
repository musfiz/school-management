"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { FiRotateCw, FiX } from "react-icons/fi";
import {
  IMAGE_UPLOAD_PRESETS,
  ImagePreset,
} from "@/constants/image-upload-presets";
import { getCroppedImg, type CropArea } from "@/lib/crop-image";

export interface ImageCropModalProps {
  /** ObjectURL owned by the parent (uploader) — never revoked here. */
  imageSrc: string;
  preset: ImagePreset;
  onClose: () => void;
  /** Receives the sliced/capped/encoded File. Parent then uploads or holds it. */
  onComplete: (file: File) => void;
}

/** Interactive crop: zoom, pan, 90° rotation — locked to the preset ratio. */
export default function ImageCropModal({
  imageSrc,
  preset,
  onClose,
  onComplete,
}: ImageCropModalProps) {
  const config = IMAGE_UPLOAD_PRESETS[preset];

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback(
    (_: unknown, pixels: CropArea) => setCropArea(pixels),
    [],
  );

  // Escape closes (while not mid-slice — avoids a confusing double action).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const handleConfirm = async () => {
    if (!cropArea) return; // Cropper always emits onCropComplete on mount
    setBusy(true);
    setError(null);
    try {
      const file = await getCroppedImg({
        imageSrc,
        cropArea,
        rotation,
        presetConfig: config,
      });
      onComplete(file);
      // On success the parent unmounts this modal; busy state dies with it.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop image.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Crop ${config.label}`}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xs bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-navy-900">
            Crop {config.label}
            <span className="ml-2 text-xs font-medium text-ink-500">
              {config.width}×{config.height} · aspect ratio{" "}
              {config.aspectRatio?.toFixed(2)}:1
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close cropper"
            className="cursor-pointer rounded-xs p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700 disabled:opacity-50"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Cropper viewport */}
        <div className="relative mt-3 h-[55vh] min-h-72 w-full overflow-hidden rounded-xs bg-navy-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={config.aspectRatio ?? 1}
            maxZoom={4}
            minZoom={1}
            zoomSpeed={0.4}
            zoomWithScroll
            showGrid
            cropShape={preset === ImagePreset.AVATAR ? "round" : "rect"}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              mediaStyle: { maxHeight: "100%", maxWidth: "100%" },
            }}
          />
        </div>

        {/* Zoom + rotation */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex min-w-52 flex-1 items-center gap-2">
            <span className="text-xs font-medium text-ink-700">Zoom</span>
            <input
              aria-label="Zoom"
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full cursor-pointer accent-brand-600"
            />
          </label>
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xs border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
          >
            <FiRotateCw className="h-3.5 w-3.5" />
            Rotate 90°
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-700" role="alert">
            {error}
          </p>
        )}

        {/* Modal footer buttons: 38px standard, disabled:opacity-50 while busy */}
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
            disabled={busy || !cropArea}
            className="cursor-pointer rounded-xs border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Processing..." : "Crop & Use"}
          </button>
        </div>
      </div>
    </div>
  );
}
