"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { confirmDialog, toast } from "@/lib/swal";
import {
  PASS_EVALUATION_MODES,
  SUBJECT_ROLES,
  cloneSyllabus,
  createMasterSubject,
  deleteSyllabusRow,
  fmt2,
  listMasterSubjects,
  upsertSyllabusRow,
  validateSyllabus,
  type MasterSubject,
  type SyllabusRow,
  type SyllabusValidation,
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
  RoleBadge,
  ScopeSelect,
  TableWrap,
  useCascadingScope,
  useSyllabus,
} from "../../_components/shared";

interface RowForm {
  id: string;
  subjectId: string;
  defaultSubjectRole: string;
  combinedGroupCode: string;
  combinedGroupName: string;
  electiveGroup: string;
  creditHours: string;
  fullMarks: string;
  passEvaluationMode: string;
  displayOrder: string;
}

const ROLE_OPTIONS = SUBJECT_ROLES.map((role) => ({ value: role, label: role.replace(/_/g, " ") }));
const MODE_OPTIONS = PASS_EVALUATION_MODES.map((mode) => ({ value: mode, label: mode.replace(/_/g, " ") }));

const emptyForm = (subjectId = "", order = 1): RowForm => ({
  id: "",
  subjectId,
  defaultSubjectRole: "COMPULSORY",
  combinedGroupCode: "",
  combinedGroupName: "",
  electiveGroup: "",
  creditHours: "4.00",
  fullMarks: "100.00",
  passEvaluationMode: "SEPARATE_COMPONENTS",
  displayOrder: String(order),
});

export default function SyllabusMatrixView() {
  const { sessionId, setSessionId, classId, setClassId, sessions, classes, loading: scopesLoading } = useCascadingScope();
  const { subjects, loading, reload } = useSyllabus(sessionId, classId);

  const [validation, setValidation] = useState<SyllabusValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [masters, setMasters] = useState<MasterSubject[]>([]);
  const [form, setForm] = useState<RowForm | null>(null);
  const [newMaster, setNewMaster] = useState<{ convert: boolean; code: string; name: string; stream: string; paper: string } | null>(null);
  const [clone, setClone] = useState<{ convert: boolean; source: string; target: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setMasters(await listMasterSubjects());
      } catch {
        setMasters([]);
      }
    })();
  }, []);

  const subjectOptions = useMemo(
    () =>
      masters.map((master) => ({
        value: master.id,
        label: `${master.subjectCode} · ${master.subjectName}${master.paperNumber ? ` (paper ${master.paperNumber})` : ""}`,
      })),
    [masters],
  );
  const sessionOptions = sessions;
  const classOptions = classes;

  const runValidate = async () => {
    if (!sessionId || !classId) return;
    setValidating(true);
    try {
      setValidation(await validateSyllabus(sessionId, classId));
    } catch (error) {
      setValidation(null);
      toast(error instanceof Error ? error.message : "Validation failed", "error");
    } finally {
      setValidating(false);
    }
  };

  const openCreate = () => setForm(emptyForm("", subjects.length + 1));
  const openEdit = (row: SyllabusRow) =>
    setForm({
      id: row.id,
      subjectId: row.subjectId,
      defaultSubjectRole: row.defaultSubjectRole,
      combinedGroupCode: row.combinedGroupCode ?? "",
      combinedGroupName: row.combinedGroupName ?? "",
      electiveGroup: row.electiveGroup ?? "",
      creditHours: fmt2(row.creditHours),
      fullMarks: fmt2(row.fullMarks),
      passEvaluationMode: row.passEvaluationMode,
      displayOrder: String(row.displayOrder),
    });

  const saveRow = async () => {
    if (!form || !sessionId || !classId) return;
    if (!form.subjectId) {
      toast("Pick a master subject", "error");
      return;
    }
    setBusy(true);
    try {
      await upsertSyllabusRow({
        academicSessionId: sessionId,
        classOrDeptId: classId,
        subjectId: form.subjectId,
        defaultSubjectRole: form.defaultSubjectRole,
        combinedGroupCode: form.combinedGroupCode.trim() || null,
        combinedGroupName: form.combinedGroupName.trim() || null,
        electiveGroup: form.electiveGroup.trim() || null,
        creditHours: form.creditHours,
        fullMarks: form.fullMarks,
        passEvaluationMode: form.passEvaluationMode,
        displayOrder: Number(form.displayOrder) || 1,
      });
      toast(form.id ? "Syllabus row updated" : "Subject added to the matrix", "success");
      setForm(null);
      await reload();
      if (validation) await runValidate();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the row", "error");
    } finally {
      setBusy(false);
    }
  };

  const addMaster = async () => {
    if (!newMaster) return;
    if (!newMaster.code.trim() || !newMaster.name.trim()) {
      toast("Subject code and name are required", "error");
      return;
    }
    setBusy(true);
    try {
      const created = await createMasterSubject({
        subjectCode: newMaster.code.trim(),
        subjectName: newMaster.name.trim(),
        boardStream: newMaster.stream.trim() || undefined,
        paperNumber: newMaster.paper ? Number(newMaster.paper) : null,
      });
      setMasters((current) => [...current, created]);
      if (form) setForm({ ...form, subjectId: created.id });
      toast("Master subject created", "success");
      setNewMaster(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not create the subject", "error");
    } finally {
      setBusy(false);
    }
  };

  const runClone = async () => {
    if (!clone) return;
    if (!clone.source || !clone.target) {
      toast("Pick a source and target session", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await cloneSyllabus({
        sourceAcademicSessionId: clone.source,
        targetAcademicSessionId: clone.target,
        classOrDeptIds: classId ? [classId] : undefined,
      });
      toast(`Cloned ${result.cloned} row(s)${result.skipped ? `, skipped ${result.skipped}` : ""}`, "success");
      setClone(null);
      await reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Clone failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeRow = async (row: SyllabusRow) => {
    const ok = await confirmDialog({
      title: `Remove ${row.subjectName ?? "this subject"} from the syllabus?`,
      text: "Subjects already carrying marks or enrolments cannot be removed.",
      confirmText: "Remove row",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSyllabusRow(row.id);
      toast("Syllabus row removed", "success");
      await reload();
      if (validation) await runValidate();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not remove the row", "error");
    }
  };

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Syllabus & Paper Merge Matrix"
        description="Spec §PHASE 2 — class-wise subject roles, credits and the 1st/2nd paper merger that the engine later combines."
      />

      <FilterCard title="Filter syllabus">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessionOptions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classOptions} placeholder="Select class" isClearable={false} />
        <ActionCell>
          <button type="button" className={BTN} onClick={() => void reload()} disabled={!sessionId || !classId}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button type="button" className={BTN} onClick={() => void runValidate()} disabled={!sessionId || !classId || validating}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {validating ? "Validating…" : "Validate merge groups"}
          </button>
          <button type="button" className={BTN} onClick={() => setClone({ convert: true, source: "", target: sessionId })} disabled={!sessionId}>
            <Copy className="h-3.5 w-3.5" />
            Clone from session
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={openCreate} disabled={!sessionId || !classId}>
            <Plus className="h-3.5 w-3.5" />
            New subject row
          </button>
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Subjects" value={String(subjects.length)} />
        <KpiTile label="Compulsory" value={String(subjects.filter((row) => row.defaultSubjectRole === "COMPULSORY").length)} />
        <KpiTile label="Optional / elective" value={String(subjects.filter((row) => row.defaultSubjectRole !== "COMPULSORY").length)} tone="amber" />
        <KpiTile label="Merged groups" value={String(new Set(subjects.filter((row) => row.combinedGroupCode).map((row) => row.combinedGroupCode)).size)} tone="navy" />
      </div>

      <DashCard title="Subject matrix">
        {loading || scopesLoading ? (
          <AdminPageLoader variant="inline" />
        ) : !sessionId || !classId ? (
          <p className="py-6 text-center text-xs text-ink-400">Pick an academic session and class to load the syllabus.</p>
        ) : (
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Subject</th>
                  <th className="px-2.5 py-1.5 font-semibold">Role</th>
                  <th className="px-2.5 py-1.5 font-semibold">Combined group</th>
                  <th className="px-2.5 py-1.5 font-semibold">Elective</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Credit</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Full marks</th>
                  <th className="px-2.5 py-1.5 font-semibold">Pass mode</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Order</th>
                  <th className="px-2.5 py-1.5 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {subjects.length === 0 ? (
                  <EmptyRow colSpan={9} message="No subjects configured for this class yet." />
                ) : (
                  subjects.map((row) => (
                    <tr key={row.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1">
                        <span className="font-mono text-ink-500">{row.subjectCode ?? "—"}</span>
                        <span className="ml-1.5 font-medium">{row.subjectName ?? "—"}</span>
                      </td>
                      <td className="px-2.5 py-1">
                        <RoleBadge role={row.defaultSubjectRole} />
                      </td>
                      <td className="px-2.5 py-1">
                        {row.combinedGroupCode ? (
                          <span>
                            <span className="font-mono text-ink-500">{row.combinedGroupCode}</span>
                            <span className="ml-1.5">{row.combinedGroupName ?? ""}</span>
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1 text-ink-600">{row.electiveGroup ?? "—"}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{fmt2(row.creditHours)}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{fmt2(row.fullMarks)}</td>
                      <td className="px-2.5 py-1 text-ink-600">{row.passEvaluationMode.replace(/_/g, " ")}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{row.displayOrder}</td>
                      <td className="px-2.5 py-1">
                        <div className="flex items-center gap-1">
                          <button type="button" className={BTN_ROW} onClick={() => openEdit(row)}>
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button type="button" className={`${BTN_ROW} text-rose-700`} onClick={() => void removeRow(row)}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        )}
      </DashCard>

      {validation && (
        <DashCard
          title="Merge-group validation"
          action={
            validation.issues.length ? (
              <span className="text-xs font-semibold text-rose-700">{validation.issues.length} issue(s)</span>
            ) : (
              <span className="text-xs font-semibold text-emerald-700">All merge groups valid</span>
            )
          }
        >
          {validation.groups.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-400">No combined-paper groups configured for this class.</p>
          ) : (
            <TableWrap>
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 text-ink-700">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Group</th>
                    <th className="px-2.5 py-1.5 font-semibold">Name</th>
                    <th className="px-2.5 py-1.5 font-semibold">Pass mode</th>
                    <th className="px-2.5 py-1.5 font-semibold">Papers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {validation.groups.map((group) => (
                    <tr key={group.groupCode} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-mono">{group.groupCode}</td>
                      <td className="px-2.5 py-1">{group.combinedGroupName ?? "—"}</td>
                      <td className="px-2.5 py-1 text-ink-600">{group.passEvaluationMode.replace(/_/g, " ")}</td>
                      <td className="px-2.5 py-1">
                        {group.papers.map((paper) => `${paper.subjectCode}${paper.paperNumber ? ` (p${paper.paperNumber})` : ""}`).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
          {validation.issues.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-[11px] text-rose-700">
              {validation.issues.map((issue, index) => (
                <li key={`${issue.message}-${index}`}>• {issue.groupCode ? `[${issue.groupCode}] ` : ""}{issue.message}</li>
              ))}
            </ul>
          )}
        </DashCard>
      )}

      {form && (
        <Modal
          wide
          title={form.id ? "Edit syllabus row" : "Add subject to matrix"}
          onClose={() => setForm(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="button" className={BTN_MODAL_PRIMARY} onClick={() => void saveRow()} disabled={busy}>
                {busy ? "Saving…" : "Save row"}
              </button>
            </>
          }
        >
          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <ScopeSelect
                label="Master subject"
                value={form.subjectId}
                onChange={(value) => setForm({ ...form, subjectId: value })}
                options={subjectOptions}
                placeholder="Select a subject"
              />
            </div>
            <button
              type="button"
              className={BTN}
              onClick={() => setNewMaster({ convert: true, code: "", name: "", stream: "", paper: "" })}
            >
              <Plus className="h-3.5 w-3.5" />
              New master
            </button>
          </div>

          {newMaster && (
            <div className="mt-3 grid grid-cols-1 gap-2 rounded-xs border border-ink-200 bg-ink-50 p-3 sm:grid-cols-2">
              <Field label="Subject code">
                <input className={INPUT} value={newMaster.code} onChange={(e) => setNewMaster({ ...newMaster, code: e.target.value })} />
              </Field>
              <Field label="Subject name">
                <input className={INPUT} value={newMaster.name} onChange={(e) => setNewMaster({ ...newMaster, name: e.target.value })} />
              </Field>
              <Field label="Board stream">
                <input className={INPUT} value={newMaster.stream} onChange={(e) => setNewMaster({ ...newMaster, stream: e.target.value })} />
              </Field>
              <Field label="Paper number">
                <input className={INPUT} value={newMaster.paper} onChange={(e) => setNewMaster({ ...newMaster, paper: e.target.value })} />
              </Field>
              <div className="flex items-center gap-1.5 sm:col-span-2">
                <button type="button" className={BTN_PRIMARY} onClick={() => void addMaster()} disabled={busy}>
                  Create master subject
                </button>
                <button type="button" className={BTN} onClick={() => setNewMaster(null)}>
                  Hide
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ScopeSelect
              label="Subject role"
              value={form.defaultSubjectRole}
              onChange={(value) => setForm({ ...form, defaultSubjectRole: value })}
              options={ROLE_OPTIONS}
              placeholder="Select role"
              isClearable={false}
            />
            <ScopeSelect
              label="Pass evaluation mode"
              value={form.passEvaluationMode}
              onChange={(value) => setForm({ ...form, passEvaluationMode: value })}
              options={MODE_OPTIONS}
              placeholder="Select mode"
              isClearable={false}
            />
            <Field label="Combined group code">
              <input className={INPUT} value={form.combinedGroupCode} onChange={(e) => setForm({ ...form, combinedGroupCode: e.target.value })} placeholder="e.g. BANGLA_1-2" />
            </Field>
            <Field label="Combined group name">
              <input className={INPUT} value={form.combinedGroupName} onChange={(e) => setForm({ ...form, combinedGroupName: e.target.value })} />
            </Field>
            <Field label="Elective group">
              <input className={INPUT} value={form.electiveGroup} onChange={(e) => setForm({ ...form, electiveGroup: e.target.value })} />
            </Field>
            <Field label="Credit hours">
              <input className={INPUT} value={form.creditHours} onChange={(e) => setForm({ ...form, creditHours: e.target.value })} />
            </Field>
            <Field label="Full marks">
              <input className={INPUT} value={form.fullMarks} onChange={(e) => setForm({ ...form, fullMarks: e.target.value })} />
            </Field>
            <Field label="Display order">
              <input className={INPUT} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} />
            </Field>
          </div>
          {form.combinedGroupCode && (
            <p className="mt-2 text-[11px] text-ink-500">
              Every paper in a merged group should use <span className="font-semibold">COMBINED_PAPER_COMPONENTS</span> so the
              engine evaluates the combined total from the same component set.
            </p>
          )}
        </Modal>
      )}

      {clone && (
        <Modal
          title="Clone syllabus from another session"
          onClose={() => setClone(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setClone(null)}>
                Cancel
              </button>
              <button type="button" className={BTN_MODAL_PRIMARY} onClick={() => void runClone()} disabled={busy}>
                {busy ? "Cloning…" : "Clone rows"}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3">
            <ScopeSelect
              label="Source session"
              value={clone.source}
              onChange={(value) => setClone({ ...clone, source: value })}
              options={sessionOptions}
              placeholder="Select source session"
              isClearable={false}
            />
            <ScopeSelect
              label="Target session"
              value={clone.target}
              onChange={(value) => setClone({ ...clone, target: value })}
              options={sessionOptions}
              placeholder="Select target session"
              isClearable={false}
            />
            <p className="text-[11px] text-ink-500">
              Existing rows in the target are skipped. {classId ? "Only the currently selected class is cloned." : "All classes are cloned."}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
