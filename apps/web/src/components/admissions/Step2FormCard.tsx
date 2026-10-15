"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashPage";
import SearchSelect from "@/components/ui/SearchSelect";
import DatePickerField, { todayISO } from "@/components/ui/DatePicker";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import { resolveImageUrl } from "@/lib/media";
import type { IdentityState, PrevEduRow } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const ERR = "mt-0.5 text-[11px] text-rose-600";
const CELL = `${INPUT} !px-1.5 !text-xs`;

const GENDERS = ["MALE", "FEMALE", "OTHER"].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() }));
const RELIGIONS = ["ISLAM", "HINDUISM", "CHRISTIANITY", "BUDDHISM"].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() }));
const INSTITUTIONS = ["KINDERGARTEN", "SCHOOL", "COLLEGE", "MADRASAH", "UNIVERSITY"].map((v) => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));
const BLOODS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((v) => ({ value: v, label: v }));
const EXAMS = ["PSC", "JSC", "SSC", "DAKHIL", "HSC", "ALIM", "PREV_SCHOOL_TC"].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

const identitySchema = z.object({
  fullNameEn: z.string().trim().min(3, "Name needs 3+ characters"),
  fullNameBn: z.string(),
  gender: z.string().min(1, "Required"),
  dateOfBirth: z.string().min(1, "Required"),
  birthRegNo: z.string().trim().refine((v) => v === "" || /^\d{17}$/.test(v.replace(/\D/g, "")), "17-digit BRN"),
  nationalIdNo: z.string().trim().refine((v) => { const d = v.replace(/\D/g, ""); return v === "" || d.length === 10 || d.length === 13 || d.length === 17; }, "10/13/17-digit NID"),
  religion: z.string().min(1, "Required"),
  bloodGroup: z.string(),
  photoUrl: z.string(),
  medicalAllergyNotes: z.string(),
  pickupGuardianName: z.string(),
  pickupGuardianPhone: z.string(),
  admissionDate: z.string().min(1, "Required"),
});

type IdentityForm = z.infer<typeof identitySchema>;

const prevEduSchema = z.object({
  rows: z.array(
    z.object({
      examTitle: z.string().min(1, "Required"),
      instituteName: z.string().trim().min(2, "Required"),
      educationBoard: z.string(),
      academicGroup: z.string(),
      rollNo: z.string(),
      regNo: z.string(),
      passingYear: z.string(),
      gpaObtained: z.string(),
      tcNumber: z.string(),
    }),
  ),
});

interface Props {
  institution: string;
  onInstitutionChange: (v: string) => void;
  value: IdentityState;
  prevEdus: PrevEduRow[];
  onChange: (identity: IdentityState, prevEdus: PrevEduRow[]) => void;
  familyCode?: string;
  familyZakat?: boolean | null;
}

const rowKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Phase 4 — Step 2: Student Identity & Previous Education (Plan §4).
 * react-hook-form + zod, adaptive per institution mode: KG hides the
 * prev-exam table and shows pick-up guardian + allergy; College/University
 * emphasize GPA; Madrasah shows the Lillah verification panel.
 */
export default function Step2FormCard({ institution, onInstitutionChange, value, prevEdus, onChange, familyCode, familyZakat }: Props) {
  const today = todayISO();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [uploading, setUploading] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const form = useForm<IdentityForm>({
    resolver: zodResolver(identitySchema),
    defaultValues: { ...value, admissionDate: value.admissionDate || today },
    mode: "onBlur",
  });
  const eduForm = useForm<{ rows: Omit<PrevEduRow, "key">[] }>({
    resolver: zodResolver(prevEduSchema),
    defaultValues: {
      rows: prevEdus.map(({ key: _k, ...r }) => r),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: eduForm.control, name: "rows" });

  // Lift every edit into wizard state (parent owns the source of truth).
  useEffect(() => {
    const sub = form.watch((v) => {
      const parsed = identitySchema.safeParse({ ...value, ...v });
      if (parsed.success) {
        const rows = eduForm.getValues().rows ?? [];
        onChangeRef.current(parsed.data as IdentityState, rows.map((r) => ({ key: rowKey(), ...r })));
      }
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isKg = institution === "KINDERGARTEN";
  const isCollege = institution === "COLLEGE" || institution === "UNIVERSITY";
  const isMadrasah = institution === "MADRASAH";

  async function uploadFile(file: File | Blob, name: string) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file, name);
      const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { url?: string; message?: string } | null;
      if (!res.ok || !data?.url) throw new Error(data?.message ?? `Upload failed (${res.status})`);
      form.setValue("photoUrl", data.url, { shouldDirty: true });
      onChangeRef.current({ ...(form.getValues() as IdentityState), photoUrl: data.url }, eduForm.getValues().rows.map((r) => ({ key: rowKey(), ...r })));
      toast("Photo uploaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function startCam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setCamOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      toast("Camera unavailable — use file upload instead", "error");
    }
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }

  async function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) {
      toast("Snapshot failed", "error");
      return;
    }
    stopCam();
    await uploadFile(blob, `webcam-${Date.now()}.jpg`);
  }

  useEffect(() => () => stopCam(), []);

  const photoUrl = form.watch("photoUrl");

  return (
    <DashCard title="Step 2 — Student Identity & Previous Education">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Institution mode</label>
          <SearchSelect options={INSTITUTIONS} value={institution} onChange={onInstitutionChange} placeholder="Select…" ariaLabel="Institution type" />
        </div>
        <div className="min-w-0 2xl:col-span-2">
          <label className="mb-1 block text-xs font-medium text-ink-700">Full name (EN) *</label>
          <input className={INPUT} placeholder="e.g. Arif Hossain" {...form.register("fullNameEn")} />
          {form.formState.errors.fullNameEn && <p className={ERR}>{form.formState.errors.fullNameEn.message}</p>}
        </div>
        <div className="min-w-0 2xl:col-span-2">
          <label className="mb-1 block text-xs font-medium text-ink-700">Full name (BN)</label>
          <input className={INPUT} placeholder="e.g. আরিফ হোসেন" {...form.register("fullNameBn")} />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Gender *</label>
          <SearchSelect options={GENDERS} value={form.watch("gender")} onChange={(v) => form.setValue("gender", v)} placeholder="Select…" ariaLabel="Gender" />
          {form.formState.errors.gender && <p className={ERR}>Required</p>}
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Date of birth *</label>
          <DatePickerField value={form.watch("dateOfBirth")} onChange={(v) => form.setValue("dateOfBirth", v)} maxDate={today} placeholder="Select DOB" />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Religion *</label>
          <SearchSelect options={RELIGIONS} value={form.watch("religion")} onChange={(v) => form.setValue("religion", v)} placeholder="Select…" ariaLabel="Religion" />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">17-digit BRN</label>
          <input className={`${INPUT} font-mono`} placeholder="17 digits…" {...form.register("birthRegNo")} />
          {form.formState.errors.birthRegNo && <p className={ERR}>{form.formState.errors.birthRegNo.message}</p>}
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">NID (college/uni)</label>
          <input className={`${INPUT} font-mono`} placeholder="10/13/17 digits…" {...form.register("nationalIdNo")} />
          {form.formState.errors.nationalIdNo && <p className={ERR}>{form.formState.errors.nationalIdNo.message}</p>}
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Blood group</label>
          <SearchSelect options={BLOODS} value={form.watch("bloodGroup") ?? ""} onChange={(v) => form.setValue("bloodGroup", v)} placeholder="Select…" isClearable ariaLabel="Blood group" />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Admission date *</label>
          <DatePickerField value={form.watch("admissionDate")} onChange={(v) => form.setValue("admissionDate", v)} />
        </div>
      </div>

      {isKg && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end rounded-xs border border-sky-200 bg-sky-50/50 p-2.5">
          <div className="min-w-0 2xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-700">Pick-up guardian</label>
            <input className={INPUT} placeholder="Who collects the child…" {...form.register("pickupGuardianName")} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Pick-up phone</label>
            <input className={INPUT} placeholder="01XXXXXXXXX" {...form.register("pickupGuardianPhone")} />
          </div>
          <div className="min-w-0 sm:col-span-2 2xl:col-span-3">
            <label className="mb-1 block text-xs font-medium text-ink-700">Medical / allergy notes (KG + hostel)</label>
            <input className={INPUT} placeholder="e.g. peanut allergy, asthma inhaler…" {...form.register("medicalAllergyNotes")} />
          </div>
        </div>
      )}

      {isMadrasah && (
        <p className={`mt-3 rounded-xs border px-2.5 py-1.5 text-xs font-semibold ${familyZakat ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {familyCode ? `Family ${familyCode} — ` : ""}Lillah/Zakat boarding:{" "}
          {familyZakat ? "verified ✓ (Fund 02 unlocked in Step 4)" : "NOT verified — verify in Families Directory before Step 4 Lillah selection"}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-start gap-3 rounded-xs border border-ink-200 p-2.5">
        <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xs border border-ink-200 bg-ink-50">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveImageUrl(photoUrl)} alt="Student photo" className="h-full w-full object-cover" />
          ) : (
            <p className="flex h-full items-center justify-center px-1 text-center text-[10px] text-ink-400">No photo</p>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50">
            <Upload className="h-3.5 w-3.5" /> Upload photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f, f.name);
                e.target.value = "";
              }}
            />
          </label>
          {!camOn ? (
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50" onClick={startCam}>
              <Camera className="h-3.5 w-3.5" /> Webcam
            </button>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="h-24 w-32 rounded-xs border border-ink-200 bg-black" />
              <button type="button" className="rounded-xs border border-brand-600 bg-brand-600 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-500" onClick={snap}>
                Capture
              </button>
              <button type="button" className="rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50" onClick={stopCam}>
                Close
              </button>
            </>
          )}
          {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      </div>

      {!isKg ? (
        <div className="mt-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-ink-700">
              Previous education {isCollege && <span className="font-normal text-ink-500">(SSC/Dakhil/HSC drives merit waivers)</span>}
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              onClick={() => append({ examTitle: "", instituteName: "", educationBoard: "", academicGroup: "", rollNo: "", regNo: "", passingYear: "", gpaObtained: "", tcNumber: "" })}
            >
              <Plus className="h-3 w-3" /> Add row
            </button>
          </div>
          {fields.length === 0 ? (
            <p className="rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-500">
              No previous-exam rows — add SSC/Dakhil/HSC history (roll, reg, board, GPA, TC no).
            </p>
          ) : (
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-2 gap-1.5 rounded-xs border border-ink-200 p-2 sm:grid-cols-4 2xl:grid-cols-9">
                  <select className={CELL} {...eduForm.register(`rows.${i}.examTitle` as const)}>
                    <option value="">Exam…</option>
                    {EXAMS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                  <input className={`${CELL} col-span-2`} placeholder="Institute…" {...eduForm.register(`rows.${i}.instituteName` as const)} />
                  <input className={CELL} placeholder="Board…" {...eduForm.register(`rows.${i}.educationBoard` as const)} />
                  <input className={CELL} placeholder="Group…" {...eduForm.register(`rows.${i}.academicGroup` as const)} />
                  <input className={CELL} placeholder="Roll…" {...eduForm.register(`rows.${i}.rollNo` as const)} />
                  <input className={CELL} placeholder="Reg…" {...eduForm.register(`rows.${i}.regNo` as const)} />
                  <input className={CELL} placeholder="Year…" inputMode="numeric" {...eduForm.register(`rows.${i}.passingYear` as const)} />
                  <input className={`${CELL} font-mono`} placeholder="GPA…" inputMode="decimal" {...eduForm.register(`rows.${i}.gpaObtained` as const)} />
                  <div className="col-span-2 flex gap-1.5 sm:col-span-4 2xl:col-span-9">
                    <input className={`${CELL} flex-1`} placeholder="TC number (transfer-in)…" {...eduForm.register(`rows.${i}.tcNumber` as const)} />
                    <button type="button" className="rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" onClick={() => remove(i)} title="Remove row">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-500">
          Kindergarten mode — previous-exam table hidden; pick-up guardian + allergy captured above.
        </p>
      )}
    </DashCard>
  );
}

export type { IdentityForm };
