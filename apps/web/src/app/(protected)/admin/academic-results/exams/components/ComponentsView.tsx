"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCopy as Copy, FiPlus as Plus, FiRefreshCcw as RefreshCw, FiSave as Save, FiTrash as Trash } from "react-icons/fi";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import { confirmDialog, toast } from "@/lib/swal";
import {
  COMPONENT_CODES,
  SOURCE_TYPES,
  bulkCopyComponents,
  deleteComponent,
  fmt2,
  getComponentReport,
  replaceSubjectComponents,
  type ComponentReport,
  type SubjectComponent,
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
  ScopeSelect,
  TableWrap,
  subjectOptions,
  termOptions,
  useCascadingScope,
  useSyllabus,
  useTerms,
} from "../../_components/shared";

interface EditComponent {
  id: string;
  componentCode: string;
  componentName: string;
  sourceType: string;
  sourceComponentCode: string;
  maxRawMarks: string;
  conversionWeightPct: string;
  minPassMarks: string;
  displayOrder: string;
}

const codeOptions = COMPONENT_CODES.map((code) => ({ value: code, label: code.replace(/_/g, " ") }));
const sourceOptions = SOURCE_TYPES.map((type) => ({ value: type, label: type.replace(/_/g, " ") }));

const blankRow = (order: number): EditComponent => ({
  id: "",
  componentCode: "CQ_WRITTEN",
  componentName: "CQ",
  sourceType: "MANUAL_ENTRY",
  sourceComponentCode: "",
  maxRawMarks: "100.00",
  conversionWeightPct: "100.00",
  minPassMarks: "0.00",
  displayOrder: String(order),
});

/** Same 2dp rule the API applies (CC-03): `round(raw × weight / 100, 2)`. */
const convertedMax = (raw: string, weight: string) => {
  const value = (Number(raw) || 0) * ((Number(weight) || 0) / 100);
  return Math.round(value * 100) / 100;
};

const toEdit = (component: SubjectComponent, order: number): EditComponent => ({
  id: component.id,
  componentCode: component.componentCode,
  componentName: component.componentName ?? "",
  sourceType: component.sourceType,
  sourceComponentCode: component.sourceComponentCode ?? "",
  maxRawMarks: fmt2(component.maxRawMarks),
  conversionWeightPct: fmt2(component.conversionWeightPct),
  minPassMarks: fmt2(component.minPassMarks),
  displayOrder: String(component.displayOrder || order),
});

export default function ComponentsView() {
  const { sessionId, setSessionId, classId, setClassId, sessions, classes } = useCascadingScope();
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const { terms } = useTerms(sessionId, classId);
  const { subjects } = useSyllabus(sessionId, classId);

  const [report, setReport] = useState<ComponentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EditComponent[]>([]);
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState<{ convert: boolean; source: string; targets: string[] } | null>(null);

  const loadReport = useCallback(async () => {
    if (!termId) {
      setReport(null);
      return;
    }
    setLoading(true);
    try {
      const data = await getComponentReport(termId);
      setReport(data);
      const preferred = subjectId && data.subjects.some((subject) => subject.syllabusSubjectId === subjectId)
        ? subjectId
        : (data.subjects.find((subject) => subject.configured)?.syllabusSubjectId ?? data.subjects[0]?.syllabusSubjectId ?? "");
      setSubjectId(preferred);
    } catch (error) {
      setReport(null);
      toast(error instanceof Error ? error.message : "Could not load the component report", "error");
    } finally {
      setLoading(false);
    }
  }, [termId, subjectId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const selected = useMemo(
    () => report?.subjects.find((subject) => subject.syllabusSubjectId === subjectId) ?? null,
    [report, subjectId],
  );

  useEffect(() => {
    setRows((selected?.components ?? []).map((component, index) => toEdit(component, index + 1)));
  }, [selected]);

  const rowSum = useMemo(
    () => rows.reduce((sum, row) => sum + convertedMax(row.maxRawMarks, row.conversionWeightPct), 0),
    [rows],
  );
  const fullMarks = Number(selected?.fullMarks ?? 0);

  const patch = (index: number, changes: Partial<EditComponent>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  const save = async () => {
    if (!termId || !subjectId) return;
    if (!rows.length) {
      toast("Add at least one component", "error");
      return;
    }
    setBusy(true);
    try {
      await replaceSubjectComponents(termId, {
        syllabusSubjectId: subjectId,
        components: rows.map((row) => ({
          componentCode: row.componentCode,
          componentName: row.componentName.trim() || undefined,
          sourceType: row.sourceType,
          sourceComponentCode: row.sourceType === "AUTO_FROM_SUB_EXAMS" ? row.sourceComponentCode.trim() || null : null,
          maxRawMarks: row.maxRawMarks,
          conversionWeightPct: row.conversionWeightPct,
          minPassMarks: row.minPassMarks,
          displayOrder: Number(row.displayOrder) || 1,
        })),
      });
      toast("Components saved", "success");
      const keep = subjectId;
      setSubjectId(keep);
      await loadReport();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the components", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeRow = async (component: SubjectComponent) => {
    const ok = await confirmDialog({
      title: `Delete the ${component.componentCode} component?`,
      text: "Marks already entered against this component must be cleared first.",
      confirmText: "Delete component",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteComponent(termId, component.id);
      toast("Component deleted", "success");
      await loadReport();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the component", "error");
    }
  };

  const runCopy = async () => {
    if (!copy || !termId) return;
    if (!copy.source || copy.targets.length === 0) {
      toast("Pick a source subject and at least one target", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await bulkCopyComponents(termId, {
        sourceSyllabusSubjectId: copy.source,
        targetSyllabusSubjectIds: copy.targets,
      });
      toast(`Copied components to ${result.copied} subject(s)`, "success");
      setCopy(null);
      await loadReport();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Copy failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Subject Components & CC-17 Gate"
        description="Spec §PHASE 3 — CQ / MCQ / practical / CT weight, pass marks and the converted-max sum rule that gates marks entry."
      />

      <FilterCard title="Filter subject components">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" isClearable={false} />
        <ScopeSelect label="Exam Term" value={termId} onChange={setTermId} options={termOptions(terms)} placeholder="Select term" isClearable={false} />
        <ScopeSelect label="Subject" value={subjectId} onChange={setSubjectId} options={subjectOptions(subjects)} placeholder="Select subject" isClearable={false} />
        <ActionCell>
          <button type="button" className={BTN} onClick={() => void loadReport()} disabled={!termId}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh report
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => setCopy({ convert: true, source: subjectId, targets: [] })}
            disabled={!termId || !selected?.configured}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy components to subjects
          </button>
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Subjects" value={String(report?.subjects.length ?? 0)} />
        <KpiTile label="Configured" value={String(report?.subjects.filter((subject) => subject.configured).length ?? 0)} />
        <KpiTile
          label="CC-17 valid"
          value={String(report?.subjects.filter((subject) => subject.configured && subject.valid).length ?? 0)}
          tone="emerald"
        />
        <KpiTile
          label="Needs attention"
          value={String(report?.subjects.filter((subject) => subject.configured && !subject.valid).length ?? 0)}
          tone="rose"
        />
      </div>

      <DashCard title="CC-17 component report">
        {loading ? (
          <AdminPageLoader variant="inline" />
        ) : !termId ? (
          <p className="py-6 text-center text-xs text-ink-400">Pick an exam term to validate its component distribution.</p>
        ) : (
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Subject</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Σ converted max</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Full marks</th>
                  <th className="px-2.5 py-1.5 font-semibold">Configured</th>
                  <th className="px-2.5 py-1.5 font-semibold">CC-17</th>
                  <th className="px-2.5 py-1.5 font-semibold">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {(report?.subjects.length ?? 0) === 0 ? (
                  <EmptyRow colSpan={6} message="No syllabus subjects for this class." />
                ) : (
                  report?.subjects.map((subject) => (
                    <tr
                      key={subject.syllabusSubjectId}
                      className={`cursor-pointer hover:bg-ink-50 ${subject.syllabusSubjectId === subjectId ? "bg-sky-50" : ""}`}
                      onClick={() => setSubjectId(subject.syllabusSubjectId)}
                    >
                      <td className="px-2.5 py-1">
                        <span className="font-mono text-ink-500">{subject.subjectCode ?? "—"}</span>
                        <span className="ml-1.5 font-medium">{subject.subjectName ?? "—"}</span>
                      </td>
                      <td className="px-2.5 py-1 text-right font-mono">{fmt2(subject.convertedMaxSum)}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{fmt2(subject.fullMarks)}</td>
                      <td className="px-2.5 py-1">
                        <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${subject.configured ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"}`}>
                          {subject.configured ? "YES" : "NO"}
                        </span>
                      </td>
                      <td className="px-2.5 py-1">
                        <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${subject.configured ? (subject.valid ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800") : "bg-slate-100 text-slate-700"}`}>
                          {subject.configured ? (subject.valid ? "VALID" : "BLOCKED") : "—"}
                        </span>
                      </td>
                      <td className="px-2.5 py-1 text-[11px] text-rose-700">
                        {subject.issues.length ? subject.issues.join(" · ") : <span className="text-ink-400">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        )}
      </DashCard>

      {selected && (
        <DashCard
          title={`Components — ${selected.subjectName ?? selected.subjectCode ?? "subject"}`}
          action={
            <div className="flex items-center gap-1.5">
              <button type="button" className={BTN} onClick={() => setRows([...rows, blankRow(rows.length + 1)])}>
                <Plus className="h-3.5 w-3.5" />
                Add component row
              </button>
              <button type="button" className={BTN_PRIMARY} onClick={() => void save()} disabled={busy}>
                <Save className="h-3.5 w-3.5" />
                {busy ? "Saving…" : "Save components"}
              </button>
            </div>
          }
        >
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Code</th>
                  <th className="px-2.5 py-1.5 font-semibold">Name</th>
                  <th className="px-2.5 py-1.5 font-semibold">Source</th>
                  <th className="px-2.5 py-1.5 font-semibold">Source code</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Max raw</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Weight %</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Converted max</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Min pass</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Order</th>
                  <th className="px-2.5 py-1.5 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {rows.length === 0 ? (
                  <EmptyRow colSpan={10} message="No components configured — add a row to start." />
                ) : (
                  rows.map((row, index) => {
                    const computed = convertedMax(row.maxRawMarks, row.conversionWeightPct);
                    return (
                      <tr key={row.id || index} className="hover:bg-ink-50">
                        <td className="px-1.5 py-1">
                          <SearchSelect
                            value={row.componentCode}
                            onChange={(value) => patch(index, { componentCode: value })}
                            options={codeOptions}
                            placeholder="Code"
                            isClearable={false}
                            ariaLabel="Component code"
                          />
                        </td>
                        <td className="px-1.5 py-1">
                          <input className={INPUT} value={row.componentName} onChange={(e) => patch(index, { componentName: e.target.value })} />
                        </td>
                        <td className="px-1.5 py-1">
                          <SearchSelect
                            value={row.sourceType}
                            onChange={(value) => patch(index, { sourceType: value })}
                            options={sourceOptions}
                            placeholder="Source"
                            isClearable={false}
                            ariaLabel="Component source"
                          />
                        </td>
                        <td className="px-1.5 py-1">
                          <input
                            className={INPUT}
                            value={row.sourceComponentCode}
                            disabled={row.sourceType !== "AUTO_FROM_SUB_EXAMS"}
                            onChange={(e) => patch(index, { sourceComponentCode: e.target.value })}
                            placeholder={row.sourceType === "AUTO_FROM_SUB_EXAMS" ? "e.g. CQ_WRITTEN" : "—"}
                          />
                        </td>
                        <td className="px-1.5 py-1">
                          <input className={`${INPUT} text-right font-mono`} value={row.maxRawMarks} onChange={(e) => patch(index, { maxRawMarks: e.target.value })} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input
                            className={`${INPUT} text-right font-mono`}
                            value={row.conversionWeightPct}
                            onChange={(e) => patch(index, { conversionWeightPct: e.target.value })}
                          />
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono">{fmt2(computed)}</td>
                        <td className="px-1.5 py-1">
                          <input className={`${INPUT} text-right font-mono`} value={row.minPassMarks} onChange={(e) => patch(index, { minPassMarks: e.target.value })} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input className={`${INPUT} text-right font-mono`} value={row.displayOrder} onChange={(e) => patch(index, { displayOrder: e.target.value })} />
                        </td>
                        <td className="px-1.5 py-1">
                          <div className="flex items-center gap-1">
                            {row.id && (
                              <button
                                type="button"
                                className={`${BTN_ROW} text-rose-700`}
                                onClick={() => {
                                  const match = selected.components.find((component) => component.id === row.id);
                                  if (match) void removeRow(match);
                                }}
                              >
                                <Trash className="h-3 w-3" />
                              </button>
                            )}
                            <button type="button" className={BTN_ROW} onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                              Clear
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-ink-300 bg-ink-100 font-semibold">
                <tr>
                  <td className="px-2.5 py-1.5" colSpan={6}>
                    Σ converted max (live)
                  </td>
                  <td className={`px-2.5 py-1.5 text-right font-mono ${rowSum === fullMarks ? "text-emerald-700" : "text-amber-700"}`}>
                    {fmt2(rowSum)}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono" colSpan={3}>
                    target {fmt2(fullMarks)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
          {rowSum !== fullMarks ? (
            <p className="mt-2 text-[11px] text-amber-700">
              CC-17: the converted-max sum must equal the subject full marks before marks entry opens.
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-emerald-700">CC-17 satisfied — the component set sums to full marks.</p>
          )}
          <p className="mt-1 text-[11px] text-ink-500">
            Converted max is computed server-side as <span className="font-mono">round(max_raw × weight ÷ 100, 2)</span> and shown live here.
          </p>
        </DashCard>
      )}

      {copy && (
        <Modal
          title="Copy components to subjects"
          onClose={() => setCopy(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setCopy(null)}>
                Cancel
              </button>
              <button type="button" className={BTN_MODAL_PRIMARY} onClick={() => void runCopy()} disabled={busy}>
                {busy ? "Copying…" : "Copy components"}
              </button>
            </>
          }
        >
          <ScopeSelect
            label="Source subject"
            value={copy.source}
            onChange={(value) => setCopy({ ...copy, source: value })}
            options={subjectOptions(subjects)}
            placeholder="Select source"
            isClearable={false}
          />
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-ink-700">Target subjects</p>
            <div className="max-h-56 overflow-y-auto rounded-xs border border-ink-200 p-2">
              {subjects.map((subject) => (
                <label key={subject.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-ink-700">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={copy.targets.includes(subject.id)}
                    onChange={(event) =>
                      setCopy({
                        ...copy,
                        targets: event.target.checked
                          ? [...copy.targets, subject.id]
                          : copy.targets.filter((id) => id !== subject.id),
                      })
                    }
                  />
                  <span className="font-mono text-ink-500">{subject.subjectCode}</span>
                  {subject.subjectName}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-500">Targets are replaced, not merged — their existing component sets are overwritten.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
