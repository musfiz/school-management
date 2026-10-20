"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, Sparkles, Zap } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { toast } from "@/lib/swal";
import {
  autoPopulateMarks,
  fmt2,
  getMarksSheet,
  listAttendance,
  listAttendanceSlabs,
  saveAttendance,
  type AttendanceSlab,
  type AutoPopulateResult,
  type MarksSheet,
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
} from "../../_components/shared";

const MARKABLE_STATUSES = ["SETUP", "MARKS_ENTRY"];

export default function AutoSyncView() {
  const { sessionId, setSessionId, classId, setClassId, sessions, classes } = useCascadingScope();
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const { terms } = useTerms(sessionId, classId);
  const { subjects } = useSyllabus(sessionId, classId);

  const [result, setResult] = useState<AutoPopulateResult | null>(null);
  const [sheet, setSheet] = useState<MarksSheet | null>(null);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [slabs, setSlabs] = useState<AttendanceSlab[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const openTerms = useMemo(() => terms.filter((term) => MARKABLE_STATUSES.includes(term.status)), [terms]);

  useEffect(() => {
    void (async () => {
      try {
        setSlabs(await listAttendanceSlabs());
      } catch {
        setSlabs([]);
      }
    })();
  }, []);

  const loadContext = useCallback(async () => {
    if (!termId) {
      setSheet(null);
      setAttendance({});
      return;
    }
    setLoading(true);
    try {
      const [stored, roster] = await Promise.all([
        listAttendance(termId),
        subjectId
          ? getMarksSheet({ examTermId: termId, syllabusSubjectId: subjectId })
          : Promise.resolve<MarksSheet | null>(null),
      ]);
      setSheet(roster);
      const map: Record<string, string> = {};
      for (const entry of stored) map[entry.studentId] = fmt2(entry.attendancePercentage);
      setAttendance(map);
    } catch (error) {
      setSheet(null);
      setAttendance({});
      toast(error instanceof Error ? error.message : "Could not load the attendance context", "error");
    } finally {
      setLoading(false);
    }
  }, [termId, subjectId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const roster = useMemo(() => {
    if (!sheet) return [] as { studentId: string; classRollNo?: number; name: string }[];
    return sheet.rows.map((row) => ({
      studentId: row.studentId,
      classRollNo: row.classRollNo,
      name: row.fullNameEn ?? row.studentId,
    }));
  }, [sheet]);

  const changedCount = useMemo(() => {
    if (!sheet) return 0;
    let changed = 0;
    for (const row of roster) {
      const row2 = sheet.rows.find((item) => item.studentId === row.studentId);
      const stored = row2?.attendance?.attendancePercentage;
      if (stored === undefined) {
        if ((attendance[row.studentId] ?? "") !== "") changed += 1;
      } else if (fmt2(stored) !== (attendance[row.studentId] ?? "")) {
        changed += 1;
      }
    }
    return changed;
  }, [sheet, roster, attendance]);

  const runAutoPopulate = async (scoped: boolean) => {
    if (!termId) return;
    setBusy(true);
    try {
      const response = await autoPopulateMarks({
        examTermId: termId,
        ...(scoped && subjectId ? { syllabusSubjectId: subjectId } : {}),
      });
      setResult(response);
      toast(
        response.message ?? `Auto-populated ${response.updated} mark(s) across ${response.students} student(s)`,
        response.gaps?.length ? "warning" : "success",
      );
      await loadContext();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Auto-populate failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const persistAttendance = async () => {
    if (!termId) return;
    const entries = roster
      .map((row) => ({ studentId: row.studentId, attendancePercentage: (attendance[row.studentId] ?? "").trim() }))
      .filter((entry) => entry.attendancePercentage !== "");
    if (!entries.length) {
      toast("Enter at least one attendance percentage", "error");
      return;
    }
    const bad = entries.find((entry) => {
      const value = Number(entry.attendancePercentage);
      return !Number.isFinite(value) || value < 0 || value > 100;
    });
    if (bad) {
      toast("Attendance percentages must be between 0 and 100", "error");
      return;
    }
    setBusy(true);
    try {
      const response = await saveAttendance({ examTermId: termId, entries });
      toast(`Saved attendance for ${response.saved} student(s)`, "success");
      await loadContext();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save attendance", "error");
    } finally {
      setBusy(false);
    }
  };

  const fillAll = () => {
    const map: Record<string, string> = { ...attendance };
    for (const row of roster) map[row.studentId] = "100.00";
    setAttendance(map);
  };

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="CT & Attendance Auto-Sync"
        description="Spec §PHASE 4 — CC-06 class-test aggregation into the in-course component and AD-4 attendance marks, plus the manual attendance summary editor."
      />

      <FilterCard title="Filter auto-sync">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" isClearable={false} />
        <ScopeSelect label="Exam Term" value={termId} onChange={setTermId} options={termOptions(openTerms)} placeholder="Open term" isClearable={false} />
        <ScopeSelect label="Subject" value={subjectId} onChange={setSubjectId} options={subjectOptions(subjects)} placeholder="All subjects" />
        <ActionCell>
          <button type="button" className={BTN} onClick={() => void loadContext()} disabled={!termId}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button type="button" className={BTN} onClick={() => void runAutoPopulate(true)} disabled={!termId || !subjectId || busy}>
            <Zap className="h-3.5 w-3.5" />
            Auto-populate subject
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => void runAutoPopulate(false)} disabled={!termId || busy}>
            <Sparkles className="h-3.5 w-3.5" />
            Auto-populate all
          </button>
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Marks updated" value={String(result?.updated ?? 0)} tone="emerald" />
        <KpiTile label="Components touched" value={String(result?.components ?? 0)} />
        <KpiTile label="Students" value={String(result?.students ?? 0)} />
        <KpiTile label="Gaps" value={String(result?.gaps?.length ?? 0)} tone={(result?.gaps?.length ?? 0) ? "rose" : "ink"} />
      </div>

      <DashCard title="Auto-population gaps">
        {!result ? (
          <p className="py-6 text-center text-xs text-ink-400">
            Run auto-populate to pull class-test and attendance marks; unresolved rows appear here rather than silently scoring zero.
          </p>
        ) : (result.gaps?.length ?? 0) === 0 ? (
          <p className="py-4 text-center text-xs text-emerald-700">
            No gaps — every student had a source value for every auto component.
          </p>
        ) : (
          <>
            {result.message && <p className="mb-2 text-[11px] text-ink-500">{result.message}</p>}
            <TableWrap>
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 text-ink-700">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Code</th>
                    <th className="px-2.5 py-1.5 font-semibold">Detail</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">Roll</th>
                    <th className="px-2.5 py-1.5 font-semibold">Component</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {result.gaps?.map((gap, index) => (
                    <tr key={`${gap.code}-${index}`} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-semibold text-rose-700">{gap.code.replace(/_/g, " ")}</td>
                      <td className="px-2.5 py-1 text-ink-700">{gap.message ?? gap.percentage ?? "—"}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{gap.classRollNo ?? "—"}</td>
                      <td className="px-2.5 py-1 font-mono">{gap.componentCode ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </>
        )}
      </DashCard>

      <DashCard
        title="Attendance summary (AD-4)"
        action={
          <div className="flex items-center gap-1.5">
            <button type="button" className={BTN} onClick={fillAll} disabled={!roster.length}>
              Fill 100%
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => void persistAttendance()}
              disabled={!roster.length || busy || changedCount === 0}
            >
              <Save className="h-3.5 w-3.5" />
              {busy ? "Saving…" : `Save attendance${changedCount ? ` (${changedCount})` : ""}`}
            </button>
          </div>
        }
      >
        {loading ? (
          <AdminPageLoader variant="inline" />
        ) : !termId || !subjectId ? (
          <p className="py-6 text-center text-xs text-ink-400">
            Pick an exam term and a subject — the attendance editor uses that subject's roster.
          </p>
        ) : roster.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-400">No students enrolled on this subject roster.</p>
        ) : (
          <>
            <TableWrap>
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 text-ink-700">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Roll</th>
                    <th className="px-2.5 py-1.5 font-semibold">Student</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">Attendance %</th>
                    <th className="px-2.5 py-1.5 font-semibold">Source</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">Awarded mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {roster.map((row) => {
                    const sheetRow = sheet?.rows.find((item) => item.studentId === row.studentId);
                    const percentage = attendance[row.studentId] ?? "";
                    const numeric = Number(percentage);
                    const slab = Number.isFinite(numeric)
                      ? slabs.find((item) => numeric >= Number(item.minAttendancePct) && numeric <= Number(item.maxAttendancePct))
                      : undefined;
                    return (
                      <tr key={row.studentId} className="hover:bg-ink-50">
                        <td className="px-2.5 py-1 font-mono">{row.classRollNo ?? "—"}</td>
                        <td className="whitespace-nowrap px-2.5 py-1">{row.name}</td>
                        <td className="px-1.5 py-1">
                          <input
                            className={`${INPUT} text-right font-mono`}
                            inputMode="decimal"
                            value={percentage}
                            onChange={(event) => setAttendance({ ...attendance, [row.studentId]: event.target.value })}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2.5 py-1 text-ink-600">{sheetRow?.attendance?.source ?? "—"}</td>
                        <td className="px-2.5 py-1 text-right font-mono">{slab ? fmt2(slab.awardedMarks) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-[11px] text-ink-500">
              The attendance award is resolved from the seeded slab ladder (AD-4); percent below the lowest slab records an auto-populate gap instead of a silent zero.
            </p>
          </>
        )}
      </DashCard>

      <DashCard title="Attendance mark slabs (AD-4)">
        <TableWrap>
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-50 text-ink-700">
              <tr>
                <th className="px-2.5 py-1.5 font-semibold">Slab</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">From %</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">To %</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Awarded marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 bg-white">
              {slabs.length === 0 ? (
                <EmptyRow colSpan={4} message="No attendance slabs seeded." />
              ) : (
                slabs.map((slab) => (
                  <tr key={slab.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1">{slab.name}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(slab.minAttendancePct)}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(slab.maxAttendancePct)}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(slab.awardedMarks)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      </DashCard>
    </div>
  );
}
