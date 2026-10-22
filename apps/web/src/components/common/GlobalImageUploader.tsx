"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { FiImage, FiLoader, FiUpload } from "react-icons/fi";
import { toast } from "@/lib/swal";
import {
  IMAGE_UPLOAD_PRESETS,
  type ImagePreset,
} from "@/constants/image-upload-presets";
import ImageCropModal from "./ImageCropModal";

export interface GlobalImageUploaderProps {
  preset: ImagePreset;
  // ── Upload mode (used by dashboard forms that hold a URL string) ─────
  /** Post the ready file through the same-origin proxy and call onChange
   *  with the stored URL. Omit both this and onChange for "file mode". */
  uploadEndpoint?: string;
  // ── File mode (upload handled by the parent, e.g. multipart form) ────
  /** Called with the ready File (crop output for strict presets, raw file
   *  for DOCUMENT/LOGO). Call `onFileReady(null)` to clear the reminder. */
  onFileReady?: (file: File | null) => void;
  // ── Presentation ──────────────────────────────────────────────────────
  /** Current stored image URL (preview) — e.g. form.imageUrl. */
  value?: string | null;
  onChange?: (url: string | null) => void;
  emptyLabel?: string;
  previewClassName?: string;
  disabled?: boolean;
  alt?: string;
}

/**
 * Universal image intake for the global crop/optimize pipeline:
 *
 *  · Ratio-locked presets (AVATAR/PASSPORT/BANNER_*) → file picker →
 *    ImageCropModal (zoom/pan/90° rotation, preset-locked aspect) →
 *    canvas slice with dimension caps → File.
 *  · DOCUMENT / LOGO → file picker → raw file straight through (NO crop —
 *    the server's 'inside' fit preserves every pixel of any ratio).
 *
 * Two delivery modes:
 *  · upload mode (`uploadEndpoint` + `onChange`): the ready file is POSTed
 *    through the same-origin proxy (which attaches the session JWT) and the
 *    stored URL lands in the form field.
 *  · file mode (`onFileReady`): the parent owns the attach/submit step.
 *
 * ObjectURL hygiene: URLs created here are revoked on replace, on modal
 * close, and on unmount — zero leaks.
 */
export default function GlobalImageUploader({
  preset,
  uploadEndpoint,
  onFileReady,
  value,
  onChange,
  emptyLabel = "No image uploaded",
  previewClassName = "h-40 w-full",
  disabled = false,
  alt,
}: GlobalImageUploaderProps) {
  const config = IMAGE_UPLOAD_PRESETS[preset];
  const inputId = useId();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [modalSrc, setModalSrc] = useState<string | null>(null);

  /** Single-owner ObjectURL lifecycle: 'blob:' URLs we created go to
   *  objectUrlRef and die when replaced or unmounted; server URLs
   *  (form values) are never revoked by us. */
  const takeoverObjectUrl = useCallback((url: string | null) => {
    if (
      objectUrlRef.current &&
      objectUrlRef.current !== url
    ) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    objectUrlRef.current = url?.startsWith("blob:") ? url : null;
  }, []);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const clearInput = () => {
    if (inputRef.current) {
      inputRef.current.value = ""; // re-selecting the same file re-fires change
    }
  };

  /** Delivery step shared by both modes: local feedback only — network
   *  errors surface through toasts in upload mode, state in file mode. */
  const handleSubmitFile = useCallback(
    async (file: File) => {
      if (uploadEndpoint && onChange) {
        // ── upload mode: POST through the same-origin proxy ──────────
        setUploading(true);
        setLocalError(null);
        try {
          const form = new FormData();
          form.append("file", file, file.name);
          const res = await fetch(uploadEndpoint, {
            method: "POST",
            credentials: "same-origin", // proxy attaches the session JWT
            body: form,
          });
          const data = (await res.json().catch(() => null)) as {
            url?: string;
            message?: string;
          } | null;
          if (!res.ok) {
            throw new Error(data?.message ?? "Upload failed.");
          }
          if (!data?.url) {
            throw new Error("Upload endpoint returned no URL.");
          }
          onChange(data.url);
          toast({ title: "Success", text: "Image uploaded.", icon: "success" });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Upload failed.";
          setLocalError(message);
          toast({ title: "Error", text: message, icon: "error" });
        } finally {
          setUploading(false);
        }
        return;
      }
      // ── file mode: parent owns delivery ─────────────────────────────
      onFileReady?.(file);
    },
    [uploadEndpoint, onChange, onFileReady],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    clearInput();

    setLocalError(null);
    if (!file) return;

    // Client-side gate mirrors the server's Multer limit — instant feedback.
    // The backend remains the real enforcer (Postman protection lives there).
    if (file.size > config.maxFileSizeMB * 1024 * 1024) {
      const message = `Image must be ≤ ${config.maxFileSizeMB} MB (selected ${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
      setLocalError(message);
      toast({ title: "Validation Error", text: message, icon: "error" });
      return;
    }

    if (config.requiresCrop) {
      // Ratio-locked preset: hand the ObjectURL to the crop modal.
      const objectUrl = URL.createObjectURL(file);
      takeoverObjectUrl(objectUrl);
      setModalSrc(objectUrl);
      return;
    }

    // DOCUMENT / LOGO: no crop — the original file travels intact and the
    // server's 'inside' fit downscales without cropping a pixel.
    void handleSubmitFile(file);
  };

  const closeCropModal = (cropped?: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current); // crop modal lifecycle done
      objectUrlRef.current = null;
    }
    setModalSrc(null);

    if (cropped) void handleSubmitFile(cropped);
  };

  const shownPreview = value || null;

  return (
    <div className="space-y-2">
      <div className="text-left">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          className="hidden"
        />
        <label
          htmlFor={inputId}
          className="sr-only"
          aria-label={`Choose ${config.label} image`}
        >
          Choose {config.label} image
        </label>

        {/* Preview — same dashed drop-look as the dashboard ImageUploader */}
        <div
          className={
            "relative flex items-center justify-center overflow-hidden rounded-xs border-2 border-dashed border-ink-300 bg-ink-50"
          }
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            aria-label={`Replace image — click to choose`}
            className={`flex ${previewClassName} w-full cursor-pointer items-center justify-center`}
          >
            {shownPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary upload URL; unoptimized by design
              <img
                src={shownPreview}
                alt={alt ?? `${config.label} preview`}
                title={shownPreview}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-ink-400">
                <FiImage className="h-6 w-6" />
                <span className="text-xs">{emptyLabel}</span>
                <span className="text-[11px]">
                  Click to choose · {config.requiresCrop ? `crops to ${config.width}×${config.height}` : `max ${config.maxWidth}×${config.maxHeight}`} · max {config.maxFileSizeMB} MB
                </span>
              </div>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <FiLoader className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-xs border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-60 hover:bg-ink-50"
        >
          {uploading ? (
            <FiLoader className="h-4 w-4 animate-spin" />
          ) : (
            <FiUpload className="h-4 w-4" />
          )}
          {shownPreview ? `Replace image` : `Upload image`}
        </button>
      </div>

      {localError && (
        <p className="text-xs text-rose-700" role="alert">
          {localError}
        </p>
      )}

      {modalSrc && (
        <ImageCropModal
          imageSrc={modalSrc}
          preset={preset}
          onClose={() => closeCropModal()}
          onComplete={(file) => closeCropModal(file)}
        />
      )}
    </div>
  );
}
