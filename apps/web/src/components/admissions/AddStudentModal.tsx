"use client";

import { useState, type ReactNode } from "react";
import { FiLoader, FiUserPlus } from "react-icons/fi";
import SearchSelect from "@/components/ui/SearchSelect";
import DatePickerField, { todayISO } from "@/components/ui/DatePicker";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { ConfirmResult, StudentFilterOptions } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const MODAL_BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const MODAL_BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const GENDERS = ["MALE", "FEMALE", "OTHER"].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() }));
const RELIGIONS = ["ISLAM", "HINDUISM", "CHRISTIANITY", "BUDDHISM"].map((v) => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));
const BLOODS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((v) => ({ value: v, label: v }));
const INSTITUTIONS = ["KINDERGARTEN", "SCHOOL", "COLLEGE", "MADRASAH", "UNIVERSITY"].map((v) => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));
const GROUPS = ["GENERAL", "SCIENCE", "ARTS", "COMMERCE", "MUZABBID", "HIFZ"].map((v) => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));
const ENROLL_TYPES = [
  { value: "NEW_ADMISSION", label: "New admission" },
  { value: "READMISSION", label: "Readmission" },
  { value: "PROMOTED", label: "Promoted" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  options: StudentFilterOptions;
}

const clean = (v: string) => (v.trim() === "" ? undefined : v.trim());

/**
 * Phase 5 — Add Student (directory quick add). Runs the same atomic
 * onboarding orchestrator as the wizard (family → student → enrollment →
 * invoice + GL) but with only the essentials; subjects are optional and can
 * be completed later from the Subject picker once the syllabus matrix exists.
 */
export default function AddStudentModal({ open, onClose, onCreated, options }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ConfirmResult | null>(null);

  // family
  const [phone, setPhone] = useState("");
  const [father, setFather] = useState("");
  const [mother, setMother] = useState("");
  const [address, setAddress] = useState("");
  // student
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [religion, setReligion] = useState("");
  const [blood, setBlood] = useState("");
  const [brn, setBrn] = useState("");
  const [admissionDate, setAdmissionDate] = useState(todayISO());
  // placement
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [group, setGroup] = useState("GENERAL");
  const [institution, setInstitution] = useState("SCHOOL");
  const [enrollType, setEnrollType] = useState("NEW_ADMISSION");

  if (!open) return null;

  function reset() {
    setPhone(""); setFather(""); setMother(""); setAddress("");
    setNameEn(""); setNameBn(""); setGender(""); setDob(""); setReligion(""); setBlood(""); setBrn("");
    setAdmissionDate(todayISO());
    setSessionId(""); setClassId(""); setSectionId(""); setGroup("GENERAL");
    setInstitution("SCHOOL"); setEnrollType("NEW_ADMISSION");
    setDone(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (!phone.trim() || !father.trim() || !mother.trim() || !address.trim()) {
      toast("Family: guardian phone, father, mother and address are required", "error");
      return;
    }
    if (!nameEn.trim() || !gender || !dob || !religion) {
      toast("Student: name, gender, date of birth and religion are required", "error");
      return;
    }
    if (!sessionId.trim() || !classId.trim()) {
      toast("Placement: academic session and class/department are required", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<ConfirmResult>("/api/admissions/onboarding/confirm", {
        method: "POST",
        body: JSON.stringify({
          family: {
            primaryGuardianPhone: phone.trim(),
            fatherNameEn: father.trim(),
            motherNameEn: mother.trim(),
            presentAddress: address.trim(),
          },
          student: {
            fullNameEn: nameEn.trim(),
            fullNameBn: clean(nameBn),
            gender,
            dateOfBirth: dob,
            religion,
            bloodGroup: clean(blood),
            birthRegNo: clean(brn),
            admissionDate,
          },
          placement: {
            academicSessionId: sessionId.trim(),
            classOrDeptId: classId.trim(),
            institutionType: institution,
            sectionOrBatchId: clean(sectionId),
            academicGroup: group,
            enrollmentType: enrollType,
          },
          applyWaiverRuleCodes: [],
        }),
      });
      setDone(res);
      toast(`Student ${res.studentUniqueId} admitted (roll ${res.classRollNo})`, "success");
      onCreated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Admission failed — nothing was saved", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" onClick={close}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xs bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-ink-900">Add student</h3>
        <p className="mt-1 text-xs text-ink-500">
          Creates family → student → enrollment → admission invoice in one atomic transaction
          (same engine as the Direct Admission Wizard).
        </p>

        {done ? (
          <div className="mt-4 space-y-3 text-xs">
            <p className="rounded-xs border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800">
              Admitted {done.studentUniqueId} · roll {done.classRollNo} · invoice {done.invoiceNo} · net {done.netAmount} BDT
              {done.moneyReceiptNo ? ` · receipt ${done.moneyReceiptNo}` : ""}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className={MODAL_BTN_GHOST} onClick={reset}>Add another</button>
              <button type="button" className={MODAL_BTN} onClick={close}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Family</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Guardian phone *">
                  <input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                </Field>
                <Field label="Father name (EN) *">
                  <input className={INPUT} value={father} onChange={(e) => setFather(e.target.value)} />
                </Field>
                <Field label="Mother name (EN) *">
                  <input className={INPUT} value={mother} onChange={(e) => setMother(e.target.value)} />
                </Field>
                <Field label="Present address *">
                  <input className={INPUT} value={address} onChange={(e) => setAddress(e.target.value)} />
                </Field>
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Student</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Full name (EN) *">
                  <input className={INPUT} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                </Field>
                <Field label="Full name (BN)">
                  <input className={INPUT} value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder="বাংলা নাম" />
                </Field>
                <Field label="Gender *">
                  <SearchSelect options={GENDERS} value={gender} onChange={setGender} placeholder="Select…" ariaLabel="Gender" />
                </Field>
                <Field label="Date of birth *">
                  <DatePickerField value={dob} onChange={setDob} maxDate={todayISO()} placeholder="Select DOB" />
                </Field>
                <Field label="Religion *">
                  <SearchSelect options={RELIGIONS} value={religion} onChange={setReligion} placeholder="Select…" ariaLabel="Religion" />
                </Field>
                <Field label="Blood group">
                  <SearchSelect options={BLOODS} value={blood} onChange={setBlood} placeholder="Select…" isClearable ariaLabel="Blood group" />
                </Field>
                <Field label="17-digit BRN">
                  <input className={`${INPUT} font-mono`} value={brn} onChange={(e) => setBrn(e.target.value)} placeholder="17 digits…" />
                </Field>
                <Field label="Admission date *">
                  <DatePickerField value={admissionDate} onChange={setAdmissionDate} />
                </Field>
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Placement</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Academic session *">
                  {options.sessions.length > 0 ? (
                    <SearchSelect options={options.sessions} value={sessionId} onChange={setSessionId} placeholder="Select session…" isClearable ariaLabel="Session" />
                  ) : (
                    <input className={`${INPUT} font-mono`} value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="Session UUID…" />
                  )}
                </Field>
                <Field label="Class / Dept *">
                  {options.classes.length > 0 ? (
                    <SearchSelect options={options.classes} value={classId} onChange={setClassId} placeholder="Select class…" isClearable ariaLabel="Class" />
                  ) : (
                    <input className={`${INPUT} font-mono`} value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Class UUID…" />
                  )}
                </Field>
                <Field label="Section">
                  {options.sections.length > 0 ? (
                    <SearchSelect options={options.sections} value={sectionId} onChange={setSectionId} placeholder="Select section…" isClearable ariaLabel="Section" />
                  ) : (
                    <input className={`${INPUT} font-mono`} value={sectionId} onChange={(e) => setSectionId(e.target.value)} placeholder="Section UUID (optional)…" />
                  )}
                </Field>
                <Field label="Academic group">
                  <SearchSelect options={GROUPS} value={group} onChange={setGroup} placeholder="Select…" ariaLabel="Group" />
                </Field>
                <Field label="Institution">
                  <SearchSelect options={INSTITUTIONS} value={institution} onChange={setInstitution} ariaLabel="Institution" />
                </Field>
                <Field label="Enrollment type">
                  <SearchSelect options={ENROLL_TYPES} value={enrollType} onChange={setEnrollType} ariaLabel="Enrollment type" />
                </Field>
              </div>
            </fieldset>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={MODAL_BTN_GHOST} disabled={busy} onClick={close}>Cancel</button>
              <button type="button" className={MODAL_BTN} disabled={busy} onClick={submit}>
                {busy ? (
                  <span className="inline-flex items-center gap-1.5"><FiLoader className="h-3.5 w-3.5 animate-spin" /> Admitting…</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><FiUserPlus className="h-3.5 w-3.5" /> Admit student</span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium text-ink-700">{label}</label>
      {children}
    </div>
  );
}
