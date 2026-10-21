"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FiAlertCircle as AlertCircle, FiArrowRight as ArrowRight, FiDownload as Download, FiRefreshCcw as RefreshCw, FiSave as Save } from "react-icons/fi";
import { RiSparklingLine as Sparkles } from "react-icons/ri";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { toast } from "@/lib/swal";
import {
  autoPopulateMarks,
  bulkSaveMarks,
  downloadCsv,
  fmt2,
  getMarksSheet,
  listExamTermTypes,
  type ExamTermType,
  type MarksSheet,
  type SheetRow,
} from "@/lib/academic-results";
import {
  ActionCell,
  BTN,
  BTN_PRIMARY,
  EmptyRow,
  FilterCard,
  INPUT,
  KpiTile,
  ScopeSelect,
  TableWrap,
  subjectOptions,
  termOptions,
  useCascadingScope,
  useSyllabus,
  useTerms,
} from "../_components/shared";

interface CellEdit {
  raw: string;
  isAbsent: boolean;
  isExempted: boolean;
}

/** `round(raw × weight / 100, 2)` — mirrors CC-03 so the preview is exact. */
const converted = (raw: string, weightPct: string) => {
  const value = (Number(raw) || 0) * ((Number(weightPct) || 0) / 100);
  return Math.round(value * 100) / 100;
};

const MARKABLE_STATUSES = ["SETUP", "MARKS_ENTRY"];

export default function MarksEntryView() {
  const { sessionId, setSessionId, classId, setClassId, sectionId, setSectionId, sessions, classes, sections } =
    useCascadingScope({ includeSection: true });
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [termTypeFilter, setTermTypeFilter] = useState("");
  const [termTypes, setTermTypes] = useState<ExamTermType[]>([]);

  const { terms } = useTerms(sessionId, classId);
  const { subjects } = useSyllabus(sessionId, classId);

  const [sheet, setSheet] = useState<MarksSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, CellEdit>>({});
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null);

  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    void (async () => {
      try {
        setTermTypes(await listExamTermTypes());
      } catch {
        setTermTypes([]);
      }
    })();
  }, []);

  const termTypeOptions = useMemo(
    () => termTypes.map((t) => ({ value: t.code, label: `${t.name} (${t.engineBehavior})` })),
    [termTypes],
  );

  const filteredTerms = useMemo(() => {
    if (!termTypeFilter) return terms;
    return terms.filter((term) => term.termType === termTypeFilter);
  }, [terms, termTypeFilter]);

  const termChoiceOptions = useMemo(() => {
    return filteredTerms.map((term) => {
      const isMarkable = MARKABLE_STATUSES.includes(term.status);
      return {
        value: term.id,
        label: `${term.termName} · ${term.termType} · ${term.status}${isMarkable ? "" : " (read-only)"}`,
      };
    });
  }, [filteredTerms]);

  const load = useCallback(async () => {
    if (!termId || !subjectId) {
      setSheet(null);
      return;
    }
    setLoading(true);
    try {
      const data = await getMarksSheet({
        examTermId: termId,
        syllabusSubjectId: subjectId,
        ...(sectionId ? { sectionOrBatchId: sectionId } : {}),
      });
      setSheet(data);
      setEdits({});
      setFocus(null);
    } catch (error) {
      setSheet(null);
      toast(error instanceof Error ? error.message : "Could not load the marks sheet", "error");
    } finally {
      setLoading(false);
    }
  }, [termId, subjectId, sectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const components = sheet?.components ?? [];
  const rows: SheetRow[] = sheet?.rows ?? [];

  const original = useCallback(
    (row: SheetRow, componentId: string) => row.marks?.[componentId] ?? null,
    [],
  );
  const valueOf = useCallback(
    (row: SheetRow, componentId: string): CellEdit => {
      const key = `${row.studentId}:${componentId}`;
      const edited = edits[key];
      if (edited) return edited;
      const source = original(row, componentId);
      return {
        raw: source ? fmt2(source.rawMarksObtained) : "",
        isAbsent: Boolean(source?.isAbsent),
        isExempted: Boolean(source?.isExempted),
      };
    },
    [edits, original],
  );

  const cellInvalid = useCallback(
    (row: SheetRow, componentId: string, max: string) => {
      const value = valueOf(row, componentId);
      if (value.isAbsent || value.isExempted) return false;
      if (value.raw.trim() === "") return false;
      const num = Number(value.raw);
      if (!Number.isFinite(num)) return true;
      if (num < 0) return true;
      return num > Number(max);
    },
    [valueOf],
  );

  const invalidCells = useMemo(() => {
    if (!sheet) return [] as { studentId: string; componentId: string }[];
    const found: { studentId: string; componentId: string }[] = [];
    for (const row of rows) {
      for (const component of components) {
        if (!component.editable || !row.editable || !sheet.editable) continue;
        if (cellInvalid(row, component.id, component.maxRawMarks)) {
          found.push({ studentId: row.studentId, componentId: component.id });
        }
      }
    }
    return found;
  }, [sheet, rows, components, cellInvalid]);

  const enteredCount = useMemo(() => {
    let count = 0;
    for (const row of rows) {
      for (const component of components) {
        const value = valueOf(row, component.id);
        if (value.isAbsent || value.isExempted || value.raw.trim() !== "") count += 1;
      }
    }
    return count;
  }, [rows, components, valueOf]);

  const isEditable = useCallback(
    (rowIndex: number, colIndex: number) =>
      Boolean(sheet?.editable) && Boolean(components[colIndex]?.editable) && Boolean(rows[rowIndex]?.editable),
    [sheet, components, rows],
  );

  const focusCell = useCallback((rowIndex: number, colIndex: number) => {
    const ref = refs.current[`${rowIndex}:${colIndex}`];
    if (!ref) return;
    ref.focus();
    ref.select();
    setFocus({ row: rowIndex, col: colIndex });
  }, []);

  const step = useCallback(
    (rowIndex: number, colIndex: number, rowDelta: number, colDelta: number) => {
      let r = rowIndex + rowDelta;
      let c = colIndex + colDelta;
      while (r >= 0 && r < rows.length && c >= 0 && c < components.length) {
        if (isEditable(r, c)) {
          focusCell(r, c);
          return;
        }
        r += rowDelta;
        c += colDelta;
      }
    },
    [rows.length, components.length, isEditable, focusCell],
  );

  const patch = (row: SheetRow, componentId: string, changes: Partial<CellEdit>) => {
    const key = `${row.studentId}:${componentId}`;
    setEdits((current) => ({ ...current, [key]: { ...valueOf(row, componentId), ...changes } }));
  };

  const onKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
    row: SheetRow,
    componentId: string,
  ) => {
    const input = event.currentTarget;
    const key = event.key;
    if (key === "ArrowDown" || key === "Enter") {
      event.preventDefault();
      step(rowIndex, colIndex, 1, 0);
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      step(rowIndex, colIndex, -1, 0);
      return;
    }
    if (key === "ArrowRight" && input.selectionStart === input.value.length) {
      event.preventDefault();
      step(rowIndex, colIndex, 0, 1);
      return;
    }
    if (key === "ArrowLeft" && input.selectionStart === 0) {
      event.preventDefault();
      step(rowIndex, colIndex, 0, -1);
      return;
    }
    if (key === "a" || key === "A") {
      event.preventDefault();
      const current = valueOf(row, componentId);
      patch(row, componentId, { isAbsent: !current.isAbsent, isExempted: false });
      return;
    }
    if (key === "e" || key === "E") {
      event.preventDefault();
      const current = valueOf(row, componentId);
      patch(row, componentId, { isExempted: !current.isExempted, isAbsent: false });
    }
  };

  const save = async () => {
    if (!sheet || !termId || !subjectId) return;
    if (invalidCells.length) {
      toast(`${invalidCells.length} cell(s) exceed the component maximum — fix them before saving`, "error");
      return;
    }
    const payload = Object.entries(edits).map(([key, value]) => {
      const [studentId, componentId] = key.split(":");
      return {
        studentId,
        componentId,
        rawMarksObtained: value.isAbsent || value.isExempted ? "0.00" : value.raw.trim() === "" ? "0.00" : value.raw,
        isAbsent: value.isAbsent,
        isExempted: value.isExempted,
      };
    });
    if (!payload.length) {
      toast("No changes to save", "info");
      return;
    }
    setBusy(true);
    try {
      const result = await bulkSaveMarks({ examTermId: termId, syllabusSubjectId: subjectId, rows: payload });
      toast(`Saved ${result.saved} mark(s) across ${result.students} student(s)`, "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the marks", "error");
    } finally {
      setBusy(false);
    }
  };

  const autoPopulate = async () => {
    if (!termId || !subjectId) return;
    setBusy(true);
    try {
      const result = await autoPopulateMarks({ examTermId: termId, syllabusSubjectId: subjectId });
      toast(
        result.message ?? `Auto-populated ${result.updated} mark(s) from ${result.components} component(s)`,
        result.gaps?.length ? "warning" : "success",
      );
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Auto-populate failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (!sheet) return;
    const headers = ["Roll", "Student", ...components.map((component) => component.componentCode), "Converted total"];
    const body = rows.map((row) => [
      row.classRollNo ?? "",
      row.fullNameEn ?? row.studentId,
      ...components.map((component) => {
        const value = valueOf(row, component.id);
        if (value.isExempted) return "E";
        if (value.isAbsent) return "A";
        return value.raw;
      }),
      fmt2(row.convertedTotal),
    ]);
    downloadCsv(`marks-${sheet.subject.subjectCode ?? "subject"}.csv`, headers, body);
  };

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Marks Entry Grid"
        description="Spec §PHASE 4 — keyboard-first roster × component sheet. Arrows move, Enter goes down, A marks absent, E exempts; over-max cells block the save."
      />

      <FilterCard title="Filter marks sheet">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" isClearable={false} />
        {termTypeOptions.length > 0 && (
          <ScopeSelect label="Term Type (filter)" value={termTypeFilter} onChange={setTermTypeFilter} options={termTypeOptions} placeholder="All term types" />
        )}
        <ScopeSelect label="Exam Term" value={termId} onChange={setTermId} options={termChoiceOptions} placeholder={filteredTerms.length ? "Select exam term" : "No terms found"} isClearable={false} />
        <ScopeSelect label="Section / Batch" value={sectionId} onChange={setSectionId} options={sections} placeholder="All sections" />
        <ScopeSelect label="Subject" value={subjectId} onChange={setSubjectId} options={subjectOptions(subjects)} placeholder={subjects.length ? "Select subject" : "No subjects found"} isClearable={false} />
        <ActionCell>
          <button type="button" className={BTN} onClick={() => void load()} disabled={!termId || !subjectId}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button type="button" className={BTN} onClick={() => void autoPopulate()} disabled={!termId || !subjectId || busy}>
            <Sparkles className="h-3.5 w-3.5" />
            Auto-populate
          </button>
          <button type="button" className={BTN} onClick={exportCsv} disabled={!sheet}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => void save()}
            disabled={!sheet || busy || invalidCells.length > 0 || Object.keys(edits).length === 0}
            title={invalidCells.length ? `${invalidCells.length} invalid cell(s)` : undefined}
          >
            <Save className="h-3.5 w-3.5" />
            {busy ? "Saving…" : `Save all${invalidCells.length ? ` (${invalidCells.length} invalid)` : ""}`}
          </button>
        </ActionCell>
      </FilterCard>

      {sessionId && classId && terms.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xs border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-semibold">No Exam Terms Found for this Class</p>
            <p>Before entering marks, create an Exam Term (e.g. Half-Yearly, Final) for this academic session and class.</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                href="/admin/academic-results/exams"
                className="inline-flex items-center gap-1 font-semibold text-brand-700 underline hover:text-brand-800"
              >
                Create Exam Term <ArrowRight className="h-3 w-3" />
              </Link>
              <span className="text-amber-400">·</span>
              <Link
                href="/admin/academic-results/settings/term-types"
                className="inline-flex items-center gap-1 font-semibold text-brand-700 underline hover:text-brand-800"
              >
                Manage Term Types <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {sessionId && classId && subjects.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xs border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div className="space-y-1">
            <p className="font-semibold">No Subjects in Syllabus for this Class</p>
            <p>This class does not have subjects mapped to its syllabus yet. Add subjects in Syllabus Matrix.</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                href="/admin/academic-results/settings/syllabus-matrix"
                className="inline-flex items-center gap-1 font-semibold text-brand-700 underline hover:text-brand-800"
              >
                Configure Syllabus Matrix <ArrowRight className="h-3 w-3" />
              </Link>
              <span className="text-sky-400">·</span>
              <Link
                href="/admin/academic-results/settings/subjects"
                className="inline-flex items-center gap-1 font-semibold text-brand-700 underline hover:text-brand-800"
              >
                Master Subjects Catalogue <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiTile label="Students" value={String(rows.length)} />
        <KpiTile label="Components" value={String(components.filter((component) => component.editable).length)} />
        <KpiTile label="Entered cells" value={String(enteredCount)} tone="emerald" />
        <KpiTile
          label="Pending edits"
          value={String(Object.keys(edits).length)}
          tone={Object.keys(edits).length ? "amber" : "ink"}
        />
        <KpiTile label="Invalid cells" value={String(invalidCells.length)} tone={invalidCells.length ? "rose" : "ink"} />
      </div>

      <DashCard
        title={sheet ? `${sheet.subject.subjectName ?? sheet.subject.subjectCode ?? "Subject"} — ${sheet.term.termName}` : "Marks sheet"}
        action={
          sheet ? (
            <span className="text-[11px] text-ink-500">
              Roster: {sheet.rosterSource.replace(/_/g, " ").toLowerCase()} · {sheet.editable ? "editable" : "read-only"}
            </span>
          ) : null
        }
      >
        {loading ? (
          <AdminPageLoader variant="inline" />
        ) : !termId || !subjectId ? (
          <p className="py-6 text-center text-xs text-ink-400">Pick an open exam term and a subject to load the sheet.</p>
        ) : !sheet || rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-400">
            No students on this roster. Enrol the class (or check the section filter) first.
          </p>
        ) : (
          <>
            <TableWrap>
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 text-ink-700">
                  <tr>
                    <th className="whitespace-nowrap px-2.5 py-1.5 font-semibold">Roll</th>
                    <th className="whitespace-nowrap px-2.5 py-1.5 font-semibold">Student</th>
                    {components.map((component) => (
                      <th key={component.id} className="whitespace-nowrap px-2.5 py-1.5 text-right font-semibold">
                        {component.componentName ?? component.componentCode}
                        <span className="ml-1 text-[10px] font-normal text-ink-500">
                          /{fmt2(component.maxRawMarks)} ×{fmt2(component.conversionWeightPct)}%
                        </span>
                        {!component.editable && <span className="ml-1 text-[10px] font-normal text-ink-400">auto</span>}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-2.5 py-1.5 text-right font-semibold">Converted total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {rows.map((row, rowIndex) => (
                    <tr key={row.studentId} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-mono">{row.classRollNo ?? "—"}</td>
                      <td className="whitespace-nowrap px-2.5 py-1">
                        {row.fullNameEn ?? row.studentId}
                        {row.attendance?.attendancePercentage !== undefined && (
                          <span className="ml-1.5 text-[10px] text-ink-500">
                            att {fmt2(row.attendance?.attendancePercentage)}%
                          </span>
                        )}
                      </td>
                      {components.map((component, colIndex) => {
                        const editable = sheet.editable && component.editable && row.editable;
                        const value = valueOf(row, component.id);
                        const invalid = editable && cellInvalid(row, component.id, component.maxRawMarks);
                        const preview = converted(value.raw, component.conversionWeightPct);
                        if (!editable) {
                          const stored = original(row, component.id);
                          return (
                            <td key={component.id} className="px-2.5 py-1 text-right font-mono text-ink-500">
                              {stored ? fmt2(stored.convertedMarks) : "—"}
                            </td>
                          );
                        }
                        const focused = focus?.row === rowIndex && focus?.col === colIndex;
                        return (
                          <td
                            key={component.id}
                            className={`px-1.5 py-1 align-top ${value.isAbsent ? "bg-rose-50" : value.isExempted ? "bg-sky-50" : ""}`}
                          >
                            <input
                              ref={(element) => {
                                refs.current[`${rowIndex}:${colIndex}`] = element;
                              }}
                              className={`${INPUT} text-right font-mono ${
                                invalid ? "border-rose-400" : focused ? "border-brand-400" : ""
                              } ${value.isAbsent || value.isExempted ? "text-ink-400" : ""}`}
                              value={value.isAbsent ? "A" : value.isExempted ? "E" : value.raw}
                              readOnly={value.isAbsent || value.isExempted}
                              inputMode="decimal"
                              title={invalid ? `Exceeds max raw ${fmt2(component.maxRawMarks)}` : `converted ${fmt2(preview)}`}
                              onFocus={() => setFocus({ row: rowIndex, col: colIndex })}
                              onChange={(event) =>
                                patch(row, component.id, { raw: event.target.value, isAbsent: false, isExempted: false })
                              }
                              onKeyDown={(event) => onKeyDown(event, rowIndex, colIndex, row, component.id)}
                            />
                            <p className={`mt-0.5 text-right text-[10px] ${invalid ? "text-rose-700" : "text-ink-400"}`}>
                              {value.isAbsent ? "absent" : value.isExempted ? "exempt" : fmt2(preview)}
                            </p>
                          </td>
                        );
                      })}
                      <td className="px-2.5 py-1 text-right font-mono font-semibold">{fmt2(row.convertedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-[11px] text-ink-500">
              Keyboard: <span className="font-mono">↑↓←→</span> move · <span className="font-mono">Enter</span> next row ·{" "}
              <span className="font-mono">Tab</span> next cell · <span className="font-mono">A</span> absent ·{" "}
              <span className="font-mono">E</span> exempt. Radix: <span className="font-mono">converted = round(raw × weight ÷ 100, 2)</span>.
            </p>
          </>
        )}
      </DashCard>

      {sheet && invalidCells.length > 0 && (
        <DashCard title="Blocked cells">
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Roll</th>
                  <th className="px-2.5 py-1.5 font-semibold">Component</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Entered</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {invalidCells.length === 0 ? (
                  <EmptyRow colSpan={4} />
                ) : (
                  invalidCells.map((cell) => {
                    const row = rows.find((item) => item.studentId === cell.studentId);
                    const component = components.find((item) => item.id === cell.componentId);
                    if (!row || !component) return null;
                    return (
                      <tr key={`${cell.studentId}-${cell.componentId}`} className="hover:bg-ink-50">
                        <td className="px-2.5 py-1 font-mono">{row.classRollNo ?? "—"}</td>
                        <td className="px-2.5 py-1">{component.componentName ?? component.componentCode}</td>
                        <td className="px-2.5 py-1 text-right font-mono text-rose-700">{valueOf(row, component.id).raw}</td>
                        <td className="px-2.5 py-1 text-right font-mono">{fmt2(component.maxRawMarks)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableWrap>
        </DashCard>
      )}
    </div>
  );
}
