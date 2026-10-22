"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type ForwardedRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { Point } from "react-easy-crop";
import {
  AlertCircle,
  Check,
  Crop,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  DEFAULT_MAX_RAW_FILE_SIZE_MB,
  IMAGE_UPLOAD_PRESETS,
  ACCEPTED_MIME_TYPES,
  type ImagePreset,
} from "@/constants/image-upload-presets";
import { getCroppedWebpFile } from "@/utils/canvas-crop.util";
import CropModal, { type CropState } from "./crop-modal";
import { toast } from "@/lib/swal";
import { resolveImageUrl } from "@/lib/media";

/**
 * Imperative handle for external intake — e.g. the admission wizard's webcam
 * capture already sliced by CropModal. Routes through the SAME delivery
 * pipeline as a normal pick/drop (proxy posting, session key tracking,
 * delete-on-remove), so Remove keeps working for files the uploader did not
 * receive from a DOM event.
 */
export interface GlobalImageUploaderHandle {
  /** Deliver an externally-produced file (must be a fresh, uncropped-source WebP). */
  deliverFile: (file: File) => void;
}

export interface GlobalImageUploaderProps {
  preset: ImagePreset;  /* ── URL delivery mode (dashboards that hold a stored URL in the form) ── */
  /** Same-origin proxy endpoint (e.g. "/api/uploads/passport"). When both
   *  `uploadEndpoint` + `onChange` are provided the uploader posts the ready
   *  file itself and the stored URL flows back through `value`. */
  uploadEndpoint?: string;
  value?: string | null;
  onChange?: (url: string | null) => void;

  /* ── File delivery mode (forms that own the multipart FormData) ───────── */
  /** Receives the processed file (cropped WebP for ratio-locked presets,
   *  full-frame downscaled WebP for DOCUMENT/LOGO). `null` clears. */
  onFileReady?: (file: File | null) => void;

  /* ── Presentation ─────────────────────────────────────────────────────── */
  /** Overrides the preset's raw-file cap. Default: per-preset (10MB fallback). */
  maxFileSizeMB?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
  alt?: string;
  /**
   * URL mode only: when the user presses Remove, ALSO send a DELETE for the
   * storage key this uploader posted during the current session, so an
   * uploaded-but-then-discarded image doesn't linger on the server. Opt-in —
   * only flows that hold never-persisted images (draft wizards) should pass
   * `true`; for saved records the DB replace-flow owns deletion instead.
   */
  deleteOnRemove?: boolean;
}

const DEFAULT_CROP_STATE: CropState = { crop: { x: 0, y: 0 }, zoom: 1, rotation: 0 };

type Busy = "processing" | "uploading" | null;

/** Multipart payload for a processed file (field name "file"). */
function buildUploadBody(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return formData;
}

/** Filename base for the processed file: safe, short, extension-less. */
function sanitizeBaseName(name: string): string {
  const base = name
    .replace(/\.[^.\\/]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .slice(0, 48)
    .replace(/^-+|-+$/g, "");
  return base; // falls back to the preset slug at call sites when empty
}

/** Per-preset geometry of the preview card / drop zone. */
function previewGeometry(config: (typeof IMAGE_UPLOAD_PRESETS)[ImagePreset]): {
  className: string;
  style: CSSProperties;
  rounded: string;
  objectFit: "cover" | "contain";
} {
  if (config.aspect === null) {
    // DOCUMENT / LOGO — documents feel like pages: bounded height, contain fit.
    return {
      className: "w-full",
      style: { height: "11rem" },
      rounded: "rounded-xs",
      objectFit: "contain",
    };
  }
  if (config.cropShape === "round") {
    // AVATAR — truly circular preview (avatar exception in the UI rules).
    return {
      className: "mx-auto w-40",
      style: { aspectRatio: "1 / 1" },
      rounded: "rounded-full",
      objectFit: "cover",
    };
  }
  if (config.label.includes("Banner") || config.label.includes("Header")) {
    // Banners stretch across the available width with their live ratio.
    return {
      className: "w-full",
      style: { aspectRatio: `${config.maxWidth} / ${config.maxHeight}` },
      rounded: "rounded-xs",
      objectFit: "cover",
    };
  }
  // PASSPORT-style portraits — compact centered card.
  return {
    className: "mx-auto w-44",
    style: { aspectRatio: `${config.maxWidth} / ${config.maxHeight}` },
    rounded: "rounded-xs",
    objectFit: "cover",
  };
}

/**
 * Universal intake for the image crop/optimize pipeline:
 *
 *  · Ratio-locked presets (AVATAR / PASSPORT / BANNER_*) → validate → open
 *    CropModal locked to the preset → deliver the sliced WebP File.
 *  · skipCrop presets (DOCUMENT / LOGO) → validate → deliver the FULL frame
 *    downscaled inside the preset bounds, original ratio preserved — never
 *    a forced aspect (the server's `fit: 'inside'` re-checks dimensions).
 *
 * Native HTML5 drag & drop with idle / active / error visual states,
 * client-side mime + size validation, non-destructive re-cropping (the
 * ORIGINAL ObjectURL and last crop position survive until the file is
 * replaced or removed), and strict ObjectURL hygiene (revoked on replace,
 * remove, upload swap, and unmount).
 */
function GlobalImageUploader(
  {
    preset,
    uploadEndpoint,
    value,
    onChange,
    onFileReady,
    maxFileSizeMB,
    label,
    disabled = false,
    className = "",
    alt,
    deleteOnRemove = false,
  }: GlobalImageUploaderProps,
  ref: ForwardedRef<GlobalImageUploaderHandle>,
) {
  const config = IMAGE_UPLOAD_PRESETS[preset];
  const inputId = useId();
  const urlMode = Boolean(uploadEndpoint && onChange);

  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Every ObjectURL we created — revoked exactly once, on unmount or replace. */
  const ownedUrlsRef = useRef<Set<string>>(new Set());
  const originalUrlRef = useRef<string | null>(null);
  const originalNameRef = useRef<string>("");
  const dragCounterRef = useRef(0);
  /** Aborts the in-flight proxy upload when Remove is pressed mid-upload. */
  const abortRef = useRef<AbortController | null>(null);
  /**
   * Storage key this uploader posted successfully during the current session
   * (URL mode). Lets Remove unlink the just-uploaded file from the server
   * when `deleteOnRemove` — null means nothing was uploaded here yet, so a
   * Remove can never delete a pre-existing (possibly DB-persisted) file.
   */
  const uploadedKeyRef = useRef<string | null>(null);
  /**
   * Generation token: bumped on acceptFile and remove. Every async
   * continuation (crop bypass slice, upload POST) checks it before touching
   * state, so a Remove mid-flight leaves no stale preview/value behind.
   */
  const actionTokenRef = useRef(0);

  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cropState, setCropState] = useState<CropState>(DEFAULT_CROP_STATE);

  const maxBytes =
    (maxFileSizeMB ?? config.maxFileSizeMB ?? DEFAULT_MAX_RAW_FILE_SIZE_MB) * 1024 * 1024;

  /* ── ObjectURL bookkeeping ────────────────────────────────────────── */
  const trackUrl = useCallback((url: string) => {
    ownedUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeTracked = useCallback((url: string | null) => {
    if (url === null) return;
    if (ownedUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  const releaseAllTracked = useCallback(() => {
    ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    ownedUrlsRef.current.clear();
    originalUrlRef.current = null;
  }, []);

  useEffect(
    () => () => {
      ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      ownedUrlsRef.current.clear();
    },
    [],
  );

  /* ── Parent-driven resets (URL mode): when the form clears imageUrl ── */
  useEffect(() => {
    if (!urlMode) return;
    if ((value === null || value === "") && preview !== null && busy === null) {
      // The stored field was externally emptied → drop staged state too.
      releaseAllTracked();
      setPreview(null);
      setCropState(DEFAULT_CROP_STATE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to parent value resets
  }, [value]);

  /* ── Validation ─────────────────────────────────────────────────────── */
  const validateFile = useCallback(
    (file: File | undefined): string | null => {
      if (disabled || busy !== null) return null;

      if (!file) return "No file detected in the dropped item.";
      if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
        return "Unsupported file type — upload a JPEG, PNG, or WebP image.";
      }
      if (file.size > maxBytes) {
        return `Image exceeds the ${(maxBytes / (1024 * 1024)).toFixed(
          0,
        )} MB limit (selected ${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
      }
      return null;
    },
    [disabled, busy, maxBytes],
  );

  /* ── Delivery: posts via proxy (URL mode) or hands off the File ────── */
  const deliver = useCallback(
    async (file: File, token: number) => {
      if (urlMode) {
        setBusy("uploading");
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const res = await fetch(uploadEndpoint as string, {
            method: "POST",
            credentials: "same-origin", // proxy attaches the session JWT
            body: buildUploadBody(file),
            signal: controller.signal,
          });
          if (token !== actionTokenRef.current) {
            // Removed/replaced mid-upload — drop the result silently.
            return;
          }
          const data = (await res.json().catch(() => null)) as
            | { url?: string; key?: string; message?: string }
            | null;

          if (!res.ok) throw new Error(data?.message ?? "Upload failed.");
          if (!data?.url) throw new Error("Upload endpoint returned no URL.");

          if (data.key) uploadedKeyRef.current = data.key;

          // Server URL owns the preview now — discard the staged ObjectURL.
          revokeTracked(preview);
          setPreview(null);
          setError(null);
          onChange?.(data.url);
          toast({ title: "Success", text: "Image uploaded.", icon: "success" });
        } catch (err) {
          if (controller.signal.aborted) {
            // User-initiated Remove while uploading — no error surface.
            setBusy(null);
            return;
          }
          const message = err instanceof Error ? err.message : "Upload failed.";
          setError(message);
          toast({ title: "Error", text: message, icon: "error" });
        } finally {
          setBusy(null);
          if (abortRef.current === controller) abortRef.current = null;
        }
        return;
      }

      if (token !== actionTokenRef.current) return; // removed before handoff
      // File mode — the parent owns the FormData step; instant handoff.
      onFileReady?.(file);
    },
    [urlMode, uploadEndpoint, onChange, onFileReady, revokeTracked, preview],
  );

  /* ── skipCrop presets: process the full frame immediately ──────────── */
  const processBypass = useCallback(
    async (sourceUrl: string, baseName: string, token: number) => {
      setBusy("processing");
      setError(null);
      try {
        const file = await getCroppedWebpFile(
          sourceUrl,
          null,
          0,
          config,
          baseName || config.slug,
        );
        if (token !== actionTokenRef.current) return; // removed while slicing
        const previewUrl = trackUrl(URL.createObjectURL(file));
        setPreview(previewUrl);
        setBusy(null);
        await deliver(file, token);
      } catch (err) {
        if (token !== actionTokenRef.current) return;
        setError(err instanceof Error ? err.message : "Could not process image.");
        setBusy(null);
      }
    },
    [config, deliver, trackUrl],
  );

  /* ── Intake: file input change + drop both funnel here ─────────────── */
  const acceptFile = useCallback(
    (file: File | undefined) => {
      const message = validateFile(file);
      if (message !== null) {
        setError(message);
        setDragActive(false);
        toast({ title: "Validation Error", text: message, icon: "error" });
        return;
      }
      if (!file) return;

      const token = ++actionTokenRef.current;

      clearInput();

      // Replace anything staged before storing the new original.
      revokeTracked(originalUrlRef.current);
      revokeTracked(preview);
      setError(null);
      setCropState(DEFAULT_CROP_STATE);

      const originalUrl = trackUrl(URL.createObjectURL(file));
      originalUrlRef.current = originalUrl;
      originalNameRef.current = sanitizeBaseName(file.name);

      if (config.skipCrop) {
        void processBypass(originalUrl, originalNameRef.current, token);
      } else {
        setEditOpen(true);
      }
    },
    [validateFile, revokeTracked, preview, trackUrl, config.skipCrop, processBypass],
  );

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = ""; // same-file re-pick re-fires change
  };

  /* ── Drag & drop handlers (counter guards child-boundary flicker) ──── */
  const onDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounterRef.current += 1;
    setDragActive(true);
  };

  const onDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const onDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragActive(false);
    }
  };

  const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounterRef.current = 0;
    setDragActive(false);
    acceptFile(event.dataTransfer.files?.[0]);
  };

  /* ── Preview actions ──────────────────────────────────────────────── */
  const geometry = previewGeometry(config);
  const shownPreview = urlMode ? (preview ?? value) : preview;
  const hasImage = Boolean(shownPreview);
  const interactive = !disabled && busy === null;

  const zoneBorder = error
    ? "border-rose-400 bg-rose-50" // validation / delivery failure
    : dragActive
      ? "border-brand-500 bg-brand-50/60" // active drop target
      : "border-ink-300 bg-ink-50"; // idle

  const remove = () => {
    if (disabled) return;
    // Remove stays live mid-upload: cancel the in-flight proxy request so the
    // file never lands on the server, then invalidate pending async work.
    abortRef.current?.abort();
    abortRef.current = null;
    actionTokenRef.current += 1;
    // Opt-in server cleanup: unlink the file this uploader uploaded during
    // the current session (a discarded fresh upload shouldn't linger in the
    // storage folder). Pre-existing values are never deleted here.
    if (urlMode && deleteOnRemove && uploadedKeyRef.current) {
      const key = uploadedKeyRef.current;
      uploadedKeyRef.current = null;
      void fetch(
        `/api/uploads/delete?key=${encodeURIComponent(key)}`,
        { method: "DELETE" },
      ).catch(() => undefined); // idempotent cleanup — denials fall to the sweeper
    }
    releaseAllTracked();
    clearInput();
    setEditOpen(false);
    setPreview(null);
    setCropState(DEFAULT_CROP_STATE);
    setBusy(null);
    setError(null);
    if (urlMode) onChange?.(null);
    onFileReady?.(null);
  };

  const onZoneKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleModalConfirm = (file: File, state: CropState) => {
    // Non-destructive re-crop: keep the ORIGINAL objectURL + this position.
    setCropState(state);
    setEditOpen(false);
    setError(null);
    const previewUrl = trackUrl(URL.createObjectURL(file));
    setPreview(previewUrl);
    void deliver(file, actionTokenRef.current);
  };

  const handleModalCancel = () => {
    setEditOpen(false);
    if (!hasImage && originalUrlRef.current) {
      // Nothing delivered yet — discard the staged original entirely.
      revokeTracked(originalUrlRef.current);
      originalUrlRef.current = null;
      setCropState(DEFAULT_CROP_STATE);
    }
  };

  /* ── External intake (imperative) ─────────────────────────────────────
   * Feeds an externally-produced file through the standard pipeline so the
   * session key bookkeeping (uploadedKeyRef) stays true for delete-on-remove. */
  useImperativeHandle(
    ref,
    () => ({
      deliverFile: (file: File) => {
        if (disabled) return;
        const token = ++actionTokenRef.current;
        // Replace anything staged/owned, then deliver like a normal intake.
        releaseAllTracked();
        clearInput();
        originalUrlRef.current = null; // no staged original → Re-crop hidden
        setCropState(DEFAULT_CROP_STATE);
        setError(null);
        void deliver(file, token);
      },
    }),
    [disabled, deliver, releaseAllTracked],
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-ink-700">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_MIME_TYPES.join(",")}
        onChange={(event) => acceptFile(event.target.files?.[0])}
        disabled={disabled || busy !== null}
        className="hidden"
      />

      {/* Drop zone / preview card */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={hasImage ? "Replace image — drop a file or press Enter to browse" : "Upload image — drop a file or press Enter to browse"}
        onClick={() => interactive && inputRef.current?.click()}
        onKeyDown={onZoneKeyDown}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`group relative flex cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed transition-colors
          ${geometry.className} ${geometry.rounded} ${zoneBorder}
          ${disabled ? "cursor-not-allowed opacity-60" : ""}
          focus-within:border-brand-500`}
        style={geometry.style}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary upload URL; unoptimized by design
          <img
            // Stored values are API-relative paths (/uploads/...) or storage
            // keys (schools/...) — resolve against the API base for display.
            src={resolveImageUrl(shownPreview)}
            alt={alt ?? `${config.label} preview`}
            title={resolveImageUrl(shownPreview)}
            className={`h-full w-full ${geometry.objectFit === "contain" ? "object-contain" : "object-cover"}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-ink-400">
            <UploadCloud className="h-8 w-8" aria-hidden />
            <span className="text-xs font-medium">Drag &amp; drop or click to browse</span>
            <span className="text-[11px]">
              {config.helperText} · max {maxBytes / (1024 * 1024)} MB
            </span>
          </div>
        )}

        {/* Hover overlay — Re-crop / Change / Remove (never in skipCrop mode) */}
        {hasImage && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-navy-900/70 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            {!config.skipCrop && (
              <button
                type="button"
                aria-label="Re-crop image"
                title="Re-crop (keeps original + last position)"
                onClick={(event) => {
                  event.stopPropagation();
                  if (interactive && originalUrlRef.current) setEditOpen(true);
                }}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xs border border-white/40 text-white hover:bg-white/10"
              >
                <Crop className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label="Change image"
              title="Change image"
              onClick={(event) => {
                event.stopPropagation();
                if (interactive) inputRef.current?.click();
              }}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xs border border-white/40 text-white hover:bg-white/10"
            >
              <UploadCloud className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Remove image"
              title="Remove"
              onClick={(event) => {
                event.stopPropagation();
                remove();
              }}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xs border border-rose-300 text-rose-200 hover:bg-rose-600/30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Success badge whenever a ready image sits in the card */}
        {hasImage && busy === null && (
          <span
            className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white"
            title="Ready"
          >
            <Check className="h-3 w-3" />
          </span>
        )}

        {/* Busy overlay while slicing (skipCrop) or uploading (URL mode) */}
        {busy !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="flex items-center gap-2 text-xs font-medium text-ink-700">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600" aria-hidden />
              {busy === "processing" ? "Processing..." : "Uploading..."}
            </span>
          </div>
        )}
      </div>

      {/* Field chrome under the zone */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-500">{config.helperText}</span>
        <button
          type="button"
          onClick={() => interactive && inputRef.current?.click()}
          disabled={!interactive}
          className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-xs border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-50"
        >
          <UploadCloud className="h-3.5 w-3.5" aria-hidden />
          {hasImage ? "Replace image" : "Upload image"}
        </button>
      </div>

      {error && (
        <p
          className="flex items-start gap-1.5 rounded-xs border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {editOpen && originalUrlRef.current && (
        <CropModal
          isOpen
          imageSrc={originalUrlRef.current}
          presetConfig={config}
          initialCrop={cropState.crop}
          initialZoom={cropState.zoom}
          initialRotation={cropState.rotation}
          onClose={handleModalCancel}
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  );
}

export default forwardRef<GlobalImageUploaderHandle, GlobalImageUploaderProps>(
  GlobalImageUploader,
);
