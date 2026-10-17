"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import PrintMenu from "@/components/dashboard/PrintMenu";
import {
  COMPONENT_CODES,
  fmt2,
  getTabulation,
  getTranscript,
  type Tabulation,
  type TabulationRow,
  type Transcript,
  type TranscriptEntry,
  type TranscriptSubjectRow,
} from "@/lib/academic-results";
import { toast } from "@/lib/swal";
import {
  ActionCell,
  BTN,
  EmptyRow,
  FilterCard,
  GradeChip,
  QrBlock,
  RoleBadge,
  ScopeSelect,
  SignatureBlocks,
  TableWrap,
  PrintSchoolHeader,
  termOptions,
  useScopeOptions,
  useTerms,
} from "../../_components/shared";

/** Batch print guard — 500 A4 pages would choke the browser. */
const BATCH_LIMIT = 60;

/** Stable component column order across every marksheet. */
const COMPONENT_ORDER = COMPONENT_CODES as readonly string[];

function markCellText(
  components: { componentCode: string; convertedMarks: string; isAbsent: boolean; isExempted: boolean }[],
  code: string,
): { text: string; failed: boolean } | null {
  const component = components.find((item) => item.componentCode === code);
  if (!component) return null;
  if (component.isExempted) return { text: "E", failed: false };
  if (component.isAbsent) return { text: "A", failed: true };
  return { text: fmt2(component.convertedMarks), failed: false };
}

export default function MarksheetsView() {
  const { sessionId, setSessionId, classId, setClassId, sectionId, setSectionId, sessions, classes, sections } =
    useCascadingScope({ includeSection: true });
  const [termId, setTermId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const { terms } = useTerms(sessionId, classId);

  const [roster, setRoster] = useState<Tabulation | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);

  const loadRoster = useCallback(async () => {
    if (!termId) {
      setRoster(null);
      return;
    }
    setLoadingRoster(true);
    try {
      const data = await getTabulation({
        examTermId: termId,
        ...(sectionId ? { sectionOrBatchId: sectionId } : {}),
        includeComponents: false,
      });
      setRoster(data);
      if (!data.students.some((row) => row.studentId === studentId)) setStudentId("");
    } catch (error) {
      setRoster(null);
      toast(error instanceof Error ? error.message : "Could not load the student roster", "error");
    } finally {
      setLoadingRoster(false);
    }
  }, [termId, sectionId, studentId]);

  useEffect(() => {
    void loadRoster();
    setTranscripts([]);
  }, [loadRoster]);

  const studentOptions = useMemo(
    () =>
      (roster?.students ?? []).map((row: TabulationRow) => ({
        value: row.studentId,
        label: `Roll ${row.classRollNo ?? "—"} · ${row.fullNameEn ?? row.studentUniqueId ?? row.studentId}`,
      })),
    [roster],
  );

  const loadStudents = useCallback(async (ids: string[]) => {
    if (!termId || ids.length === 0) {
      setTranscripts([]);
      return;
    }
    setLoadingSheets(true);
    try {
      const loaded: Transcript[] = [];
      for (const id of ids) {
        try {
          loaded.push(await getTranscript(termId, id));
        } catch (error) {
          toast(error instanceof Error ? error.message : `No generated result for student ${id}`, "error");
        }
      }
      setTranscripts(loaded);
    } finally {
      setLoadingSheets(false);
    }
  }, [termId]);

  useEffect(() => {
    void loadStudents(studentId ? [studentId] : []);
  }, [studentId, loadStudents]);

  const printSection = () => {
    const ids = (roster?.students ?? []).slice(0, BATCH_LIMIT).map((row) => row.studentId);
    if (ids.length === 0) {
      toast("No students in the current filter", "error");
      return;
    }
    if (ids.length === BATCH_LIMIT && (roster?.students.length ?? 0) > BATCH_LIMIT) {
      toast(`Batch capped at ${BATCH_LIMIT} marksheets (of ${roster?.students.length})`, "info");
    }
    void loadStudents(ids);
  };

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Student Marksheets (A4)"
        description="Spec §PHASE 6 — snapshot-only progress report / transcript with merged-paper row spans, grading legend, QR payload and statutory signatures."
      />

      <FilterCard title="Filter students">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" />
        <ScopeSelect label="Exam Term" value={termId} onChange={setTermId} options={termOptions(terms)} placeholder="Select term" />
        <ScopeSelect label="Section / Batch" value={sectionId} onChange={setSectionId} options={sections} placeholder="All sections" />
        <ScopeSelect label="Student" value={studentId} onChange={setStudentId} options={studentOptions} placeholder="Select student" />
        <ActionCell>
          <button type="button" className={BTN} onClick={printSection} disabled={!termId || loadingRoster}>
            <Layers className="h-3.5 w-3.5" />
            Load section batch
          </button>
          <PrintMenu printTargetId="printable-marksheet-area" title="Student Marksheet" />
        </ActionCell>
      </FilterCard>

      {loadingRoster || loadingSheets ? (
        <DashCard title="Marksheet preview">
          <AdminPageLoader variant="inline" />
        </DashCard>
      ) : transcripts.length === 0 ? (
        <DashCard title="Marksheet preview">
          <p className="py-6 text-center text-xs text-ink-400">
            {termId ? "Select a student (or load the section batch) to preview the A4 marksheet." : "Pick a session, class and exam term first."}
          </p>
        </DashCard>
      ) : (
        <div id="printable-marksheet-area" className="space-y-4">
          {transcripts.map((transcript, index) => (
            <div key={transcript.student.id} style={index > 0 ? { breakAfter: "page" } : undefined}>
              <MarksheetSheet transcript={transcript} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  One A4 marksheet                                                   */
/* ================================================================== */

function MarksheetSheet({ transcript }: { transcript: Transcript }) {
  const entries = transcript.subjects;
  const usedComponents = COMPONENT_ORDER.filter((code) =>
    entries.some((entry) =>
      (entry.kind === "GROUP" ? entry.papers : [entry.row]).some((row) =>
        row.components.some((component) => component.componentCode === code),
      ),
    ),
  );

  const summary = transcript.marksheet;

  return (
    <div className="mx-auto max-w-[900px] rounded-xs border border-ink-200 bg-white p-5 shadow-soft print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <PrintSchoolHeader
        title="Academic Progress Report"
        subtitle={`${transcript.term.termName} · Session ${transcript.term.academicSessionId.slice(0, 8)}`}
      />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
        <div className="text-xs">
          <p className="font-display text-base font-bold text-navy-900">{transcript.student.fullNameEn}</p>
          {transcript.student.fullNameBn && <p className="text-ink-600">{transcript.student.fullNameBn}</p>}
          <p className="mt-1 text-ink-600">
            Student ID: <span className="font-mono">{transcript.student.studentUniqueId}</span>
          </p>
          <p className="text-ink-600">
            Roll: <span className="font-mono">{transcript.enrollment?.classRollNo ?? "—"}</span> · Section:{" "}
            <span className="font-mono">{transcript.enrollment?.sectionOrBatchId?.slice(0, 8) ?? "—"}</span> · Shift:{" "}
            <span className="font-mono">{transcript.enrollment?.shiftId?.slice(0, 8) ?? "—"}</span>
          </p>
          <p className="text-ink-600">
            Term: <span className="font-semibold">{transcript.term.termName}</span> ({transcript.term.termType})
          </p>
        </div>

        {/* Grading legend — top-right, print-critical. */}
        <div className="rounded-xs border border-ink-200">
          <p className="border-b border-ink-200 bg-ink-50 px-2 py-1 text-[10px] font-semibold uppercase text-ink-600">
            {transcript.gradingScale.name}
          </p>
          <table className="text-[10px]">
            <thead>
              <tr className="bg-ink-50 text-ink-600">
                <th className="px-2 py-0.5 text-left font-semibold">Range</th>
                <th className="px-2 py-0.5 text-left font-semibold">Grade</th>
                <th className="px-2 py-0.5 text-right font-semibold">Point</th>
              </tr>
            </thead>
            <tbody>
              {transcript.gradingScale.ranges.map((range) => (
                <tr key={`${range.minPercentage}-${range.letterGrade}`} className="border-t border-ink-100">
                  <td className="px-2 py-0.5 font-mono">
                    {fmt2(range.minPercentage)}–{fmt2(range.maxPercentage)}
                  </td>
                  <td className="px-2 py-0.5 font-semibold">{range.letterGrade}</td>
                  <td className="px-2 py-0.5 text-right font-mono">{fmt2(range.gradePoint)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TableWrap>
        <table className="w-full text-left text-xs">
          <thead className="bg-ink-50 text-ink-700">
            <tr>
              <th className="px-2.5 py-1.5 font-semibold">Subject</th>
              <th className="px-2.5 py-1.5 font-semibold">Paper</th>
              {usedComponents.map((code) => (
                <th key={code} className="px-2.5 py-1.5 text-right font-semibold">
                  {code.replace(/_/g, " ")}
                </th>
              ))}
              <th className="px-2.5 py-1.5 text-right font-semibold">Full</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Total</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Highest</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">%</th>
              <th className="px-2.5 py-1.5 font-semibold">Grade</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">GP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {entries.length === 0 ? (
              <EmptyRow colSpan={6 + usedComponents.length} message="No subject rows in this snapshot." />
            ) : (
              entries.map((entry, entryIndex) =>
                entry.kind === "STANDALONE" ? (
                  <tr key={`s-${entry.row.syllabusSubjectId ?? entryIndex}`} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1 font-medium">
                      {entry.row.subjectName ?? entry.row.subjectCode}
                      {entry.row.assignedRole === "FOURTH_OPTIONAL" && (
                        <span className="ml-1">
                          <RoleBadge role="FOURTH_OPTIONAL" />
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1 text-ink-400">—</td>
                    {usedComponents.map((code) => {
                      const cell = markCellText(entry.row.components, code);
                      return (
                        <td key={code} className={`px-2.5 py-1 text-right font-mono ${cell?.failed ? "text-rose-700" : ""}`}>
                          {cell?.text ?? "—"}
                        </td>
                      );
                    })}
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(entry.row.fullMarks)}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(entry.row.totalObtainedMarks)}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(entry.row.highestMarksInClass)}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(entry.row.percentageMarks)}</td>
                    <td className="px-2.5 py-1">
                      <GradeChip letter={entry.row.letterGrade} />
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(entry.row.gradePoint)}</td>
                  </tr>
                ) : (
                  <MergedPaperRows key={`g-${entry.groupCode}-${entryIndex}`} entry={entry} usedComponents={usedComponents} />
                ),
              )
            )}
          </tbody>
        </table>
      </TableWrap>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <SummaryLine label="Compulsory subjects" value={String(summary.totalCompulsorySubjects)} />
        <SummaryLine label="Marks (without 4th)" value={fmt2(summary.marksWithoutFourth)} />
        <SummaryLine label="Marks (with 4th)" value={fmt2(summary.marksWithFourth)} />
        <SummaryLine label="4th subject bonus GP" value={fmt2(summary.fourthSubjectBonusGp)} />
        <SummaryLine label="GPA without 4th" value={fmt2(summary.gpaWithoutFourth)} />
        <SummaryLine label="Final GPA / CGPA" value={fmt2(summary.finalGpaOrCgpa)} strong />
        <SummaryLine label="Final grade" value={summary.finalLetterGrade} strong />
        <SummaryLine label="Failed subjects" value={String(summary.failedSubjectCount)} tone={summary.failedSubjectCount ? "rose" : "ink"} />
        <SummaryLine label="Attendance" value={`${fmt2(summary.attendancePercentage)}%`} />
        <SummaryLine label="Result" value={summary.resultStatus.replace(/_/g, " ")} strong tone={summary.resultStatus === "PASSED" ? "emerald" : "rose"} />
        <SummaryLine
          label="Merit (sec / shift / class)"
          value={`${summary.meritPositionSection ?? "—"} / ${summary.meritPositionShift ?? "—"} / ${summary.meritPositionClass ?? "—"}`}
        />
        <SummaryLine label="Credits (attempted / earned)" value={`${fmt2(summary.totalCreditsAttempted)} / ${fmt2(summary.totalCreditsEarned)}`} />
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <QrBlock payload={transcript.qr.payload} checksum={transcript.qr.checksum} verifyPath={transcript.qr.verifyPath} />
        <p className="text-[10px] text-ink-500">
          Generated {new Date(summary.generatedAt).toLocaleString()} · {transcript.gradingScale.name}
        </p>
      </div>

      <SignatureBlocks labels={["Class Teacher", "Exam Controller", "Principal"]} />
    </div>
  );
}

/**
 * Merged 1st/2nd paper block (acceptance): each paper prints its own CQ/MCQ
 * line, while Total, Highest, %, Grade and GP span both rows via `rowSpan`.
 */
function MergedPaperRows({
  entry,
  usedComponents,
}: {
  entry: Extract<TranscriptEntry, { kind: "GROUP" }>;
  usedComponents: string[];
}) {
  const papers = entry.papers;
  const merged: TranscriptSubjectRow | null = entry.merged ?? null;
  const span = Math.max(papers.length, 1);

  return (
    <>
      {papers.map((paper, index) => (
        <tr key={`${paper.syllabusSubjectId ?? index}`} className="hover:bg-ink-50">
          {index === 0 && (
            <td rowSpan={span} className="border-r border-ink-100 px-2.5 py-1 align-top font-medium">
              {entry.groupName ?? entry.groupCode}
              {merged?.assignedRole === "FOURTH_OPTIONAL" && (
                <span className="ml-1">
                  <RoleBadge role="FOURTH_OPTIONAL" />
                </span>
              )}
              {merged?.isMergedSummaryRow && (
                <p className="mt-0.5 text-[10px] font-normal text-ink-500">Combined paper evaluation</p>
              )}
            </td>
          )}
          <td className="px-2.5 py-1">
            {paper.subjectName ?? paper.subjectCode}
            {!paper.isPassed && (
              <span className="ml-1 text-[10px] font-semibold text-rose-700">
                {paper.failReason ? paper.failReason.replace(/_/g, " ") : "FAIL"}
              </span>
            )}
          </td>
          {usedComponents.map((code) => {
            const cell = markCellText(paper.components, code);
            return (
              <td key={code} className={`px-2.5 py-1 text-right font-mono ${cell?.failed ? "text-rose-700" : ""}`}>
                {cell?.text ?? "—"}
              </td>
            );
          })}
          <td className="px-2.5 py-1 text-right font-mono">{fmt2(paper.fullMarks)}</td>
          {index === 0 && (
            <>
              <td rowSpan={span} className="px-2.5 py-1 text-right font-mono font-semibold">
                {merged ? fmt2(merged.totalObtainedMarks) : "—"}
              </td>
              <td rowSpan={span} className="px-2.5 py-1 text-right font-mono">
                {merged ? fmt2(merged.highestMarksInClass) : "—"}
              </td>
              <td rowSpan={span} className="px-2.5 py-1 text-right font-mono">
                {merged ? fmt2(merged.percentageMarks) : "—"}
              </td>
              <td rowSpan={span} className="px-2.5 py-1">
                <GradeChip letter={merged?.letterGrade} />
              </td>
              <td rowSpan={span} className="px-2.5 py-1 text-right font-mono">
                {merged ? fmt2(merged.gradePoint) : "—"}
              </td>
            </>
          )}
        </tr>
      ))}
    </>
  );
}

function SummaryLine({
  label,
  value,
  strong = false,
  tone = "ink",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "ink" | "emerald" | "rose";
}) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : "text-ink-900";
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dotted border-ink-200 pb-0.5">
      <span className="text-[11px] text-ink-500">{label}</span>
      <span className={`font-mono ${strong ? "text-sm font-bold" : ""} ${color}`}>{value}</span>
    </div>
  );
}
