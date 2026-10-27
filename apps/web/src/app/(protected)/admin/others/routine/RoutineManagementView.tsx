"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiSave,
  FiX,
  FiLoader,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiDownload,
  FiExternalLink,
} from "react-icons/fi";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/dashboard/DataTable";
import { DashCard } from "@/components/dashboard/DashPage";
import SearchSelect from "@/components/ui/SearchSelect";
import PdfUploader from "@/components/dashboard/PdfUploader";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { confirmDialog, toast } from "@/lib/swal";
import { resolveImageUrl } from "@/lib/media";

export interface RoutineRecord {
  id: string;
  title: string;
  titleBn?: string | null;
  academicSessionId: string;
  classOrDeptId: string;
  academicGroupId?: string | null;
  type: string;
  pdfUrl: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
  academicSession?: {
    id: string;
    sessionName: string;
    sessionCode: string;
    isCurrent?: boolean;
  } | null;
  classOrDept?: {
    id: string;
    name: string;
    code: string;
    level?: string;
  } | null;
  academicGroup?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface LookupItem {
  id: string;
  name?: string;
  sessionName?: string;
  sessionCode?: string;
  code?: string;
  isCurrent?: boolean;
}

interface FormState {
  id: string | null;
  title: string;
  titleBn: string;
  academicSessionId: string;
  classOrDeptId: string;
  academicGroupId: string;
  type: string;
  pdfUrl: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  titleBn: "",
  academicSessionId: "",
  classOrDeptId: "",
  academicGroupId: "",
  type: "CLASS",
  pdfUrl: "",
  description: "",
  sortOrder: 1,
  isActive: true,
};

const INPUT_BASE =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

export default function RoutineManagementView() {
  const [routines, setRoutines] = useState<RoutineRecord[]>([]);
  const [sessions, setSessions] = useState<LookupItem[]>([]);
  const [classes, setClasses] = useState<LookupItem[]>([]);
  const [groups, setGroups] = useState<LookupItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter Bar States
  const [filterClass, setFilterClass] = useState<string>("");
  const [filterSession, setFilterSession] = useState<string>("");
  const [filterGroup, setFilterGroup] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  async function loadData() {
    setLoading(true);
    try {
      const [resRoutines, resSessions, resClasses, resGroups] = await Promise.all([
        fetch("/api/routines?all=true"),
        fetch("/api/academic-results/academic-setup/sessions"),
        fetch("/api/academic-results/academic-setup/classes"),
        fetch("/api/academic-results/academic-setup/groups"),
      ]);

      const [routinesData, sessionsData, classesData, groupsData] = await Promise.all([
        resRoutines.ok ? resRoutines.json() : [],
        resSessions.ok ? resSessions.json() : [],
        resClasses.ok ? resClasses.json() : [],
        resGroups.ok ? resGroups.json() : [],
      ]);

      setRoutines(Array.isArray(routinesData) ? routinesData : []);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);

      // If current session exists, default filter and form to current session
      const current = Array.isArray(sessionsData) ? sessionsData.find((s) => s.isCurrent) : null;
      if (current) {
        setFilterSession(current.id);
      }
    } catch {
      toast("Could not load routine records.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function nextSortOrder(): number {
    const max = routines.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), 0);
    return Math.max(1, max + 1);
  }

  function openAddForm() {
    const currentSession = sessions.find((s) => s.isCurrent);
    setForm({
      ...EMPTY_FORM,
      academicSessionId: currentSession?.id || (sessions[0]?.id ?? ""),
      sortOrder: nextSortOrder(),
    });
    setErrors({});
    setFormOpen(true);
  }

  function openEditForm(item: RoutineRecord) {
    setForm({
      id: item.id,
      title: item.title,
      titleBn: item.titleBn ?? "",
      academicSessionId: item.academicSessionId,
      classOrDeptId: item.classOrDeptId,
      academicGroupId: item.academicGroupId ?? "",
      type: item.type || "CLASS",
      pdfUrl: item.pdfUrl,
      description: item.description ?? "",
      sortOrder: item.sortOrder ?? 1,
      isActive: item.isActive,
    });
    setErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) {
      nextErrors.title = "Routine title is required.";
    }
    if (!form.academicSessionId) {
      nextErrors.academicSessionId = "Please select an academic session.";
    }
    if (!form.classOrDeptId) {
      nextErrors.classOrDeptId = "Please select a class / department.";
    }
    if (!form.pdfUrl.trim()) {
      nextErrors.pdfUrl = "PDF document is required. Please upload a routine PDF.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        titleBn: form.titleBn.trim() || undefined,
        academicSessionId: form.academicSessionId,
        classOrDeptId: form.classOrDeptId,
        academicGroupId: form.academicGroupId || undefined,
        type: form.type || "CLASS",
        pdfUrl: form.pdfUrl.trim(),
        description: form.description.trim() || undefined,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };

      const res = await fetch(form.id ? `/api/routines/${form.id}` : "/api/routines", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
        throw new Error(detail || "Failed to save routine.");
      }

      toast(form.id ? "Routine updated successfully." : "Routine created successfully.");
      closeForm();
      await loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: RoutineRecord) {
    try {
      const res = await fetch(`/api/routines/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error();
      toast(item.isActive ? "Routine hidden from students." : "Routine is now live.");
      await loadData();
    } catch {
      toast("Could not update routine status.", "error");
    }
  }

  async function handleDelete(item: RoutineRecord) {
    const confirmed = await confirmDialog({
      title: "Delete Routine?",
      text: `Are you sure you want to remove "${item.title}"? This cannot be undone.`,
      confirmText: "Yes, delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/routines/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Routine removed.");
      if (form.id === item.id) closeForm();
      await loadData();
    } catch {
      toast("Could not delete routine.", "error");
    }
  }

  // Filtered routines list
  const filteredRoutines = useMemo(() => {
    return routines.filter((r) => {
      if (filterSession && r.academicSessionId !== filterSession) return false;
      if (filterClass && r.classOrDeptId !== filterClass) return false;
      if (filterGroup && r.academicGroupId !== filterGroup) return false;
      if (filterType && r.type !== filterType) return false;
      return true;
    });
  }, [routines, filterSession, filterClass, filterGroup, filterType]);

  const sessionOptions = useMemo(
    () =>
      sessions.map((s) => ({
        value: s.id,
        label: `${s.sessionName || s.sessionCode}${s.isCurrent ? " (Current)" : ""}`,
      })),
    [sessions],
  );

  const classOptions = useMemo(
    () =>
      classes.map((c) => ({
        value: c.id,
        label: c.name || c.code || "Class",
      })),
    [classes],
  );

  const groupOptions = useMemo(
    () => [
      { value: "", label: "General / All Groups" },
      ...groups.map((g) => ({
        value: g.id,
        label: g.name || g.code || "Group",
      })),
    ],
    [groups],
  );

  const typeOptions = [
    { value: "CLASS", label: "Class Routine" },
    { value: "EXAM", label: "Exam Routine" },
  ];

  const columns = useMemo<ColumnDef<RoutineRecord, any>[]>(
    () => [
      {
        header: "Routine Info",
        accessorKey: "title",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="min-w-0 max-w-sm">
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                    item.type === "EXAM"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {item.type === "EXAM" ? "Exam" : "Class"}
                </span>
                <span className="truncate font-semibold text-navy-900">{item.title}</span>
              </div>
              {item.titleBn && (
                <p className="truncate text-xs text-ink-500" dir="auto">
                  {item.titleBn}
                </p>
              )}
            </div>
          );
        },
      },
      {
        header: "Class / Dept",
        id: "classOrDept",
        cell: ({ row }) => {
          const item = row.original;
          const cls = item.classOrDept || classes.find((c) => c.id === item.classOrDeptId);
          return (
            <span className="font-medium text-navy-800">
              {cls?.name || cls?.code || "—"}
            </span>
          );
        },
      },
      {
        header: "Group",
        id: "academicGroup",
        cell: ({ row }) => {
          const item = row.original;
          const grp = item.academicGroup || groups.find((g) => g.id === item.academicGroupId);
          return grp ? (
            <span className="rounded-xs bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {grp.name || grp.code}
            </span>
          ) : (
            <span className="text-xs text-ink-400">General</span>
          );
        },
      },
      {
        header: "Session",
        id: "academicSession",
        cell: ({ row }) => {
          const item = row.original;
          const ses = item.academicSession || sessions.find((s) => s.id === item.academicSessionId);
          return (
            <span className="text-xs text-ink-600 font-mono">
              {ses?.sessionName || ses?.sessionCode || "—"}
            </span>
          );
        },
      },
      {
        header: "PDF Attachment",
        accessorKey: "pdfUrl",
        cell: ({ row }) => {
          const url = row.original.pdfUrl;
          if (!url) return <span className="text-xs text-ink-400">—</span>;
          const resolved = resolveImageUrl(url);
          return (
            <div className="flex items-center gap-2">
              <a
                href={resolved}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50 hover:text-brand-600"
                title="View PDF"
              >
                <FiFileText className="h-3.5 w-3.5 text-red-500" />
                <span>View</span>
                <FiExternalLink className="h-3 w-3 text-ink-400" />
              </a>
              <a
                href={resolved}
                download
                className="rounded-xs border border-ink-200 bg-white p-1 text-ink-600 hover:bg-ink-50 hover:text-brand-600"
                title="Download PDF"
              >
                <FiDownload className="h-3.5 w-3.5" />
              </a>
            </div>
          );
        },
      },
      {
        header: "Order",
        accessorKey: "sortOrder",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.sortOrder}</span>,
      },
      {
        header: "Status",
        accessorKey: "isActive",
        cell: ({ row }) => {
          const item = row.original;
          return item.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
              <FiEye className="h-3 w-3" /> Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
              <FiEyeOff className="h-3 w-3" /> Hidden
            </span>
          );
        },
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleActive(row.original)}
              className={`rounded-xs border border-transparent p-1.5 hover:bg-ink-100 ${
                row.original.isActive ? "text-emerald-600" : "text-ink-400"
              }`}
              aria-label={row.original.isActive ? "Hide routine" : "Publish routine"}
              title={row.original.isActive ? "Hide from students" : "Publish to students"}
            >
              {row.original.isActive ? <FiEye className="h-4 w-4" /> : <FiEyeOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => openEditForm(row.original)}
              className="rounded-xs border border-transparent p-1.5 text-ink-600 hover:bg-ink-100 hover:text-brand-600"
              aria-label="Edit routine"
              title="Edit routine details"
            >
              <FiEdit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(row.original)}
              className="rounded-xs border border-transparent p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Delete routine"
              title="Delete routine"
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [classes, groups, sessions],
  );

  if (loading) return <AdminPageLoader />;

  return (
    <section className="space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Class & Exam Routines</h1>
          <p className="text-xs text-ink-500">
            Upload and manage class and examination routines with PDF attachments for each class and group.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <FiPlus className="h-3.5 w-3.5" />
            Upload Routine
          </button>
        )}
      </div>

      {/* Upload & Edit Form Modal / Card */}
      {formOpen && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-navy-900">
              {form.id ? "Edit Routine Details" : "Upload New Routine"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xs p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close form"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>

          <DashCard>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Academic Session */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">
                    Academic Session <span className="text-rose-500">*</span>
                  </label>
                  <SearchSelect
                    options={sessionOptions}
                    value={form.academicSessionId}
                    onChange={(val) => setForm((prev) => ({ ...prev, academicSessionId: val }))}
                    placeholder="Select Session"
                  />
                  {errors.academicSessionId && (
                    <span className="mt-1 block text-xs text-red-600">
                      {errors.academicSessionId}
                    </span>
                  )}
                </div>

                {/* Class / Department */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">
                    Class / Dept <span className="text-rose-500">*</span>
                  </label>
                  <SearchSelect
                    options={classOptions}
                    value={form.classOrDeptId}
                    onChange={(val) => setForm((prev) => ({ ...prev, classOrDeptId: val }))}
                    placeholder="Select Class / Dept"
                  />
                  {errors.classOrDeptId && (
                    <span className="mt-1 block text-xs text-red-600">
                      {errors.classOrDeptId}
                    </span>
                  )}
                </div>

                {/* Academic Group */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">
                    Academic Group <span className="text-ink-400 font-normal">(Optional)</span>
                  </label>
                  <SearchSelect
                    options={groupOptions}
                    value={form.academicGroupId}
                    onChange={(val) => setForm((prev) => ({ ...prev, academicGroupId: val }))}
                    placeholder="General (All Groups)"
                    isClearable
                  />
                </div>

                {/* Routine Type */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">
                    Routine Type <span className="text-rose-500">*</span>
                  </label>
                  <SearchSelect
                    options={typeOptions}
                    value={form.type}
                    onChange={(val) => setForm((prev) => ({ ...prev, type: val || "CLASS" }))}
                    placeholder="Select Type"
                  />
                </div>
              </div>

              {/* Title EN & BN */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">
                    Routine Title (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className={INPUT_BASE}
                    placeholder="e.g. Class VII Daily Routine 2026"
                  />
                  {errors.title && (
                    <span className="mt-1 block text-xs text-red-600">{errors.title}</span>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">
                    রুটিনের নাম (বাংলা) <span className="text-ink-400 font-normal">(ঐচ্ছিক)</span>
                  </label>
                  <input
                    value={form.titleBn}
                    onChange={(e) => setForm((prev) => ({ ...prev, titleBn: e.target.value }))}
                    className={INPUT_BASE}
                    placeholder="যেমনঃ সপ্তম শ্রেণির দৈনিক রুটিন ২০২৬"
                    dir="auto"
                  />
                </div>
              </div>

              {/* PDF Document Upload */}
              <div>
                <PdfUploader
                  label="Upload Routine PDF (Required) *"
                  endpoint="/api/uploads/document"
                  value={form.pdfUrl}
                  onChange={(url) => setForm((prev) => ({ ...prev, pdfUrl: url }))}
                />
                {errors.pdfUrl && (
                  <span className="mt-1 block text-xs text-red-600">{errors.pdfUrl}</span>
                )}
              </div>

              {/* Description & Settings */}
              <div className="grid gap-4 sm:grid-cols-2 items-center">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">
                    Description / Instructions <span className="text-ink-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    className={INPUT_BASE}
                    placeholder="e.g. Effective from January 15, 2026"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 items-center pt-2 sm:pt-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-700">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.sortOrder}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value, 10) || 1 }))
                      }
                      className={INPUT_BASE}
                    />
                  </div>

                  <div className="pt-4">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="h-4 w-4 cursor-pointer rounded-xs border-ink-300 text-brand-600 focus:ring-0"
                      />
                      <span className="text-xs font-medium text-ink-800">
                        Live on Public Site
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex items-center rounded-xs border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiSave className="h-3.5 w-3.5" />}
                  {form.id ? "Update Routine" : "Save Routine"}
                </button>
              </div>
            </div>
          </DashCard>
        </div>
      )}

      {/* Filter Bar */}
      <DashCard title="Filter Routines">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4 items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Academic Session
            </label>
            <SearchSelect
              options={[{ value: "", label: "All Sessions" }, ...sessionOptions]}
              value={filterSession}
              onChange={setFilterSession}
              placeholder="All Sessions"
              isClearable
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Class / Dept
            </label>
            <SearchSelect
              options={[{ value: "", label: "All Classes" }, ...classOptions]}
              value={filterClass}
              onChange={setFilterClass}
              placeholder="All Classes"
              isClearable
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Academic Group
            </label>
            <SearchSelect
              options={[{ value: "", label: "All Groups" }, ...groupOptions.filter((g) => g.value)]}
              value={filterGroup}
              onChange={setFilterGroup}
              placeholder="All Groups"
              isClearable
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Routine Type
            </label>
            <SearchSelect
              options={[
                { value: "", label: "All Types" },
                { value: "CLASS", label: "Class Routine" },
                { value: "EXAM", label: "Exam Routine" },
              ]}
              value={filterType}
              onChange={setFilterType}
              placeholder="All Types"
              isClearable
            />
          </div>
        </div>
      </DashCard>

      {/* Routine Records Data Table */}
      <DataTable
        columns={columns}
        data={filteredRoutines}
        emptyMessage="No routines found for the selected criteria."
      />
    </section>
  );
}
