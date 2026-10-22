"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import GlobalImageUploader from "@/components/common/image-uploader/global-image-uploader";
import { ImagePreset } from "@/constants/image-upload-presets";
import DatePickerField from "@/components/ui/DatePicker";
import { toast } from "@/lib/swal";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * REFERENCE IMPLEMENTATION — StudentAdmissionForm
 * ─────────────────────────────────────────────────────────────────────────
 * Demonstrates the two `GlobalImageUploader` delivery modes side-by-side and
 * how both feed ONE multipart submission to the NestJS API:
 *
 *  · `PASSPORT` (file mode)  — opens the interactive crop modal, delivers the
 *    sliced 3:4 WebP File; the form owns it inside its FormData (`photo`).
 *  · `DOCUMENT` (file mode)  — NO crop viewport; the full birth-certificate
 *    frame is downscaled inside 1800×1800 with the original ratio preserved
 *    and handed to the form (`birthCertificateDocument`).
 *  · URL mode (`uploadEndpoint` + `value`/`onChange`) is exercised on the
 *    Teachers admin page if you need the "stored URL string" flavor instead.
 *
 * The FormData POST goes through the same-origin proxy under
 * `apps/web/src/app/api/**` so the session JWT is attached server-side
 * before hitting NestJS. Create `/api/admissions/apply/route.ts` by copying
 * `/api/uploads/avatar/route.ts` and pointing `fetch(...)` at
 * `${API_BASE}/admissions/apply` — the browser writes the multipart
 * boundary, the proxy never reshapes the body.
 * ─────────────────────────────────────────────────────────────────────────
 */

export default function StudentAdmissionForm() {
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [birthCertificate, setBirthCertificate] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const photoMissing = /* admission policy: portrait is mandatory */ photo === null;

  const resetForm = () => {
    setFullName("");
    setDateOfBirth("");
    // Push the reset down into both uploaders (clears previews + staged state)
    setPhoto(null);
    setBirthCertificate(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (photoMissing || submitting) return;

    setSubmitting(true);
    try {
      /* ── Assemble ONE multipart body for the NestJS pipeline.
       *    Every image here is already processed client-side: cropped /
       *    downscaled WebP, metadata-stripped canvas output. The NestJS
       *    ImageOptimizationPipe re-verifies the binaries (magic bytes,
       *    ±15% aspect gate, EXIF strip) before storage, so swapping the
       *    browser cannot bypass the presets. ─────────────────────────── */
      const formData = new FormData();
      formData.append("fullName", fullName.trim());
      formData.append("dateOfBirth", dateOfBirth);
      formData.append("photo", photo as File, (photo as File).name);
      if (birthCertificate) {
        formData.append(
          "birthCertificateDocument",
          birthCertificate,
          birthCertificate.name,
        );
      }

      const res = await fetch("/api/admissions/apply", {
        method: "POST",
        credentials: "same-origin", // proxy attaches `Authorization: Bearer <session>`
        body: formData, // fetch sets the multipart boundary — never set content-type manually
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) throw new Error(data?.message ?? "Admission submission failed.");

      toast({ title: "Success", text: "Admission application submitted.", icon: "success" });
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admission submission failed.";
      toast({ title: "Error", text: message, icon: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Identity fields ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="admission-fullname" className="mb-1 block text-xs font-medium text-ink-700">
            Full name
          </label>
          <input
            id="admission-fullname"
            required
            maxLength={150}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="e.g. Ayesha Karim"
            className="w-full cursor-pointer rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400"
          />
        </div>
        <DatePickerField
          label="Date of birth"
          required
          value={dateOfBirth}
          onChange={setDateOfBirth}
        />
      </div>

      {/* ── Images: cropped portrait + uncropped document side-by-side ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* PASSPORT — interactive cropper, strict 3:4, 450×600 WebP out */}
        <div>
          <GlobalImageUploader
            preset={ImagePreset.PASSPORT}
            onFileReady={setPhoto}
            label="Student photo"
            alt="Student portrait preview"
            disabled={submitting}
          />
          {photoMissing && (
            <p className="mt-1.5 text-xs font-medium text-rose-700" role="alert">
              Student photo is required.
            </p>
          )}
          {photo && !photoMissing && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {photo.name} ({(photo.size / 1024).toFixed(0)} KB) ready to submit
            </p>
          )}
        </div>

        {/* DOCUMENT — no crop; original 6:19 / 19:6 / any ratio preserved */}
        <div>
          <GlobalImageUploader
            preset={ImagePreset.DOCUMENT}
            onFileReady={setBirthCertificate}
            label="Birth certificate"
            alt="Birth certificate preview"
            disabled={submitting}
          />
          {birthCertificate && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {birthCertificate.name} ({(birthCertificate.size / 1024).toFixed(0)} KB) ready to submit
            </p>
          )}
        </div>
      </div>

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || photoMissing || fullName.trim().length === 0 || dateOfBirth === ""}
          className="flex cursor-pointer items-center gap-2 rounded-xs border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          {submitting ? "Submitting..." : "Submit application"}
        </button>
      </div>
    </form>
  );
}
