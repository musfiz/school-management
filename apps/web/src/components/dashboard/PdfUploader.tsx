"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "@/lib/swal";
import { resolveImageUrl } from "@/lib/media";

export default function PdfUploader({
  value,
  onChange,
  label = "Attach PDF Document",
  endpoint = "/api/uploads/document",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  endpoint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast({
        title: "Validation Error",
        text: "Only PDF files are allowed.",
        icon: "error",
      });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        text: "PDF size must be under 15MB.",
        icon: "error",
      });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { url: string };
      onChange(json.url);
      toast({
        title: "Success",
        text: "PDF document uploaded successfully.",
        icon: "success",
      });
    } catch {
      toast({
        title: "Error",
        text: "PDF upload failed. Please try again.",
        icon: "error",
      });
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadFile(file);
  }

  const fileName = value ? value.split("/").pop() : "";

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-ink-700">{label}</span>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">{fileName}</p>
              <a
                href={resolveImageUrl(value)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline"
              >
                View PDF attachment
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={uploading}
              className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
              aria-label="Remove PDF"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink-300 bg-ink-50 px-4 py-4 text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50/20"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          ) : (
            <Upload className="h-5 w-5 text-ink-400" />
          )}
          <span className="text-sm font-medium">
            {uploading ? "Uploading PDF..." : "Upload Notice PDF (up to 15MB)"}
          </span>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
