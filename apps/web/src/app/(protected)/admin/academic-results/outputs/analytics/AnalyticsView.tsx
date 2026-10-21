"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiDownload as Download, FiRefreshCcw as RefreshCw } from "react-icons/fi";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import PrintMenu from "@/components/dashboard/PrintMenu";
import { toast } from "@/lib/swal";
import { downloadCsv, fmt2, getAnalytics, type Analytics } from "@/lib/academic-results";
import {
  ActionCell,
  BTN,
  BTN_PRIMARY,
  EmptyRow,
  FailReasonBadge,
  FilterCard,
  KpiTile,
  PrintSchoolHeader,
  ResultStatusBadge,
  ScopeSelect,
  SignatureBlocks,
  TableWrap,
  termOptions,
  useCascadingScope,
  useTerms,
} from "../../_components/shared";

const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"];

export default function AnalyticsView() {
  const { sessionId, setSessionId, classId, setClassId, sessions, classes } = useCascadingScope();
  const [termId, setTermId] = useState("");
  const { terms } = useTerms(sessionId, classId);

  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!termId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      setData(await getAnalytics(termId));
    } catch (error) {
      setData(null);
      toast(error instanceof Error ? error.message : "Could not load the analytics", "error");
    } finally {
      setLoading(false);
    }
  }, [termId]);

  useEffect(() => {
    void load();
  }, [load]);

  const histogram = useMemo(() => {
    const buckets = [...(data?.gradeHistogram ?? [])];
    const max = buckets.reduce((peak, bucket) => Math.max(peak, bucket.count), 0);
    buckets.sort((a, b) => {
      const ai = GRADE_ORDER.indexOf(a.letterGrade);
      const bi = GRADE_ORDER.indexOf(b.letterGrade);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    return { buckets, max, total };
  }, [data]);

  const statusRows = useMemo(() => {
    const counts = data?.overall.statusCounts ?? {};
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({
        status,
        count,
        share: total ? (Math.round((count / total) * 10000) / 100).toFixed(2) : "0.00",
      }));
  }, [data]);

  const subjectTotals = useMemo(() => {
    const subjects = data?.subjects ?? [];
    const appeared = subjects.reduce((sum, subject) => sum + subject.appeared, 0);
    const passed = subjects.reduce((sum, subject) => sum + subject.passed, 0);
    const failed = subjects.reduce((sum, subject) => sum + subject.failed, 0);
    return {
      appeared,
      passed,
      failed,
      passPercentage: appeared ? (Math.round((passed / appeared) * 10000) / 100).toFixed(2) : "0.00",
    };
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      `analytics-${data.term.termName.replace(/\s+/g, "-")}.csv`,
      ["Subject", "Appeared", "Passed", "Failed", "Pass %", "Average %", "Fail reasons"],
      data.subjects.map((subject) => [
        subject.label,
        subject.appeared,
        subject.passed,
        subject.failed,
        subject.passPercentage,
        subject.averagePercentage,
        Object.entries(subject.failReasons)
          .map(([reason, count]) => `${reason}×${count}`)
          .join("; "),
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Exam Analytics & Teacher Performance"
        description="Spec §PHASE 6 — pass rates, grade distribution and marks attribution per subject and teacher, computed from the stored snapshot."
      />

      <FilterCard title="Filter analytics">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" isClearable={false} />
        <ScopeSelect label="Exam Term" value={termId} onChange={setTermId} options={termOptions(terms)} placeholder="Select term" isClearable={false} />
        <ActionCell>
          <button type="button" className={BTN} onClick={() => void load()} disabled={!termId}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button type="button" className={BTN} onClick={exportCsv} disabled={!data?.subjects.length}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <PrintMenu printTargetId="printable-analytics-area" title="Exam Analytics" />
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <KpiTile label="Appeared" value={String(data?.overall.appeared ?? 0)} />
        <KpiTile label="Passed" value={String(data?.overall.passed ?? 0)} tone="emerald" />
        <KpiTile label="Failed" value={String(data?.overall.failed ?? 0)} tone={(data?.overall.failed ?? 0) ? "rose" : "ink"} />
        <KpiTile label="Pass %" value={`${data?.overall.passPercentage ?? "0.00"}%`} tone="navy" />
        <KpiTile label="Average GPA" value={fmt2(data?.overall.averageGpa)} />
        <KpiTile label="Highest GPA" value={fmt2(data?.overall.highestGpa)} tone="amber" />
      </div>

      {loading ? (
        <DashCard title="Analytics">
          <AdminPageLoader variant="inline" />
        </DashCard>
      ) : !termId ? (
        <DashCard title="Analytics">
          <p className="py-6 text-center text-xs text-ink-400">Pick an exam term to view its analytics.</p>
        </DashCard>
      ) : (data?.overall.appeared ?? 0) === 0 ? (
        <DashCard title="Analytics">
          <p className="py-6 text-center text-xs text-amber-700">
            No snapshots generated yet for this term — run the calculation job first.
          </p>
        </DashCard>
      ) : (
        <>
          <div id="printable-analytics-area">
            <PrintSchoolHeader
              title="Exam Analytics"
              subtitle={`${data?.term.termName ?? ""} · ${data?.term.termType.replace(/_/g, " ") ?? ""}`}
            />

            <DashCard title="Grade distribution">
              <div className="space-y-1.5">
                {histogram.buckets.map((bucket) => (
                  <div key={bucket.letterGrade} className="flex items-center gap-2 text-xs">
                    <span className="w-8 font-semibold text-ink-700">{bucket.letterGrade}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-xs border border-ink-200 bg-ink-100">
                      <div
                        className={`h-full ${bucket.letterGrade === "F" ? "bg-rose-500" : "bg-brand-600"}`}
                        style={{ width: `${histogram.max ? (bucket.count / histogram.max) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-24 text-right font-mono text-ink-600">
                      {bucket.count}
                      <span className="ml-1 text-[10px] text-ink-400">
                        {histogram.total ? ((bucket.count / histogram.total) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </DashCard>

            <DashCard className="mt-4" title="Result status distribution">
              <TableWrap>
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Status</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Students</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {statusRows.length === 0 ? (
                      <EmptyRow colSpan={3} />
                    ) : (
                      statusRows.map((row) => (
                        <tr key={row.status} className="hover:bg-ink-50">
                          <td className="px-2.5 py-1">
                            <ResultStatusBadge status={row.status} />
                          </td>
                          <td className="px-2.5 py-1 text-right font-mono">{row.count}</td>
                          <td className="px-2.5 py-1 text-right font-mono">{row.share}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableWrap>
            </DashCard>

            <DashCard className="mt-4" title="Subject performance">
              <TableWrap>
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Subject</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Appeared</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Passed</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Failed</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Pass %</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Average %</th>
                      <th className="px-2.5 py-1.5 font-semibold">Fail reasons</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {data?.subjects.length === 0 ? (
                      <EmptyRow colSpan={7} />
                    ) : (
                      data?.subjects.map((subject) => (
                        <tr key={subject.key} className="hover:bg-ink-50">
                          <td className="px-2.5 py-1 font-medium">{subject.label}</td>
                          <td className="px-2.5 py-1 text-right font-mono">{subject.appeared}</td>
                          <td className="px-2.5 py-1 text-right font-mono text-emerald-700">{subject.passed}</td>
                          <td className={`px-2.5 py-1 text-right font-mono ${subject.failed ? "text-rose-700" : ""}`}>
                            {subject.failed}
                          </td>
                          <td className="px-2.5 py-1 text-right font-mono">{subject.passPercentage}%</td>
                          <td className="px-2.5 py-1 text-right font-mono">{fmt2(subject.averagePercentage)}</td>
                          <td className="px-2.5 py-1">
                            <div className="flex flex-wrap items-center gap-1">
                              {Object.keys(subject.failReasons).length === 0 ? (
                                <span className="text-ink-400">—</span>
                              ) : (
                                Object.entries(subject.failReasons).map(([reason, count]) => (
                                  <span key={reason} className="inline-flex items-center gap-1">
                                    <FailReasonBadge reason={reason} />
                                    <span className="font-mono text-[10px] text-ink-600">{count}</span>
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-ink-300 bg-ink-100 font-semibold">
                    <tr>
                      <td className="px-2.5 py-1.5">All subjects</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">{subjectTotals.appeared}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">{subjectTotals.passed}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">{subjectTotals.failed}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">{subjectTotals.passPercentage}%</td>
                      <td className="px-2.5 py-1.5" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </TableWrap>
            </DashCard>

            <SignatureBlocks labels={["Exam Controller", "Principal"]} />
          </div>

          <DashCard className="mt-4" title="Marks entered by teacher">
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
                  {data?.teachers.length === 0 ? (
                    <EmptyRow colSpan={4} message="No marks attributed for this term." />
                  ) : (
                    data?.teachers.map((teacher) => (
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
            <p className="mt-2 text-[11px] text-ink-500">
              Attribution comes from the <span className="font-mono">entered_by</span> column of each stored mark.
            </p>
          </DashCard>
        </>
      )}
    </div>
  );
}
