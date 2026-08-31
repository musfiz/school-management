"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { toast } from "@/lib/swal";
import { resolveImageUrl, isExternalImage } from "@/lib/media";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

/**
 * Image upload control supporting click-to-browse, drag-and-drop, and
 * paste-from-clipboard (Ctrl+V an image while it's focused). Backed by the
 * shared `/api/uploads` proxy — used for any image field across the dashboard.
 */
export default function ImageUploader({
  value,
  onChange,
  emptyLabel = "No image uploaded",
  previewClassName = "h-40 w-full",
}: {
  value: string;
  onChange: (url: string) => void;
  emptyLabel?: string;
  previewClassName?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast("Only JPEG, PNG, WebP or SVG images are allowed.", "error");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { url: string };
      onChange(json.url);
      toast("Image uploaded.");
    } catch {
      toast("Image upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      uploadFile(file);
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        onPaste={handlePaste}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        aria-label="Upload image — click, drag and drop, or paste"
        className={`relative flex ${previewClassName} items-center justify-center overflow-hidden rounded-md border-2 border-dashed transition-colors ${
          isDragging ? "border-brand-500 bg-brand-50" : "border-ink-300 bg-ink-50"
        }`}
      >
        {value ? (
          <Image
            src={resolveImageUrl(value)}
            alt="Uploaded image"
            fill
            unoptimized={isExternalImage(value)}
            className="object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-4 text-center text-ink-400">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">{emptyLabel}</span>
            <span className="text-[11px]">Click, drag & drop, or paste (Ctrl+V)</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        )}

        {value && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            aria-label="Remove image"
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-ink-600 shadow-soft hover:bg-white hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-60 hover:bg-ink-50"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {value ? "Replace image" : "Upload image"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
