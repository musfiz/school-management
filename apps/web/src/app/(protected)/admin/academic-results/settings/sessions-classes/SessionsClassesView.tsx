"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiBookOpen as BookOpen, FiBookmark as Bookmark, FiLayers as Layers, FiEdit as Pencil, FiPlus as Plus, FiRefreshCcw as RefreshCw, FiShield as Shield, FiTrash as Trash } from "react-icons/fi";
import { GoCalendar as CalendarDays } from "react-icons/go";
import { RiLayoutLine as Layout } from "react-icons/ri";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import DatePickerField from "@/components/ui/DatePicker";
import { confirmDialog, toast } from "@/lib/swal";
import {
  CLASS_LEVELS,
  ENGINE_BEHAVIORS,
  createAcademicSession,
  createAcademicGroup,
  createClassOrDept,
  createExamTermType,
  createMasterSubject,
  createSectionOrBatch,
  deleteAcademicSession,
  deleteAcademicGroup,
  deleteClassOrDept,
  deleteExamTermType,
  deleteMasterSubject,
  deleteSectionOrBatch,
  listAcademicGroups,
  listAcademicSessions,
  listClassOrDepts,
  listExamTermTypes,
  listMasterSubjects,
  listSectionOrBatches,
  updateAcademicSession,
  updateAcademicGroup,
  updateClassOrDept,
  updateExamTermType,
  updateMasterSubject,
  updateSectionOrBatch,
  type AcademicGroup,
  type AcademicSession,
  type ClassOrDept,
  type ExamTermType,
  type MasterSubject,
  type SectionOrBatch,
} from "@/lib/academic-results";
import {
  ActionCell,
  BTN,
  BTN_MODAL,
  BTN_MODAL_PRIMARY,
  BTN_PRIMARY,
  BTN_ROW,
  EmptyRow,
  Field,
  FilterCard,
  INPUT,
  KpiTile,
  Modal,
  TabNav,
  TableWrap,
} from "../../_components/shared";

export type TabId = "sessions" | "classes" | "term-types" | "subjects" | "sections" | "groups";

interface SessionForm {
  id: string;
  sessionName: string;
  sessionCode: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCurrent: boolean;
}

interface ClassForm {
  id: string;
  name: string;
  code: string;
  level: string;
  displayOrder: string;
  isActive: boolean;
}

interface TermTypeForm {
  id: string;
  name: string;
  code: string;
  engineBehavior: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
}

interface SubjectForm {
  id: string;
  subjectCode: string;
  subjectName: string;
  boardStream: string;
  paperNumber: string;
}

interface SectionForm {
  id: string;
  name: string;
  code: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
}

const emptySessionForm = (): SessionForm => ({
  id: "",
  sessionName: "",
  sessionCode: "",
  startDate: "",
  endDate: "",
  isActive: true,
  isCurrent: false,
});

const emptyClassForm = (): ClassForm => ({
  id: "",
  name: "",
  code: "",
  level: "SCHOOL",
  displayOrder: "1",
  isActive: true,
});

const emptyTermTypeForm = (): TermTypeForm => ({
  id: "",
  name: "",
  code: "",
  engineBehavior: "TERMINAL",
  description: "",
  displayOrder: "1",
  isActive: true,
});

const emptySubjectForm = (): SubjectForm => ({
  id: "",
  subjectCode: "",
  subjectName: "",
  boardStream: "GENERAL",
  paperNumber: "",
});

const emptySectionForm = (): SectionForm => ({
  id: "",
  name: "",
  code: "",
  description: "",
  displayOrder: "1",
  isActive: true,
});

interface GroupForm {
  id: string;
  name: string;
  code: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
}

const emptyGroupForm = (): GroupForm => ({
  id: "",
  name: "",
  code: "",
  description: "",
  displayOrder: "1",
  isActive: true,
});

const LEVEL_OPTIONS = CLASS_LEVELS.map((level) => ({ value: level, label: level }));

const ENGINE_BEHAVIOR_OPTIONS = [
  { value: "TERMINAL", label: "TERMINAL — Main term (generates marksheets directly)" },
  { value: "SUB_EXAM_CT", label: "SUB_EXAM_CT — Child sub-exam aggregated into parent terminal" },
  { value: "CUMULATIVE_ANNUAL", label: "CUMULATIVE_ANNUAL — Weighted aggregate of terminal terms" },
];

const STREAM_OPTIONS = [
  { value: "GENERAL", label: "General" },
  { value: "SCIENCE", label: "Science" },
  { value: "HUMANITIES", label: "Humanities / Arts" },
  { value: "BUSINESS_STUDIES", label: "Business Studies / Commerce" },
  { value: "MADRASAH_GENERAL", label: "Madrasah General" },
  { value: "MADRASAH_SCIENCE", label: "Madrasah Science" },
  { value: "VOCATIONAL", label: "Vocational" },
];

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function SessionsClassesView({ initialTab = "sessions" }: { initialTab?: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassOrDept[]>([]);
  const [termTypes, setTermTypes] = useState<ExamTermType[]>([]);
  const [subjects, setSubjects] = useState<MasterSubject[]>([]);
  const [sections, setSections] = useState<SectionOrBatch[]>([]);
  const [groups, setGroups] = useState<AcademicGroup[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [levelFilter, setLevelFilter] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [search, setSearch] = useState("");

  const [sessionForm, setSessionForm] = useState<SessionForm | null>(null);
  const [classForm, setClassForm] = useState<ClassForm | null>(null);
  const [termTypeForm, setTermTypeForm] = useState<TermTypeForm | null>(null);
  const [subjectForm, setSubjectForm] = useState<SubjectForm | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionForm | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionRes, classRes, termTypeRes, subjectRes, sectionRes, groupRes] = await Promise.allSettled([
        listAcademicSessions(showInactive),
        listClassOrDepts({ includeInactive: showInactive, level: levelFilter || undefined }),
        listExamTermTypes(showInactive),
        listMasterSubjects(streamFilter || undefined),
        listSectionOrBatches(showInactive),
        listAcademicGroups(showInactive),
      ]);
      if (sessionRes.status === "fulfilled") setSessions(sessionRes.value);
      if (classRes.status === "fulfilled") setClasses(classRes.value);
      if (termTypeRes.status === "fulfilled") setTermTypes(termTypeRes.value);
      if (subjectRes.status === "fulfilled") setSubjects(subjectRes.value);
      if (sectionRes.status === "fulfilled") setSections(sectionRes.value);
      if (groupRes.status === "fulfilled") setGroups(groupRes.value);

      const rejected = [sessionRes, classRes, termTypeRes, subjectRes, sectionRes, groupRes].find(
        (r) => r.status === "rejected",
      );
      if (rejected && rejected.status === "rejected") {
        toast(rejected.reason instanceof Error ? rejected.reason.message : "Some master data could not be loaded", "warning");
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load master setup data", "error");
    } finally {
      setLoading(false);
    }
  }, [showInactive, levelFilter, streamFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentSession = useMemo(() => sessions.find((s) => s.isCurrent) ?? null, [sessions]);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => `${s.sessionName} ${s.sessionCode}`.toLowerCase().includes(q));
  }, [sessions, search]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => `${c.name} ${c.code} ${c.level}`.toLowerCase().includes(q));
  }, [classes, search]);

  const filteredTermTypes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return termTypes;
    return termTypes.filter(
      (t) =>
        `${t.name} ${t.code} ${t.engineBehavior} ${t.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [termTypes, search]);

  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        `${s.subjectCode} ${s.subjectName} ${s.boardStream} ${s.paperNumber ?? ""}`
          .toLowerCase()
          .includes(q),
    );
  }, [subjects, search]);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) =>
        `${s.name} ${s.code} ${s.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [sections, search]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) => `${g.name} ${g.code} ${g.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [groups, search]);

  /* ================= sessions ================= */

  const openSessionCreate = () => setSessionForm(emptySessionForm());
  const openSessionEdit = (row: AcademicSession) =>
    setSessionForm({
      id: row.id,
      sessionName: row.sessionName,
      sessionCode: row.sessionCode,
      startDate: toDateInput(row.startDate),
      endDate: toDateInput(row.endDate),
      isActive: row.isActive,
      isCurrent: row.isCurrent,
    });

  const saveSession = async () => {
    if (!sessionForm) return;
    if (!sessionForm.sessionName.trim()) {
      toast("A session name is required (e.g. 2026)", "error");
      return;
    }
    if (!sessionForm.sessionCode.trim()) {
      toast("A session code is required (e.g. 2026-27)", "error");
      return;
    }
    setBusy(true);
    try {
      if (sessionForm.id) {
        await updateAcademicSession(sessionForm.id, {
          sessionName: sessionForm.sessionName.trim(),
          sessionCode: sessionForm.sessionCode.trim(),
          startDate: sessionForm.startDate || undefined,
          endDate: sessionForm.endDate || undefined,
          isActive: sessionForm.isActive,
          isCurrent: sessionForm.isCurrent,
        });
        toast("Academic session updated", "success");
      } else {
        await createAcademicSession({
          sessionName: sessionForm.sessionName.trim(),
          sessionCode: sessionForm.sessionCode.trim(),
          startDate: sessionForm.startDate || undefined,
          endDate: sessionForm.endDate || undefined,
          isActive: sessionForm.isActive,
          isCurrent: sessionForm.isCurrent,
        });
        toast("Academic session created — it now appears in every session dropdown", "success");
      }
      setSessionForm(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the session", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeSession = async (row: AcademicSession) => {
    const ok = await confirmDialog({
      title: `Delete "${row.sessionName}"?`,
      text: "Sessions referenced by syllabus, terms or enrollments cannot be deleted — deactivate them instead.",
      confirmText: "Delete session",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAcademicSession(row.id);
      toast("Academic session deleted", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the session", "error");
    }
  };

  /* ================= classes ================= */

  const openClassCreate = () =>
    setClassForm({ ...emptyClassForm(), displayOrder: String(classes.length + 1) });
  const openClassEdit = (row: ClassOrDept) =>
    setClassForm({
      id: row.id,
      name: row.name,
      code: row.code,
      level: row.level,
      displayOrder: String(row.displayOrder),
      isActive: row.isActive,
    });

  const saveClass = async () => {
    if (!classForm) return;
    if (!classForm.name.trim()) {
      toast("Class name is required (e.g. Class VI)", "error");
      return;
    }
    if (!classForm.code.trim()) {
      toast("Class code is required (e.g. CLS-06)", "error");
      return;
    }
    const order = Number(classForm.displayOrder);
    setBusy(true);
    try {
      if (classForm.id) {
        await updateClassOrDept(classForm.id, {
          name: classForm.name.trim(),
          code: classForm.code.trim().toUpperCase(),
          level: classForm.level,
          displayOrder: Number.isFinite(order) ? order : 1,
          isActive: classForm.isActive,
        });
        toast("Class updated", "success");
      } else {
        await createClassOrDept({
          name: classForm.name.trim(),
          code: classForm.code.trim().toUpperCase(),
          level: classForm.level,
          displayOrder: Number.isFinite(order) ? order : 1,
          isActive: classForm.isActive,
        });
        toast("Class created — it now appears in every class dropdown", "success");
      }
      setClassForm(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the class", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeClass = async (row: ClassOrDept) => {
    const ok = await confirmDialog({
      title: `Delete "${row.name}"?`,
      text: "Classes referenced by syllabus or enrollments cannot be deleted — deactivate them instead.",
      confirmText: "Delete class",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteClassOrDept(row.id);
      toast("Class deleted", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the class", "error");
    }
  };

  /* ================= exam term types ================= */

  const openTermTypeCreate = () =>
    setTermTypeForm({ ...emptyTermTypeForm(), displayOrder: String(termTypes.length + 1) });
  const openTermTypeEdit = (row: ExamTermType) =>
    setTermTypeForm({
      id: row.id,
      name: row.name,
      code: row.code,
      engineBehavior: row.engineBehavior,
      description: row.description ?? "",
      displayOrder: String(row.displayOrder),
      isActive: row.isActive,
    });

  const saveTermType = async () => {
    if (!termTypeForm) return;
    if (!termTypeForm.name.trim()) {
      toast("Term type name is required (e.g. Half-Yearly Exam)", "error");
      return;
    }
    if (!termTypeForm.code.trim()) {
      toast("Term type code is required (e.g. HALF_YEARLY)", "error");
      return;
    }
    const order = Number(termTypeForm.displayOrder);
    setBusy(true);
    try {
      if (termTypeForm.id) {
        await updateExamTermType(termTypeForm.id, {
          name: termTypeForm.name.trim(),
          code: termTypeForm.code.trim().toUpperCase(),
          engineBehavior: termTypeForm.engineBehavior,
          description: termTypeForm.description.trim() || null,
          displayOrder: Number.isFinite(order) ? order : 1,
          isActive: termTypeForm.isActive,
        });
        toast("Exam term type updated", "success");
      } else {
        await createExamTermType({
          name: termTypeForm.name.trim(),
          code: termTypeForm.code.trim().toUpperCase(),
          engineBehavior: termTypeForm.engineBehavior,
          description: termTypeForm.description.trim() || null,
          displayOrder: Number.isFinite(order) ? order : 1,
          isActive: termTypeForm.isActive,
        });
        toast("Exam term type created — now available in Exam Terms setup", "success");
      }
      setTermTypeForm(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the exam term type", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeTermType = async (row: ExamTermType) => {
    const isBuiltin = (ENGINE_BEHAVIORS as readonly string[]).includes(row.code);
    if (isBuiltin) {
      toast(`"${row.code}" is a built-in engine behavior and cannot be deleted`, "info");
      return;
    }
    const ok = await confirmDialog({
      title: `Delete "${row.name}"?`,
      text: "Term types used by existing exam terms cannot be deleted — deactivate them instead.",
      confirmText: "Delete term type",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteExamTermType(row.id);
      toast("Exam term type deleted", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the term type", "error");
    }
  };

  /* ================= master subjects ================= */

  const openSubjectCreate = () => setSubjectForm(emptySubjectForm());
  const openSubjectEdit = (row: MasterSubject) =>
    setSubjectForm({
      id: row.id,
      subjectCode: row.subjectCode,
      subjectName: row.subjectName,
      boardStream: row.boardStream,
      paperNumber: row.paperNumber ? String(row.paperNumber) : "",
    });

  const saveSubject = async () => {
    if (!subjectForm) return;
    if (!subjectForm.subjectCode.trim()) {
      toast("Subject code is required (e.g. 101 or BAN-1)", "error");
      return;
    }
    if (!subjectForm.subjectName.trim()) {
      toast("Subject name is required (e.g. Bangla 1st Paper)", "error");
      return;
    }
    const paper = subjectForm.paperNumber.trim() ? Number(subjectForm.paperNumber) : null;
    setBusy(true);
    try {
      if (subjectForm.id) {
        await updateMasterSubject(subjectForm.id, {
          subjectCode: subjectForm.subjectCode.trim().toUpperCase(),
          subjectName: subjectForm.subjectName.trim(),
          boardStream: subjectForm.boardStream,
          paperNumber: paper,
        });
        toast("Master subject updated", "success");
      } else {
        await createMasterSubject({
          subjectCode: subjectForm.subjectCode.trim().toUpperCase(),
          subjectName: subjectForm.subjectName.trim(),
          boardStream: subjectForm.boardStream,
          paperNumber: paper,
        });
        toast("Master subject created — ready to add to syllabus", "success");
      }
      setSubjectForm(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the master subject", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeSubject = async (row: MasterSubject) => {
    const ok = await confirmDialog({
      title: `Delete "${row.subjectName}" (${row.subjectCode})?`,
      text: "Subjects referenced by any syllabus matrix cannot be deleted.",
      confirmText: "Delete subject",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMasterSubject(row.id);
      toast("Master subject deleted", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the subject", "error");
    }
  };

  const openSectionCreate = () => setSectionForm(emptySectionForm());
  const openSectionEdit = (row: SectionOrBatch) =>
    setSectionForm({
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description ?? "",
      displayOrder: String(row.displayOrder),
      isActive: row.isActive,
    });

  const saveSection = async () => {
    if (!sectionForm) return;
    if (!sectionForm.name.trim()) {
      toast("Section name is required (e.g. Section A)", "error");
      return;
    }
    if (!sectionForm.code.trim()) {
      toast("Section code is required (e.g. SEC-A)", "error");
      return;
    }
    const order = Number(sectionForm.displayOrder);
    setBusy(true);
    try {
      if (sectionForm.id) {
        await updateSectionOrBatch(sectionForm.id, {
          name: sectionForm.name.trim(),
          code: sectionForm.code.trim().toUpperCase(),
          description: sectionForm.description.trim() || null,
          displayOrder: Number.isFinite(order) ? order : 1,
          isActive: sectionForm.isActive,
        });
        toast("Section updated", "success");
      } else {
        await createSectionOrBatch({
          name: sectionForm.name.trim(),
          code: sectionForm.code.trim().toUpperCase(),
          description: sectionForm.description.trim() || null,
          displayOrder: Number.isFinite(order) ? order : 1,
          isActive: sectionForm.isActive,
        });
        toast("Section created — ready to use in enrollments", "success");
      }
      setSectionForm(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the section", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeSection = async (row: SectionOrBatch) => {
    const ok = await confirmDialog({
      title: `Delete "${row.name}" (${row.code})?`,
      text: "Sections referenced by active enrollments cannot be deleted — deactivate them instead.",
      confirmText: "Delete section",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSectionOrBatch(row.id);
      toast("Section deleted", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the section", "error");
    }
  };

  const openGroupCreate = () => setGroupForm(emptyGroupForm());
  const openGroupEdit = (row: AcademicGroup) =>
    setGroupForm({
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description ?? "",
      displayOrder: String(row.displayOrder),
      isActive: row.isActive,
    });

  const saveGroup = async () => {
    if (!groupForm) return;
    if (!groupForm.name.trim()) {
      toast("Group name is required (e.g. Science)", "error");
      return;
    }
    if (!groupForm.code.trim()) {
      toast("Group code is required (e.g. SCI)", "error");
      return;
    }
    const order = Number(groupForm.displayOrder);
    setBusy(true);
    try {
      if (groupForm.id) {
        await updateAcademicGroup(groupForm.id, {
          name: groupForm.name.trim(),
          code: groupForm.code.trim().toUpperCase(),
          description: groupForm.description.trim() || null,
          displayOrder: Number.isFinite(order) ? order : 1,
          isActive: groupForm.isActive,
        });
        toast("Group updated", "success");
      } else {
        await createAcademicGroup({
          name: groupForm.name.trim(),
          code: groupForm.code.trim().toUpperCase(),
          description: groupForm.description.trim() || null,
          displayOrder: Number.isFinite(order) ? order : 1,
          isActive: groupForm.isActive,
        });
        toast("Group created — ready to use in enrollments", "success");
      }
      setGroupForm(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the group", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeGroup = async (row: AcademicGroup) => {
    const ok = await confirmDialog({
      title: `Delete "${row.name}" (${row.code})?`,
      text: "Groups referenced by active enrollments cannot be deleted — deactivate them instead.",
      confirmText: "Delete group",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAcademicGroup(row.id);
      toast("Group deleted", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the group", "error");
    }
  };

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Academic Master Setup"
        description="Master data center — manage Academic Sessions, Classes / Departments, Exam Term Types, Master Subjects, and Sections / Batches."
      />

      <TabNav
        tabs={[
          { id: "sessions", label: `Sessions (${sessions.length})`, icon: <CalendarDays className="h-3.5 w-3.5" /> },
          { id: "classes", label: `Classes (${classes.length})`, icon: <BookOpen className="h-3.5 w-3.5" /> },
          { id: "term-types", label: `Term Types (${termTypes.length})`, icon: <Layers className="h-3.5 w-3.5" /> },
          { id: "subjects", label: `Master Subjects (${subjects.length})`, icon: <Bookmark className="h-3.5 w-3.5" /> },
          { id: "sections", label: `Sections (${sections.length})`, icon: <Layout className="h-3.5 w-3.5" /> },
          { id: "groups", label: `Groups (${groups.length})`, icon: <Shield className="h-3.5 w-3.5" /> },
        ]}
        active={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      <FilterCard
        title={`Filter ${
          tab === "sessions"
            ? "sessions"
            : tab === "classes"
              ? "classes"
              : tab === "term-types"
                ? "term types"
                : tab === "subjects"
                  ? "master subjects"
                  : tab === "sections"
                    ? "sections"
                    : "groups"
        }`}
      >
        <Field label="Search">
          <input
            className={INPUT}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "sessions"
                ? "Search name or code…"
                : tab === "classes"
                  ? "Search name, code or level…"
                  : tab === "term-types"
                    ? "Search name, code or behavior…"
                    : tab === "sections"
                      ? "Search name, code or description…"
                      : tab === "groups"
                        ? "Search name, code or description…"
                        : "Search code, name, stream…"
            }
          />
        </Field>

        {tab === "classes" && (
          <Field label="Level">
            <SearchSelect
              options={LEVEL_OPTIONS}
              value={levelFilter}
              onChange={setLevelFilter}
              placeholder="All levels"
              ariaLabel="Level filter"
            />
          </Field>
        )}

        {tab === "subjects" && (
          <Field label="Board Stream">
            <SearchSelect
              options={STREAM_OPTIONS}
              value={streamFilter}
              onChange={setStreamFilter}
              placeholder="All streams"
              ariaLabel="Stream filter"
            />
          </Field>
        )}

        {(tab === "sessions" || tab === "classes" || tab === "term-types" || tab === "sections" || tab === "groups") && (
          <Field label="Visibility">
            <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink-700">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
          </Field>
        )}

        <ActionCell>
          <button type="button" className={BTN} onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {tab === "sessions" && (
            <button type="button" className={BTN_PRIMARY} onClick={openSessionCreate}>
              <Plus className="h-3.5 w-3.5" />
              New session
            </button>
          )}
          {tab === "classes" && (
            <button type="button" className={BTN_PRIMARY} onClick={openClassCreate}>
              <Plus className="h-3.5 w-3.5" />
              New class
            </button>
          )}
          {tab === "term-types" && (
            <button type="button" className={BTN_PRIMARY} onClick={openTermTypeCreate}>
              <Plus className="h-3.5 w-3.5" />
              New term type
            </button>
          )}
          {tab === "subjects" && (
            <button type="button" className={BTN_PRIMARY} onClick={openSubjectCreate}>
              <Plus className="h-3.5 w-3.5" />
              New subject
            </button>
          )}
          {tab === "sections" && (
            <button type="button" className={BTN_PRIMARY} onClick={openSectionCreate}>
              <Plus className="h-3.5 w-3.5" />
              New section
            </button>
          )}
          {tab === "groups" && (
            <button type="button" className={BTN_PRIMARY} onClick={openGroupCreate}>
              <Plus className="h-3.5 w-3.5" />
              New group
            </button>
          )}
        </ActionCell>
      </FilterCard>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tab === "sessions" && (
          <>
            <KpiTile label="Total sessions" value={String(sessions.length)} />
            <KpiTile label="Current session" value={currentSession ? currentSession.sessionCode : "—"} tone="emerald" />
            <KpiTile label="Active sessions" value={String(sessions.filter((s) => s.isActive).length)} tone="navy" />
            <KpiTile label="Inactive sessions" value={String(sessions.filter((s) => !s.isActive).length)} tone="ink" />
          </>
        )}
        {tab === "classes" && (
          <>
            <KpiTile label="Total classes" value={String(classes.length)} />
            <KpiTile label="Active classes" value={String(classes.filter((c) => c.isActive).length)} tone="emerald" />
            <KpiTile label="School level" value={String(classes.filter((c) => c.level === "SCHOOL").length)} tone="navy" />
            <KpiTile label="College / higher" value={String(classes.filter((c) => c.level !== "SCHOOL").length)} tone="amber" />
          </>
        )}
        {tab === "term-types" && (
          <>
            <KpiTile label="Total term types" value={String(termTypes.length)} />
            <KpiTile label="Terminal types" value={String(termTypes.filter((t) => t.engineBehavior === "TERMINAL").length)} tone="emerald" />
            <KpiTile label="Sub-exam / CT types" value={String(termTypes.filter((t) => t.engineBehavior === "SUB_EXAM_CT").length)} tone="navy" />
            <KpiTile label="Annual cumulative" value={String(termTypes.filter((t) => t.engineBehavior === "CUMULATIVE_ANNUAL").length)} tone="amber" />
          </>
        )}
        {tab === "subjects" && (
          <>
            <KpiTile label="Master subjects" value={String(subjects.length)} />
            <KpiTile label="General stream" value={String(subjects.filter((s) => s.boardStream === "GENERAL").length)} tone="emerald" />
            <KpiTile label="Science stream" value={String(subjects.filter((s) => s.boardStream === "SCIENCE").length)} tone="navy" />
            <KpiTile label="Multi-paper subjects" value={String(subjects.filter((s) => s.paperNumber != null).length)} tone="amber" />
          </>
        )}
        {tab === "sections" && (
          <>
            <KpiTile label="Total sections" value={String(sections.length)} />
            <KpiTile label="Active sections" value={String(sections.filter((s) => s.isActive).length)} tone="emerald" />
            <KpiTile label="Inactive sections" value={String(sections.filter((s) => !s.isActive).length)} tone="ink" />
          </>
        )}
        {tab === "groups" && (
          <>
            <KpiTile label="Total groups" value={String(groups.length)} />
            <KpiTile label="Active groups" value={String(groups.filter((g) => g.isActive).length)} tone="emerald" />
            <KpiTile label="Inactive groups" value={String(groups.filter((g) => !g.isActive).length)} tone="ink" />
          </>
        )}
      </div>

      {loading ? (
        <DashCard title="Loading master data…">
          <AdminPageLoader variant="inline" />
        </DashCard>
      ) : tab === "sessions" ? (
        /* Sessions Table */
        <DashCard
          title="Academic sessions"
          action={
            <button type="button" className={BTN} onClick={openSessionCreate}>
              <Plus className="h-3.5 w-3.5" />
              New session
            </button>
          }
        >
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Session</th>
                  <th className="px-2.5 py-1.5 font-semibold">Code</th>
                  <th className="px-2.5 py-1.5 font-semibold">Start</th>
                  <th className="px-2.5 py-1.5 font-semibold">End</th>
                  <th className="px-2.5 py-1.5 font-semibold">Flags</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {filteredSessions.length === 0 ? (
                  <EmptyRow colSpan={6} message="No sessions. Click 'New session' to create 2026-27." />
                ) : (
                  filteredSessions.map((row) => (
                    <tr key={row.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-medium">{row.sessionName}</td>
                      <td className="px-2.5 py-1 font-mono text-ink-600">{row.sessionCode}</td>
                      <td className="px-2.5 py-1 font-mono">{toDateInput(row.startDate) || "—"}</td>
                      <td className="px-2.5 py-1 font-mono">{toDateInput(row.endDate) || "—"}</td>
                      <td className="px-2.5 py-1">
                        <span className="flex flex-wrap gap-1">
                          {row.isCurrent && (
                            <span className="rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                              CURRENT
                            </span>
                          )}
                          {!row.isActive && (
                            <span className="rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              INACTIVE
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2.5 py-1">
                        <div className="flex items-center gap-1">
                          <button type="button" className={BTN_ROW} onClick={() => openSessionEdit(row)}>
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${BTN_ROW} text-rose-700`}
                            onClick={() => void removeSession(row)}
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </DashCard>
      ) : tab === "classes" ? (
        /* Classes Table */
        <DashCard
          title="Classes & Departments"
          action={
            <button type="button" className={BTN} onClick={openClassCreate}>
              <Plus className="h-3.5 w-3.5" />
              New class
            </button>
          }
        >
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Name</th>
                  <th className="px-2.5 py-1.5 font-semibold">Code</th>
                  <th className="px-2.5 py-1.5 font-semibold">Level</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Order</th>
                  <th className="px-2.5 py-1.5 font-semibold">Flags</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {filteredClasses.length === 0 ? (
                  <EmptyRow colSpan={6} message="No classes. Click 'New class' to add Class VI, VII, etc." />
                ) : (
                  filteredClasses.map((row) => (
                    <tr key={row.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-medium">{row.name}</td>
                      <td className="px-2.5 py-1 font-mono text-ink-600">{row.code}</td>
                      <td className="px-2.5 py-1">
                        <span className="rounded-xs bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-800">
                          {row.level}
                        </span>
                      </td>
                      <td className="px-2.5 py-1 text-right font-mono">{row.displayOrder}</td>
                      <td className="px-2.5 py-1">
                        {!row.isActive && (
                          <span className="rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            INACTIVE
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-1">
                        <div className="flex items-center gap-1">
                          <button type="button" className={BTN_ROW} onClick={() => openClassEdit(row)}>
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${BTN_ROW} text-rose-700`}
                            onClick={() => void removeClass(row)}
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </DashCard>
      ) : tab === "term-types" ? (
        /* Term Types Table */
        <DashCard
          title="Exam Term Types (Dynamic Master)"
          action={
            <button type="button" className={BTN} onClick={openTermTypeCreate}>
              <Plus className="h-3.5 w-3.5" />
              New term type
            </button>
          }
        >
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Name</th>
                  <th className="px-2.5 py-1.5 font-semibold">Code</th>
                  <th className="px-2.5 py-1.5 font-semibold">Engine Behavior</th>
                  <th className="px-2.5 py-1.5 font-semibold">Description</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Order</th>
                  <th className="px-2.5 py-1.5 font-semibold">Flags</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {filteredTermTypes.length === 0 ? (
                  <EmptyRow colSpan={7} message="No exam term types found. Click 'New term type' to add one." />
                ) : (
                  filteredTermTypes.map((row) => (
                    <tr key={row.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-medium">{row.name}</td>
                      <td className="px-2.5 py-1 font-mono text-ink-600">{row.code}</td>
                      <td className="px-2.5 py-1">
                        <span
                          className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                            row.engineBehavior === "TERMINAL"
                              ? "bg-emerald-100 text-emerald-800"
                              : row.engineBehavior === "SUB_EXAM_CT"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {row.engineBehavior}
                        </span>
                      </td>
                      <td className="px-2.5 py-1 text-ink-600">{row.description || "—"}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{row.displayOrder}</td>
                      <td className="px-2.5 py-1">
                        {!row.isActive && (
                          <span className="rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            INACTIVE
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-1">
                        <div className="flex items-center gap-1">
                          <button type="button" className={BTN_ROW} onClick={() => openTermTypeEdit(row)}>
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${BTN_ROW} text-rose-700`}
                            onClick={() => void removeTermType(row)}
                            title={
                              (ENGINE_BEHAVIORS as readonly string[]).includes(row.code)
                                ? "Built-in types cannot be deleted"
                                : "Delete term type"
                            }
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </DashCard>
      ) : tab === "sections" ? (
        /* Sections Table */
        <DashCard
          title="Sections & Batches"
          action={
            <button type="button" className={BTN} onClick={openSectionCreate}>
              <Plus className="h-3.5 w-3.5" />
              New section
            </button>
          }
        >
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Section</th>
                  <th className="px-2.5 py-1.5 font-semibold">Code</th>
                  <th className="px-2.5 py-1.5 font-semibold">Description</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Order</th>
                  <th className="px-2.5 py-1.5 font-semibold">Flags</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {filteredSections.length === 0 ? (
                  <EmptyRow colSpan={6} message="No sections found. Click 'New section' to add Section A, B, etc." />
                ) : (
                  filteredSections.map((row) => (
                    <tr key={row.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-medium">{row.name}</td>
                      <td className="px-2.5 py-1 font-mono text-ink-600">{row.code}</td>
                      <td className="px-2.5 py-1 text-ink-600">{row.description || "—"}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{row.displayOrder}</td>
                      <td className="px-2.5 py-1">
                        {!row.isActive && (
                          <span className="rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            INACTIVE
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-1">
                        <div className="flex items-center gap-1">
                          <button type="button" className={BTN_ROW} onClick={() => openSectionEdit(row)}>
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${BTN_ROW} text-rose-700`}
                            onClick={() => void removeSection(row)}
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </DashCard>
      ) : tab === "groups" ? (
        /* Groups Table */
        <DashCard
          title="Groups"
          action={
            <button type="button" className={BTN} onClick={openGroupCreate}>
              <Plus className="h-3.5 w-3.5" />
              New group
            </button>
          }
        >
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Group</th>
                  <th className="px-2.5 py-1.5 font-semibold">Code</th>
                  <th className="px-2.5 py-1.5 font-semibold">Description</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Order</th>
                  <th className="px-2.5 py-1.5 font-semibold">Flags</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {filteredGroups.length === 0 ? (
                  <EmptyRow colSpan={6} message="No groups found. Click 'New group' to add Science, Humanities, etc." />
                ) : (
                  filteredGroups.map((row) => (
                    <tr key={row.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-medium">{row.name}</td>
                      <td className="px-2.5 py-1 font-mono text-ink-600">{row.code}</td>
                      <td className="px-2.5 py-1 text-ink-600">{row.description || "—"}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{row.displayOrder}</td>
                      <td className="px-2.5 py-1">
                        {!row.isActive && (
                          <span className="rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            INACTIVE
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-1">
                        <div className="flex items-center gap-1">
                          <button type="button" className={BTN_ROW} onClick={() => openGroupEdit(row)}>
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${BTN_ROW} text-rose-700`}
                            onClick={() => void removeGroup(row)}
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </DashCard>
      ) : (
        /* Master Subjects Table */
        <DashCard
          title="Master Subjects Catalogue"
          action={
            <button type="button" className={BTN} onClick={openSubjectCreate}>
              <Plus className="h-3.5 w-3.5" />
              New subject
            </button>
          }
        >
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Subject Code</th>
                  <th className="px-2.5 py-1.5 font-semibold">Subject Name</th>
                  <th className="px-2.5 py-1.5 font-semibold">Board Stream</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Paper</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {filteredSubjects.length === 0 ? (
                  <EmptyRow colSpan={5} message="No subjects found. Click 'New subject' to add Bangla, English, etc." />
                ) : (
                  filteredSubjects.map((row) => (
                    <tr key={row.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-mono font-medium">{row.subjectCode}</td>
                      <td className="px-2.5 py-1 font-medium">{row.subjectName}</td>
                      <td className="px-2.5 py-1">
                        <span className="rounded-xs bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-800">
                          {row.boardStream}
                        </span>
                      </td>
                      <td className="px-2.5 py-1 text-right font-mono">{row.paperNumber ? `Paper ${row.paperNumber}` : "—"}</td>
                      <td className="px-2.5 py-1">
                        <div className="flex items-center gap-1">
                          <button type="button" className={BTN_ROW} onClick={() => openSubjectEdit(row)}>
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${BTN_ROW} text-rose-700`}
                            onClick={() => void removeSubject(row)}
                          >
                            <Trash className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </DashCard>
      )}

      {/* Modal: Academic Session */}
      {sessionForm && (
        <Modal
          title={sessionForm.id ? "Edit academic session" : "New academic session"}
          onClose={() => setSessionForm(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setSessionForm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_MODAL_PRIMARY}
                onClick={() => void saveSession()}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save session"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Session name">
              <input
                className={INPUT}
                value={sessionForm.sessionName}
                onChange={(e) => setSessionForm({ ...sessionForm, sessionName: e.target.value })}
                placeholder="e.g. 2026 or 2026-2027"
              />
            </Field>
            <Field label="Session code (unique identifier)">
              <input
                className={INPUT}
                value={sessionForm.sessionCode}
                onChange={(e) => setSessionForm({ ...sessionForm, sessionCode: e.target.value })}
                placeholder="e.g. 2026-27"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DatePickerField
                label="Start date"
                value={sessionForm.startDate}
                onChange={(val) => setSessionForm({ ...sessionForm, startDate: val })}
              />
              <DatePickerField
                label="End date"
                value={sessionForm.endDate}
                onChange={(val) => setSessionForm({ ...sessionForm, endDate: val })}
                minDate={sessionForm.startDate}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={sessionForm.isActive}
                  onChange={(e) => setSessionForm({ ...sessionForm, isActive: e.target.checked })}
                />
                Active
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={sessionForm.isCurrent}
                  onChange={(e) => setSessionForm({ ...sessionForm, isCurrent: e.target.checked })}
                />
                Mark as Current session
              </label>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Class / Dept */}
      {classForm && (
        <Modal
          title={classForm.id ? "Edit class / department" : "New class / department"}
          onClose={() => setClassForm(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setClassForm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_MODAL_PRIMARY}
                onClick={() => void saveClass()}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save class"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Class / department name">
              <input
                className={INPUT}
                value={classForm.name}
                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                placeholder="e.g. Class VI or Dept of English"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Code (unique)">
                <input
                  className={INPUT}
                  value={classForm.code}
                  onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                  placeholder="e.g. CLS-06"
                />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  className={INPUT}
                  value={classForm.displayOrder}
                  onChange={(e) => setClassForm({ ...classForm, displayOrder: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Academic level">
              <SearchSelect
                options={LEVEL_OPTIONS}
                value={classForm.level}
                onChange={(val) => setClassForm({ ...classForm, level: val })}
                placeholder="Select level"
                isClearable={false}
                ariaLabel="Academic level"
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-ink-700">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={classForm.isActive}
                onChange={(e) => setClassForm({ ...classForm, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>
        </Modal>
      )}

      {/* Modal: Exam Term Type */}
      {termTypeForm && (
        <Modal
          title={termTypeForm.id ? "Edit exam term type" : "New exam term type"}
          onClose={() => setTermTypeForm(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setTermTypeForm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_MODAL_PRIMARY}
                onClick={() => void saveTermType()}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save term type"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Term type name">
              <input
                className={INPUT}
                value={termTypeForm.name}
                onChange={(e) => setTermTypeForm({ ...termTypeForm, name: e.target.value })}
                placeholder="e.g. Half-Yearly Exam, Yearly Final, Model Test"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Code (unique UPPERCASE)">
                <input
                  className={INPUT}
                  value={termTypeForm.code}
                  onChange={(e) => setTermTypeForm({ ...termTypeForm, code: e.target.value })}
                  placeholder="e.g. HALF_YEARLY"
                />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  className={INPUT}
                  value={termTypeForm.displayOrder}
                  onChange={(e) => setTermTypeForm({ ...termTypeForm, displayOrder: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Engine behavior">
              <SearchSelect
                options={ENGINE_BEHAVIOR_OPTIONS}
                value={termTypeForm.engineBehavior}
                onChange={(val) => setTermTypeForm({ ...termTypeForm, engineBehavior: val })}
                placeholder="Select behavior"
                isClearable={false}
                ariaLabel="Engine behavior"
              />
            </Field>
            <Field label="Description (optional)">
              <input
                className={INPUT}
                value={termTypeForm.description}
                onChange={(e) => setTermTypeForm({ ...termTypeForm, description: e.target.value })}
                placeholder="e.g. Mid-year terminal exam with marksheet generation"
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-ink-700">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={termTypeForm.isActive}
                onChange={(e) => setTermTypeForm({ ...termTypeForm, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>
        </Modal>
      )}

      {/* Modal: Master Subject */}
      {subjectForm && (
        <Modal
          title={subjectForm.id ? "Edit master subject" : "New master subject"}
          onClose={() => setSubjectForm(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setSubjectForm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_MODAL_PRIMARY}
                onClick={() => void saveSubject()}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save subject"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Subject code">
                <input
                  className={INPUT}
                  value={subjectForm.subjectCode}
                  onChange={(e) => setSubjectForm({ ...subjectForm, subjectCode: e.target.value })}
                  placeholder="e.g. 101 or BAN-1"
                />
              </Field>
              <Field label="Paper number (optional)">
                <input
                  type="number"
                  className={INPUT}
                  value={subjectForm.paperNumber}
                  onChange={(e) => setSubjectForm({ ...subjectForm, paperNumber: e.target.value })}
                  placeholder="e.g. 1 or 2"
                />
              </Field>
            </div>
            <Field label="Subject name">
              <input
                className={INPUT}
                value={subjectForm.subjectName}
                onChange={(e) => setSubjectForm({ ...subjectForm, subjectName: e.target.value })}
                placeholder="e.g. Bangla 1st Paper"
              />
            </Field>
            <Field label="Board stream">
              <SearchSelect
                options={STREAM_OPTIONS}
                value={subjectForm.boardStream}
                onChange={(val) => setSubjectForm({ ...subjectForm, boardStream: val })}
                placeholder="Select stream"
                isClearable={false}
                ariaLabel="Board stream"
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Modal: Section / Batch */}
      {sectionForm && (
        <Modal
          title={sectionForm.id ? "Edit section / batch" : "New section / batch"}
          onClose={() => setSectionForm(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setSectionForm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_MODAL_PRIMARY}
                onClick={() => void saveSection()}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save section"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Section / batch name">
              <input
                className={INPUT}
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                placeholder="e.g. Section A or Morning Batch"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Code (unique UPPERCASE)">
                <input
                  className={INPUT}
                  value={sectionForm.code}
                  onChange={(e) => setSectionForm({ ...sectionForm, code: e.target.value })}
                  placeholder="e.g. SEC-A"
                />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  className={INPUT}
                  value={sectionForm.displayOrder}
                  onChange={(e) => setSectionForm({ ...sectionForm, displayOrder: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Description (optional)">
              <input
                className={INPUT}
                value={sectionForm.description}
                onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                placeholder="e.g. Section A — 30 students"
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-ink-700">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={sectionForm.isActive}
                onChange={(e) => setSectionForm({ ...sectionForm, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>
        </Modal>
      )}

      {/* Modal: Group */}
      {groupForm && (
        <Modal
          title={groupForm.id ? "Edit group" : "New group"}
          onClose={() => setGroupForm(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setGroupForm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_MODAL_PRIMARY}
                onClick={() => void saveGroup()}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save group"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Group name">
              <input
                className={INPUT}
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g. Science or Humanities"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Code (unique UPPERCASE)">
                <input
                  className={INPUT}
                  value={groupForm.code}
                  onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })}
                  placeholder="e.g. SCI"
                />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  className={INPUT}
                  value={groupForm.displayOrder}
                  onChange={(e) => setGroupForm({ ...groupForm, displayOrder: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Description (optional)">
              <input
                className={INPUT}
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="e.g. Science group — Physics, Chemistry, Biology"
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-ink-700">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={groupForm.isActive}
                onChange={(e) => setGroupForm({ ...groupForm, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
