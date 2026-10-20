"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import PrintMenu from "@/components/dashboard/PrintMenu";
import { toast } from "@/lib/swal";
import {
  downloadCsv,
  fmt2,
  getFailList,
  getMeritList,
  getTabulation,
  type FailList,
  type MeritEntry,
  type MeritList,
} from "@/lib/academic-results";
import {
  ActionCell,
  BTN,
  BTN_PRIMARY,
  EmptyRow,
  FailReasonBadge,
  Field,
  FilterCard,
  GradeChip,
  INPUT,
  KpiTile,
  PrintSchoolHeader,
  ResultStatusBadge,
  ScopeSelect,
  SignatureBlocks,
  TabNav,
  TableWrap,
  termOptions,
  useCascadingScope,
  useTerms,
} from "../../_components/shared";

const SCOPE_OPTIONS = [
  { value: "section", label: "By section" },
  { value: "shift", label: "By shift" },
  { value: "class", label: "Whole class" },
];

export default function MeritListView() {
  const { sessionId, setSessionId, classId, setClassId, sectionId, setSectionId, sessions, classes, sections } =
    useCascadingScope({ includeSection: true });
  const [termId, setTermId] = useState("");
  const [scope, setScope] = useState("section");
  const [shiftId, setShiftId] = useState("");
  const [limit, setLimit] = useState("200");
  const [tab, setTab] = useState("merit");
  const { terms } = useTerms(sessionId, classId);

  const [merit, setMerit] = useState<MeritList | null>(null);
  const [fails, setFails] = useState<FailList | null>(null);
  const [shiftOptions, setShiftOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!termId) {
      setShiftOptions([]);
      return;
    }
    void (async () => {
      try {
        const tabulation = await getTabulation({ examTermId: termId, includeComponents: false });
        const unique = Array.from(
          new Set(tabulation.students.map((row) => row.shiftId).filter((id): id is string => Boolean(id))),
        );
        setShiftOptions(unique.map((id) => ({ value: id, label: `Shift ${id.slice(0, 8)}` })));
      } catch {
        setShiftOptions([]);
      }
    })();
  }, [termId]);

  const load = useCallback(async () => {
    if (!termId) {
      setMerit(null);
      setFails(null);
      return;
    }
    setLoading(true);
    try {
      const [meritList, failList] = await Promise.all([
        getMeritList({
          examTermId: termId,
          scope: scope as "section" | "shift" | "class",
          ...(sectionId ? { sectionOrBatchId: sectionId } : {}),
          ...(shiftId ? { shiftId } : {}),
          limit: Number(limit) || 200,
        }),
        getFailList({
          examTermId: termId,
          ...(sectionId ? { sectionOrBatchId: sectionId } : {}),
          limit: Number(limit) || 200,
        }),
      ]);
      setMerit(meritList);
      setFails(failList);
    } catch (error) {
      setMerit(null);
      setFails(null);
      toast(error instanceof Error ? error.message : "Could not load the lists", "error");
    } finally {
      setLoading(false);
    }
  }, [termId, scope, sectionId, shiftId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const entries: MeritEntry[] = useMemo(
    () => (tab === "merit" ? (merit?.entries ?? []) : (fails?.entries ?? [])),
    [tab, merit, fails],
  );

  const stats = useMemo(() => {
    const total = merit?.total ?? 0;
    const passed = (merit?.entries ?? []).filter((entry) => entry.resultStatus === "PASSED").length;
    const top = merit?.entries?.[0];
    return {
      total,
      passed,
      failed: total - passed,
      passPercentage: total ? (Math.round((passed / total) * 10000) / 100).toFixed(2) : "0.00",
      topGpa: top ? fmt2(top.finalGpaOrCgpa) : "—",
    };
  }, [merit]);

  const exportCsv = () => {
    if (tab === "merit") {
      downloadCsv(
        "merit-list.csv",
        ["Position", "Roll", "Student", "GPA", "GPA w/o 4th", "Grade", "Marks (4th)", "Marks (w/o 4th)", "Failed", "Attendance %", "Result"],
        (merit?.entries ?? []).map((entry) => [
          entry.position ?? "",
          "",
          entry.fullNameEn ?? entry.studentId,
          fmt2(entry.finalGpaOrCgpa),
          fmt2(entry.gpaWithoutFourth),
          entry.finalLetterGrade,
          fmt2(entry.marksWithFourth),
          fmt2(entry.marksWithoutFourth),
          entry.failedSubjectCount,
          fmt2(entry.attendancePercentage),
          entry.resultStatus,
        ]),
      );
      return;
    }
    downloadCsv(
      "fail-list.csv",
      ["Student", "GPA", "Grade", "Result", "Failed subjects"],
      (fails?.entries ?? []).map((entry) => [
        entry.fullNameEn ?? entry.studentId,
        fmt2(entry.finalGpaOrCgpa),
        entry.finalLetterGrade,
        entry.resultStatus,
        entry.failedSubjects.map((subject) => `${subject.label ?? "?"} (${subject.failReason ?? "F"})`).join("; "),
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Merit & Fail Lists"
        description="Spec §PHASE 6 — stored merit positions (section / shift / class) and the fail list with per-subject reasons, straight from the snapshot."
      />

      <FilterCard title="Filter merit & fail lists">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" isClearable={false} />
        <ScopeSelect label="Exam Term" value={termId} onChange={setTermId} options={termOptions(terms)} placeholder="Select term" isClearable={false} />
        <ScopeSelect label="Scope" value={scope} onChange={setScope} options={SCOPE_OPTIONS} placeholder="Select scope" isClearable={false} />
        <ScopeSelect label="Section / Batch" value={sectionId} onChange={setSectionId} options={sections} placeholder="All sections" />
        <ScopeSelect label="Shift" value={shiftId} onChange={setShiftId} options={shiftOptions} placeholder="All shifts" />
        <Field label="Limit">
          <input className={INPUT} value={limit} onChange={(event) => setLimit(event.target.value)} />
        </Field>
        <ActionCell>
          <button type="button" className={BTN} onClick={() => void load()} disabled={!termId}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button type="button" className={BTN} onClick={exportCsv} disabled={!entries.length}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <PrintMenu printTargetId="printable-merit-area" title={tab === "merit" ? "Merit List" : "Fail List"} />
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiTile label="Appeared" value={String(stats.total)} />
        <KpiTile label="Passed" value={String(stats.passed)} tone="emerald" />
        <KpiTile label="Failed" value={String(stats.failed)} tone={stats.failed ? "rose" : "ink"} />
        <KpiTile label="Pass %" value={`${stats.passPercentage}%`} tone="navy" />
        <KpiTile label="Top GPA" value={stats.topGpa} tone="amber" />
      </div>

      <TabNav
        tabs={[
          { id: "merit", label: "Merit list" },
          { id: "fail", label: "Fail list" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <DashCard title={tab === "merit" ? "Merit list" : "Fail list"}>
          <AdminPageLoader variant="inline" />
        </DashCard>
      ) : !termId ? (
        <DashCard title={tab === "merit" ? "Merit list" : "Fail list"}>
          <p className="py-6 text-center text-xs text-ink-400">Pick an exam term to build the lists.</p>
        </DashCard>
      ) : (
        <DashCard
          title={tab === "merit" ? `Merit list (${entries.length})` : `Fail list (${entries.length})`}
        >
          <div id="printable-merit-area">
            <PrintSchoolHeader
              title={tab === "merit" ? "Merit List" : "Fail List"}
              subtitle={`${merit?.term.termName ?? fails?.term.termName ?? ""} · ${scope === "class" ? "whole class" : `by ${scope}`}`}
            />
            <TableWrap>
              {tab === "merit" ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Position</th>
                      <th className="px-2.5 py-1.5 font-semibold">Student</th>
                      <th className="px-2.5 py-1.5 font-semibold">Section</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">GPA</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">GPA w/o 4th</th>
                      <th className="px-2.5 py-1.5 font-semibold">Grade</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Marks (4th)</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Marks (w/o)</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Failed</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Attendance</th>
                      <th className="px-2.5 py-1.5 font-semibold">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {entries.length === 0 ? (
                      <EmptyRow colSpan={11} message="No snapshots for this filter — run the calculation job first." />
                    ) : (
                      entries.map((entry) => (
                        <tr key={entry.studentId} className="hover:bg-ink-50">
                          <td className={`px-2.5 py-1 font-mono ${entry.position && entry.position <= 3 ? "font-bold" : ""}`}>
                            {entry.position ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-1">
                            {entry.fullNameEn ?? entry.studentId}
                            {entry.fullNameBn ? <span className="ml-1 text-[10px] text-ink-500">{entry.fullNameBn}</span> : null}
                          </td>
                          <td className="px-2.5 py-1 font-mono text-ink-600">{entry.sectionOrBatchId?.slice(0, 8) ?? "—"}</td>
                          <td className="px-2.5 py-1 text-right font-mono font-semibold">{fmt2(entry.finalGpaOrCgpa)}</td>
                          <td className="px-2.5 py-1 text-right font-mono">{fmt2(entry.gpaWithoutFourth)}</td>
                          <td className="px-2.5 py-1">
                            <GradeChip letter={entry.finalLetterGrade} />
                          </td>
                          <td className="px-2.5 py-1 text-right font-mono">{fmt2(entry.marksWithFourth)}</td>
                          <td className="px-2.5 py-1 text-right font-mono">{fmt2(entry.marksWithoutFourth)}</td>
                          <td className={`px-2.5 py-1 text-right font-mono ${entry.failedSubjectCount ? "text-rose-700" : ""}`}>
                            {entry.failedSubjectCount}
                          </td>
                          <td className="px-2.5 py-1 text-right font-mono">{fmt2(entry.attendancePercentage)}%</td>
                          <td className="px-2.5 py-1">
                            <ResultStatusBadge status={entry.resultStatus} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Student</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">GPA</th>
                      <th className="px-2.5 py-1.5 font-semibold">Grade</th>
                      <th className="px-2.5 py-1.5 font-semibold">Result</th>
                      <th className="px-2.5 py-1.5 font-semibold">Failed subjects</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {entries.length === 0 ? (
                      <EmptyRow colSpan={5} message="Nobody failed under this filter." />
                    ) : (
                      entries.map((entry) => (
                        <tr key={entry.studentId} className="hover:bg-ink-50">
                          <td className="whitespace-nowrap px-2.5 py-1">{entry.fullNameEn ?? entry.studentId}</td>
                          <td className="px-2.5 py-1 text-right font-mono font-semibold">{fmt2(entry.finalGpaOrCgpa)}</td>
                          <td className="px-2.5 py-1">
                            <GradeChip letter={entry.finalLetterGrade} />
                          </td>
                          <td className="px-2.5 py-1">
                            <ResultStatusBadge status={entry.resultStatus} />
                          </td>
                          <td className="px-2.5 py-1">
                            <div className="flex flex-wrap items-center gap-1">
                              {entry.failedSubjects.length === 0 ? (
                                <span className="text-ink-400">—</span>
                              ) : (
                                entry.failedSubjects.map((subject, index) => (
                                  <span key={`${subject.label}-${index}`} className="inline-flex items-center gap-1">
                                    <span className="text-[11px] font-medium text-ink-700">{subject.label ?? "—"}</span>
                                    <FailReasonBadge reason={subject.failReason} />
                                    <span className="font-mono text-[10px] text-ink-500">
                                      {fmt2(subject.totalObtainedMarks)}/{fmt2(subject.fullMarks)}
                                    </span>
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </TableWrap>
            <SignatureBlocks labels={["Exam Controller", "Principal"]} />
          </div>
        </DashCard>
      )}

      <DashCard title="Fail-list summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile label="Non-passed marksheets" value={String(fails?.total ?? 0)} tone={(fails?.total ?? 0) ? "rose" : "ink"} />
          <KpiTile label="Merit rows" value={String(merit?.entries.length ?? 0)} />
          <KpiTile label="Scope" value={(merit?.scope ?? scope).toUpperCase()} tone="navy" />
          <KpiTile label="Limit" value={limit} />
        </div>
      </DashCard>
    </div>
  );
}
