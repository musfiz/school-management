"use client";

import { useCallback, useEffect, useState } from "react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import DatePickerField from "@/components/ui/DatePicker";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import { listAcademicSessions, listClassOrDepts } from "@/lib/academic-results";
import {
  listPreviousEducations,
  createPreviousEducation,
  updatePreviousEducation,
  deletePreviousEducation,
  type PreviousEducationRow,
  type CreatePreviousEducationDto,
  type UpdatePreviousEducationDto,
} from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const MODAL_BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const MODAL_BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const EXAM_TITLES = [
  { value: "PSC", label: "PSC" },
  { value: "JSC", label: "JSC" },
  { value: "JDC", label: "JDC" },
  { value: "SSC", label: "SSC" },
  { value: "Dakhil", label: "Dakhil" },
  { value: "HSC", label: "HSC" },
  { value: "Alim", label: "Alim" },
];

const GROUPS = [
  { value: "GENERAL", label: "General" },
  { value: "SCIENCE", label: "Science" },
  { value: "HUMANITIES", label: "Humanities" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "MUZABBID", label: "Muzabbid" },
  { value: "HIFZ", label: "Hifz" },
];

const GPA_SCALES = ["5.00", "4.00"].map((v) => ({ value: v, label: v }));

interface FormData {
  id?: string;
  studentId: string;
  examTitle: string;
  instituteName: string;
  educationBoard: string;
  academicGroup: string;
  rollNo: string;
  regNo: string;
  passingYear: number | undefined;
  gpaObtained: string;
  tcNumber: string;
  tcDate: string;
}

const EMPTY_FORM: FormData = {
  studentId: "",
  examTitle: "",
  instituteName: "",
  educationBoard: "",
  academicGroup: "",
  rollNo: "",
  regNo: "",
  passingYear: undefined,
  gpaObtained: "",
  tcNumber: "",
  tcDate: "",
};

interface StudentOption {
  value: string;
  label: string;
}

interface ScopeOption {
  value: string;
  label: string;
  count: number;
}

export default function PreviousEducationView() {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<{ sessions: ScopeOption[]; classes: ScopeOption[] }>({
    sessions: [],
    classes: [],
  });

  // filters
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);

  // rows
  const [rows, setRows] = useState<PreviousEducationRow[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // add/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PreviousEducationRow | null>(null);
  const [form, setForm] = useState<FormData>(() => ({ ...EMPTY_FORM }));

  const loadScope = useCallback(async () => {
    try {
      const [sessions, classes] = await Promise.all([
        listAcademicSessions(false),
        listClassOrDepts(),
      ]);
      setOptions({
        sessions: sessions.map((s) => ({ value: s.id, label: s.sessionName, count: 0 })),
        classes: classes.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}`, count: 0 })),
      });
    } catch {
      /* scope dropdowns degrade to empty; admin types UUIDs manually if needed */
    }
  }, []);

  const loadStudents = useCallback(async () => {
    if (!sessionId || !classId) {
      setStudents([]);
      return;
    }
    try {
      const fetched = await apiFetch<Array<{ id: string; studentUniqueId: string; fullNameEn: string }>>(
        `/api/admissions/students?academicSessionId=${encodeURIComponent(sessionId)}&classOrDeptId=${encodeURIComponent(classId)}&limit=500`,
      );
      setStudents(
        fetched
          .sort((a, b) => a.fullNameEn.localeCompare(b.fullNameEn))
          .map((s) => ({ value: s.id, label: `${s.fullNameEn} (${s.studentUniqueId})` })),
      );
    } catch {
      setStudents([]);
    }
  }, [sessionId, classId]);

  const loadRows = useCallback(async () => {
    if (!studentId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await listPreviousEducations(studentId));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load previous education", "error");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadScope();
  }, [loadScope]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function studentLabel(id: string): string {
    return students.find((s) => s.value === id)?.label ?? id;
  }

  function openAdd() {
    setEditing(null);
    setForm({
      studentId,
      examTitle: "",
      instituteName: "",
      educationBoard: "",
      academicGroup: "",
      rollNo: "",
      regNo: "",
      passingYear: undefined,
      gpaObtained: "",
      tcNumber: "",
      tcDate: "",
    });
    setModalOpen(true);
  }

  function openEdit(row: PreviousEducationRow) {
    setEditing(row);
    setForm({
      id: row.id,
      studentId: row.studentId,
      examTitle: row.examTitle,
      instituteName: row.instituteName,
      educationBoard: row.educationBoard ?? "",
      academicGroup: row.academicGroup ?? "",
      rollNo: row.rollNo ?? "",
      regNo: row.regNo ?? "",
      passingYear: row.passingYear ?? undefined,
      gpaObtained: row.gpaObtained ?? "",
      tcNumber: row.tcNumber ?? "",
      tcDate: row.tcDate ?? "",
    });
    setModalOpen(true);
  }

  async function submit() {
    if (!form.examTitle.trim() || !form.instituteName.trim()) {
      toast("Exam title and institute are required", "warning");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const dto: UpdatePreviousEducationDto = {
          examTitle: form.examTitle.trim() || undefined,
          instituteName: form.instituteName.trim() || undefined,
          educationBoard: form.educationBoard.trim() || null,
          academicGroup: form.academicGroup.trim() || null,
          rollNo: form.rollNo.trim() || null,
          regNo: form.regNo.trim() || null,
          passingYear: form.passingYear,
          gpaObtained: form.gpaObtained.trim() || null,
          tcNumber: form.tcNumber.trim() || null,
          tcDate: form.tcDate.trim() || undefined,
        };
        const updated = await updatePreviousEducation(editing.id, dto);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        toast("Previous education updated", "success");
      } else {
        const dto: CreatePreviousEducationDto = {
          studentId: form.studentId,
          examTitle: form.examTitle.trim(),
          instituteName: form.instituteName.trim(),
          educationBoard: form.educationBoard.trim() || null,
          academicGroup: form.academicGroup.trim() || null,
          rollNo: form.rollNo.trim() || null,
          regNo: form.regNo.trim() || null,
          passingYear: form.passingYear,
          gpaObtained: form.gpaObtained.trim() || null,
          tcNumber: form.tcNumber.trim() || null,
          tcDate: form.tcDate.trim() || undefined,
        };
        const created = await createPreviousEducation(dto);
        setRows((prev) => [created, ...prev]);
        toast("Previous education added", "success");
      }
      setModalOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: PreviousEducationRow) {
    const confirmed = await window.confirm(
      `Delete previous education “${row.examTitle}” for ${studentLabel(row.studentId)}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setRowBusy(row.id);
    try {
      await deletePreviousEducation(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast("Previous education deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Previous Education"
        description="Plan §3.3 — SSC/Dakhil/HSC history, board GPA, TC trail for transfer-in students"
      />

      {/* Filter card */}
      <DashCard title="Filter previous education">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Session</label>
            <SearchSelect
              options={options.sessions}
              value={sessionId}
              onChange={setSessionId}
              placeholder="All sessions…"
              isClearable
              ariaLabel="Session filter"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Class / Dept</label>
            <SearchSelect
              options={options.classes}
              value={classId}
              onChange={setClassId}
              placeholder="All classes…"
              isClearable
              ariaLabel="Class filter"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Student</label>
            <SearchSelect
              options={students}
              value={studentId}
              onChange={setStudentId}
              placeholder="Select student…"
              isClearable
              ariaLabel="Student filter"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-2">
            <button type="button" className={BTN} disabled={loading} onClick={loadRows}>
              {loading ? (
                <span className="inline-flex items-center gap-1.5">Loading…</span>
              ) : (
                <span className="inline-flex items-center gap-1.5">Run</span>
              )}
            </button>
            <button type="button" className={BTN_GHOST} onClick={openAdd} disabled={!studentId}>
              <span className="inline-flex items-center gap-1">+ Add row</span>
            </button>
          </div>
        </div>
      </DashCard>

      {/* Table */}
      <DashCard title={`Previous education — ${studentLabel(studentId) || "no student selected"}`}>
        {loading && rows.length === 0 ? (
          <AdminPageLoader variant="inline" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">
            No previous-education rows yet. Select a student and click <span className="font-semibold">+ Add row</span>.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Exam</th>
                  <th className="px-2.5 py-1.5 font-semibold">Institute</th>
                  <th className="px-2.5 py-1.5 font-semibold">Board / Group</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Roll / Reg</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Year</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">GPA</th>
                  <th className="px-2.5 py-1.5 font-semibold">TC</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1 font-medium">{r.examTitle}</td>
                    <td className="px-2.5 py-1">{r.instituteName}</td>
                    <td className="px-2.5 py-1 text-ink-600">
                      {r.educationBoard ?? "—"} · {r.academicGroup ?? "—"}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono text-ink-600">
                      {r.rollNo ?? "—"} / {r.regNo ?? "—"}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono">{r.passingYear ?? "—"}</td>
                    <td className="px-2.5 py-1 text-right font-mono font-semibold">
                      {r.gpaObtained ?? "—"}
                    </td>
                    <td className="px-2.5 py-1 text-ink-600">
                      {r.tcNumber ?? "—"} {r.tcDate ? `· ${r.tcDate.slice(0, 10)}` : ""}
                    </td>
                    <td className="px-2.5 py-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={BTN_GHOST}
                          disabled={rowBusy !== null}
                          onClick={() => openEdit(r)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={BTN_GHOST}
                          disabled={rowBusy !== null}
                          onClick={() => removeRow(r)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xs bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-ink-900">
                {editing ? "Edit previous education" : "Add previous education"}
              </h3>
              <button
                type="button"
                className="rounded-xs border border-ink-200 bg-white p-1 text-ink-500 transition-colors hover:bg-ink-50"
                onClick={() => !saving && setModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {editing ? "Update the student's previous-exam record." : "Record a transfer-in student's previous exam history."}
            </p>

            <div className="mt-4 space-y-3">
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Exam title</label>
                <SearchSelect
                  options={EXAM_TITLES}
                  value={form.examTitle}
                  onChange={(v) => setForm({ ...form, examTitle: v })}
                  placeholder="e.g. SSC"
                  isClearable
                  ariaLabel="Exam title"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Institute name</label>
                <input
                  className={INPUT}
                  value={form.instituteName}
                  onChange={(e) => setForm({ ...form, instituteName: e.target.value })}
                  placeholder="e.g. XYZ High School"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Education board</label>
                <input
                  className={INPUT}
                  value={form.educationBoard}
                  onChange={(e) => setForm({ ...form, educationBoard: e.target.value })}
                  placeholder="e.g. Dhaka Board"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Academic group</label>
                <SearchSelect
                  options={GROUPS}
                  value={form.academicGroup}
                  onChange={(v) => setForm({ ...form, academicGroup: v })}
                  placeholder="e.g. Science"
                  isClearable
                  ariaLabel="Academic group"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Roll no</label>
                <input
                  className={INPUT}
                  value={form.rollNo}
                  onChange={(e) => setForm({ ...form, rollNo: e.target.value })}
                  placeholder="e.g. 123456"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Reg no</label>
                <input
                  className={INPUT}
                  value={form.regNo}
                  onChange={(e) => setForm({ ...form, regNo: e.target.value })}
                  placeholder="e.g. REG-123456"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">Passing year</label>
                <input
                  type="number"
                  className={INPUT}
                  value={form.passingYear ?? ""}
                  onChange={(e) => setForm({ ...form, passingYear: Number(e.target.value) || undefined })}
                  min={1900}
                  max={2100}
                  placeholder="2026"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">GPA obtained</label>
                <input
                  className={INPUT}
                  value={form.gpaObtained}
                  onChange={(e) => setForm({ ...form, gpaObtained: e.target.value })}
                  placeholder="5.00"
                />
                <span className="ml-1 text-xs text-ink-500">Stored on a 5.00 scale.</span>
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-ink-700">TC number</label>
                <input
                  className={INPUT}
                  value={form.tcNumber}
                  onChange={(e) => setForm({ ...form, tcNumber: e.target.value })}
                  placeholder="TC-123456"
                />
              </div>
              <div className="min-w-0">
                <DatePickerField
                  label="TC date"
                  value={form.tcDate}
                  onChange={(v) => setForm({ ...form, tcDate: v })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={MODAL_BTN_GHOST}
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={MODAL_BTN}
                disabled={saving || !form.examTitle.trim() || !form.instituteName.trim()}
                onClick={submit}
              >
                {saving ? (
                  <span className="inline-flex items-center gap-1.5">Saving…</span>
                ) : editing ? (
                  "Update"
                ) : (
                  "Add row"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
