"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import PrintMenu from "@/components/dashboard/PrintMenu";
import { toast } from "@/lib/swal";
import { downloadCsv, fmt2, getTabulation, type Tabulation } from "@/lib/academic-results";
import {
  ActionCell,
  BTN,
  BTN_PRIMARY,
  EmptyRow,
  FilterCard,
  GradeChip,
  KpiTile,
  PrintSchoolHeader,
  ResultStatusBadge,
  ScopeSelect,
  SignatureBlocks,
  TableWrap,
  termOptions,
  useScopeOptions,
  useTerms,
} from "../../_components/shared";

export default function TabulationView() {
  const { sessions, classes, sections } = useScopeOptions();
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [includeComponents, setIncludeComponents] = useState(false);
  const { terms } = useTerms(sessionId, classId);

  const [data, setData] = useState<Tabulation | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!termId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      setData(
        await getTabulation({
          examTermId: termId,
          ...(sectionId ? { sectionOrBatchId: sectionId } : {}),
          includeComponents,
        }),
      );
    } catch (error) {
      setData(null);
      toast(error instanceof Error ? error.message : "Could not load the tabulation sheet", "error");
    } finally {
      setLoading(false);
    }
  }, [termId, sectionId, includeComponents]);

  useEffect(() => {
    void load();
  }, [load]);

  const students = data?.students ?? [];
  const columns = data?.columns ?? [];

  const totals = useMemo(() => {
    const appeared = students.length;
    const passed = students.filter((row) => row.summary.resultStatus === "PASSED").length;
    const gpaSum = students.reduce((sum, row) => sum + Number(row.summary.finalGpaOrCgpa || 0), 0);
    return {
      appeared,
      passed,
      failed: appeared - passed,
      averageGpa: appeared ? gpaSum / appeared : 0,
    };
  }, [students]);

  const exportCsv = () => {
    if (!data) return;
    const headers = ["Roll", "Student", ...columns.map((column) => column.label), "GPA", "Grade", "Status", "Merit (section)"];
    const rows = students.map((row) => [
      row.classRollNo ?? "",
      row.fullNameEn ?? row.studentId,
      ...columns.map((column) => {
        const cell = row.marks?.[column.key];
        if (!cell) return "";
        return cell.isPassed ? fmt2(cell.totalObtainedMarks) : `${fmt2(cell.totalObtainedMarks)} (${cell.failReason ?? "F"})`;
      }),
      fmt2(row.summary.finalGpaOrCgpa),
      row.summary.finalLetterGrade,
      row.summary.resultStatus,
      row.summary.meritPositionSection ?? "",
    ]);
    downloadCsv(`tabulation-${data.term.termName.replace(/\s+/g, "-")}.csv`, headers, rows);
  };

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Master Tabulation Sheet"
        description="Spec §PHASE 6 task 4 — snapshot-only landscape broadsheet (A3 / Legal) for the exam committee, with no recalculation."
      />

      <FilterCard title="Filter tabulation">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" isClearable={false} />
        <ScopeSelect label="Exam Term" value={termId} onChange={setTermId} options={termOptions(terms)} placeholder="Select term" isClearable={false} />
        <ScopeSelect label="Section / Batch" value={sectionId} onChange={setSectionId} options={sections} placeholder="All sections" />
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Detail</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-sm text-ink-700">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={includeComponents}
              onChange={(event) => setIncludeComponents(event.target.checked)}
            />
            Include component marks
          </label>
        </div>
        <ActionCell>
          <button type="button" className={BTN} onClick={() => void load()} disabled={!termId}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button type="button" className={BTN} onClick={exportCsv} disabled={!data || !students.length}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <PrintMenu
            printTargetId="printable-tabulation-area"
            title="Master Tabulation Sheet"
            pageSize="Legal landscape"
          />
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Students" value={String(totals.appeared)} />
        <KpiTile label="Passed" value={String(totals.passed)} tone="emerald" />
        <KpiTile label="Failed" value={String(totals.failed)} tone={totals.failed ? "rose" : "ink"} />
        <KpiTile label="Average GPA" value={fmt2(totals.averageGpa)} tone="navy" />
      </div>

      {loading ? (
        <DashCard title="Broadsheet">
          <AdminPageLoader variant="inline" />
        </DashCard>
      ) : !termId ? (
        <DashCard title="Broadsheet">
          <p className="py-6 text-center text-xs text-ink-400">Pick an exam term to load the broadsheet.</p>
        </DashCard>
      ) : students.length === 0 ? (
        <DashCard title="Broadsheet">
          <p className="py-6 text-center text-xs text-amber-700">
            No snapshots generated yet for this term — run the calculation job first.
          </p>
        </DashCard>
      ) : (
        <DashCard title={`${data?.term.termName ?? "Tabulation"} — ${students.length} students × ${columns.length} subjects`}>
          <div id="printable-tabulation-area">
            <PrintSchoolHeader
              title="Master Tabulation Sheet"
              subtitle={`${data?.term.termName ?? ""} · ${data?.term.termType.replace(/_/g, " ") ?? ""} · generated from the stored result snapshot`}
            />
            <TableWrap>
              <table className="w-full text-left text-[10px] leading-tight">
                <thead className="bg-ink-50 text-ink-700">
                  <tr>
                    <th className="whitespace-nowrap px-1.5 py-1 font-semibold">Roll</th>
                    <th className="whitespace-nowrap px-1.5 py-1 font-semibold">Student</th>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className={`whitespace-nowrap px-1.5 py-1 text-right font-semibold ${column.kind === "MERGED" ? "bg-ink-100" : ""}`}
                      >
                        {column.label}
                        {column.fullMarks ? (
                          <span className="ml-0.5 font-normal text-ink-500">/{fmt2(column.fullMarks)}</span>
                        ) : null}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-1.5 py-1 text-right font-semibold">GPA</th>
                    <th className="whitespace-nowrap px-1.5 py-1 font-semibold">Grade</th>
                    <th className="whitespace-nowrap px-1.5 py-1 font-semibold">Status</th>
                    <th className="whitespace-nowrap px-1.5 py-1 text-right font-semibold">Merit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {students.map((row) => (
                    <tr key={row.studentId} className="hover:bg-ink-50">
                      <td className="whitespace-nowrap px-1.5 py-0.5 font-mono">{row.classRollNo ?? "—"}</td>
                      <td className="whitespace-nowrap px-1.5 py-0.5">{row.fullNameEn ?? row.studentId}</td>
                      {columns.map((column) => {
                        const cell = row.marks?.[column.key];
                        if (!cell) {
                          return (
                            <td key={column.key} className="px-1.5 py-0.5 text-right font-mono text-ink-300">
                              —
                            </td>
                          );
                        }
                        return (
                          <td
                            key={column.key}
                            className={`whitespace-nowrap px-1.5 py-0.5 text-right align-top font-mono ${cell.isPassed ? "" : "text-rose-700"} ${column.kind === "MERGED" ? "bg-ink-50 font-semibold" : ""}`}
                            title={cell.failReason ? cell.failReason.replace(/_/g, " ") : undefined}
                          >
                            {fmt2(cell.totalObtainedMarks)}
                            <span className="ml-0.5 text-[9px] text-ink-500">{cell.letterGrade}</span>
                            {includeComponents && cell.components?.length ? (
                              <span className="block text-[8px] font-normal text-ink-500">
                                {cell.components
                                  .map((component) =>
                                    `${component.componentCode.replace(/_WRITTEN|_INCOURSE/, "")}${
                                      component.isAbsent ? ":A" : component.isExempted ? ":E" : `:${fmt2(component.convertedMarks)}`
                                    }`,
                                  )
                                  .join(" ")}
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                      <td className="px-1.5 py-0.5 text-right font-mono font-semibold">{fmt2(row.summary.finalGpaOrCgpa)}</td>
                      <td className="px-1.5 py-0.5">
                        <GradeChip letter={row.summary.finalLetterGrade} />
                      </td>
                      <td className="px-1.5 py-0.5">
                        <ResultStatusBadge status={row.summary.resultStatus} />
                      </td>
                      <td className="px-1.5 py-0.5 text-right font-mono">{row.summary.meritPositionSection ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-ink-300 bg-ink-100 font-semibold">
                  <tr>
                    <td className="px-1.5 py-1.5" colSpan={2}>
                      Appeared {totals.appeared}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono" colSpan={Math.max(columns.length, 1)}>
                      Passed {totals.passed} · Failed {totals.failed}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono">{fmt2(totals.averageGpa)}</td>
                    <td className="px-1.5 py-1.5" colSpan={3}>
                      avg GPA
                    </td>
                  </tr>
                </tfoot>
              </table>
            </TableWrap>
            <SignatureBlocks labels={["Prepared by (Exam Controller)", "Checked by", "Principal"]} />
          </div>
        </DashCard>
      )}
    </div>
  );
}
