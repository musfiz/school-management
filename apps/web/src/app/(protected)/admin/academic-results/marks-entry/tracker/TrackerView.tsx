"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, Search } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { toast } from "@/lib/swal";
import {
  fmt2,
  getAnalytics,
  getComponentReport,
  getMarksSheet,
  type Analytics,
  type ComponentReport,
  type SyllabusRow,
} from "@/lib/academic-results";
import {
  ActionCell,
  BTN,
  BTN_ROW,
  EmptyRow,
  FilterCard,
  KpiTile,
  RoleBadge,
  ScopeSelect,
  TableWrap,
  useCascadingScope,
  useSyllabus,
  useTerms,
  termOptions,
} from "../../_components/shared";

interface Check {
  students: number;
  components: number;
  expected: number;
  entered: number;
  missing: number;
  completion: number;
  status: "COMPLETE" | "PARTIAL" | "NOT_STARTED";
}

const STATUS_CLASS: Record<Check["status"], string> = {
  COMPLETE: "bg-emerald-100 text-emerald-800",
  PARTIAL: "bg-sky-100 text-sky-800",
  NOT_STARTED: "bg-slate-100 text-slate-800",
};

const MARKABLE_STATUSES = ["SETUP", "MARKS_ENTRY", "PROCESSING", "PUBLISHED", "LOCKED"];

export default function TrackerView() {
  const { sessionId, setSessionId, classId, setClassId, sectionId, setSectionId, sessions, classes, sections } =
    useCascadingScope({ includeSection: true });
  const [termId, setTermId] = useState("");
  const { terms } = useTerms(sessionId, classId);
  const { subjects } = useSyllabus(sessionId, classId);

  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [report, setReport] = useState<ComponentReport | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const selectableTerms = useMemo(() => terms.filter((term) => MARKABLE_STATUSES.includes(term.status)), [terms]);

  useEffect(() => {
    if (!termId) {
      setReport(null);
      setAnalytics(null);
      return;
    }
    void (async () => {
      try {
        setReport(await getComponentReport(termId));
      } catch {
        setReport(null);
      }
      try {
        setAnalytics(await getAnalytics(termId));
      } catch {
        setAnalytics(null);
      }
    })();
  }, [termId]);

  const checkOne = useCallback(
    async (subject: SyllabusRow): Promise<Check> => {
      const sheet = await getMarksSheet({
        examTermId: termId,
        syllabusSubjectId: subject.id,
        ...(sectionId ? { sectionOrBatchId: sectionId } : {}),
      });
      const editableComponents = sheet.components.filter((component) => component.editable);
      const expected = sheet.rows.length * editableComponents.length;
      let entered = 0;
      for (const row of sheet.rows) {
        for (const component of editableComponents) {
          const cell = row.marks?.[component.id];
          if (cell && (cell.isAbsent || cell.isExempted || Number(cell.rawMarksObtained) > 0)) entered += 1;
        }
      }
      const missing = Math.max(0, expected - entered);
      const completion = expected ? Math.round((entered / expected) * 100) : 0;
      const status: Check["status"] = expected === 0 ? "NOT_STARTED" : missing === 0 ? "COMPLETE" : entered === 0 ? "NOT_STARTED" : "PARTIAL";
      return { students: sheet.rows.length, components: editableComponents.length, expected, entered, missing, completion, status };
    },
    [termId, sectionId],
  );

  const checkSubject = async (subject: SyllabusRow) => {
    if (!termId) {
      toast("Pick an exam term first", "error");
      return;
    }
    setLoading(true);
    try {
      const check = await checkOne(subject);
      setChecks((current) => ({ ...current, [subject.id]: check }));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not check the subject", "error");
    } finally {
      setLoading(false);
    }
  };

  const checkAll = async () => {
    if (!termId || !subjects.length) return;
    setLoading(true);
    setProgress({ done: 0, total: subjects.length });
    const next: Record<string, Check> = {};
    for (let index = 0; index < subjects.length; index += 1) {
      try {
        next[subjects[index].id] = await checkOne(subjects[index]);
      } catch (error) {
        toast(error instanceof Error ? error.message : `Could not check ${subjects[index].subjectCode ?? subjects[index].id}`, "error");
      }
      setProgress({ done: index + 1, total: subjects.length });
      setChecks({ ...next });
    }
    setProgress(null);
    setLoading(false);
  };

  const totals = useMemo(() => {
    const values = Object.values(checks);
    const expected = values.reduce((sum, check) => sum + check.expected, 0);
    const entered = values.reduce((sum, check) => sum + check.entered, 0);
    return {
      checked: values.length,
      expected,
      entered,
      missing: values.reduce((sum, check) => sum + check.missing, 0),
      completion: expected ? Math.round((entered / expected) * 100) : 0,
      complete: values.filter((check) => check.status === "COMPLETE").length,
    };
  }, [checks]);

  const reportBySubject = useMemo(() => {
    const map = new Map<string, { valid: boolean; issues: string[] }>();
    for (const subject of report?.subjects ?? []) {
      map.set(subject.syllabusSubjectId, { valid: subject.valid, issues: subject.issues });
    }
    return map;
  }, [report]);

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Marks Entry Tracker"
        description="Spec §PHASE 4 — per-subject submission completion, CC-17 readiness and teacher attribution before the result is generated."
      />

      <FilterCard title="Filter tracker">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" isClearable={false} />
        <ScopeSelect label="Exam Term" value={termId} onChange={setTermId} options={termOptions(selectableTerms)} placeholder="Select term" isClearable={false} />
        <ScopeSelect label="Section / Batch" value={sectionId} onChange={setSectionId} options={sections} placeholder="All sections" />
        <ActionCell>
          <button type="button" className={BTN} onClick={() => setChecks({})} disabled={!Object.keys(checks).length}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reset checks
          </button>
          <button type="button" className={BTN} onClick={() => void checkAll()} disabled={!termId || loading || !subjects.length}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {progress ? `Checking ${progress.done}/${progress.total}…` : "Check all subjects"}
          </button>
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiTile label="Checked subjects" value={`${totals.checked}/${subjects.length}`} />
        <KpiTile label="Complete" value={String(totals.complete)} tone="emerald" />
        <KpiTile label="Expected cells" value={String(totals.expected)} />
        <KpiTile label="Missing cells" value={String(totals.missing)} tone={totals.missing ? "amber" : "ink"} />
        <KpiTile label="Completion" value={`${totals.completion}%`} tone="navy" />
      </div>

      <DashCard
        title="Subject submission status"
        action={
          <span className="text-[11px] text-ink-500">
            {loading && progress ? `Checking ${progress.done}/${progress.total}` : "Per-row checks load the marks sheet on demand"}
          </span>
        }
      >
        {!termId ? (
          <p className="py-6 text-center text-xs text-ink-400">Pick an exam term to track submissions.</p>
        ) : subjects.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-400">No syllabus subjects for this class.</p>
        ) : (
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Subject</th>
                  <th className="px-2.5 py-1.5 font-semibold">Role</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Components</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Students</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Entered</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Missing</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Completion</th>
                  <th className="px-2.5 py-1.5 font-semibold">CC-17</th>
                  <th className="px-2.5 py-1.5 font-semibold">Status</th>
                  <th className="px-2.5 py-1.5 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {subjects.map((subject) => {
                  const check = checks[subject.id];
                  const cc17 = reportBySubject.get(subject.id);
                  return (
                    <tr key={subject.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1">
                        <span className="font-mono text-ink-500">{subject.subjectCode ?? "—"}</span>
                        <span className="ml-1.5 font-medium">{subject.subjectName ?? "—"}</span>
                      </td>
                      <td className="px-2.5 py-1">
                        <RoleBadge role={subject.defaultSubjectRole} />
                      </td>
                      <td className="px-2.5 py-1 text-right font-mono">{check?.components ?? "—"}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{check?.students ?? "—"}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{check?.entered ?? "—"}</td>
                      <td className={`px-2.5 py-1 text-right font-mono ${check?.missing ? "text-rose-700" : ""}`}>
                        {check?.missing ?? "—"}
                      </td>
                      <td className="px-2.5 py-1 text-right font-mono">{check ? `${check.completion}%` : "—"}</td>
                      <td className="px-2.5 py-1">
                        {cc17 ? (
                          <span
                            className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${cc17.valid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                            title={cc17.issues.join(" · ") || "Component set sums to full marks"}
                          >
                            {cc17.valid ? "VALID" : "ISSUES"}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1">
                        {check ? (
                          <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[check.status]}`}>
                            {check.status.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="text-ink-400">NOT CHECKED</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1">
                        <button type="button" className={BTN_ROW} onClick={() => void checkSubject(subject)} disabled={loading}>
                          <Search className="h-3 w-3" />
                          Check
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-ink-300 bg-ink-100 font-semibold">
                <tr>
                  <td className="px-2.5 py-1.5" colSpan={3}>
                    Checked {totals.checked} of {subjects.length}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono" colSpan={2}>
                    {fmt2(totals.entered)} entered
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono text-rose-700">{fmt2(totals.missing)} missing</td>
                  <td className="px-2.5 py-1.5 text-right font-mono" colSpan={4}>
                    {totals.completion}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        )}
      </DashCard>

      <DashCard title="Marks entered by teacher">
        {loading && !analytics ? (
          <AdminPageLoader variant="inline" />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Subject</th>
                  <th className="px-2.5 py-1.5 font-semibold">Teacher</th>
                  <th className="px-2.5 py-1.5 font-semibold">Role</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Marks entered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {(analytics?.teachers.length ?? 0) === 0 ? (
                  <EmptyRow colSpan={4} message="No marks attributed yet for this term." />
                ) : (
                  analytics?.teachers.map((teacher) => (
                    <tr key={`${teacher.syllabusSubjectId}-${teacher.enteredBy}`} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-mono">{teacher.subjectCode ?? "—"}</td>
                      <td className="px-2.5 py-1">{teacher.teacherName ?? teacher.enteredBy.slice(0, 8)}</td>
                      <td className="px-2.5 py-1 text-ink-600">{teacher.teacherRole ?? "—"}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{teacher.marksEntered}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        )}
        <p className="mt-2 text-[11px] text-ink-500">
          Attribution comes from the <span className="font-mono">entered_by</span> column of each mark, so it is exact once marks exist.
        </p>
      </DashCard>
    </div>
  );
}
