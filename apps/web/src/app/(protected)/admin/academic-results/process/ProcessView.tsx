"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, Play, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import {
  getPreFlight,
  getResultJob,
  jobStageLabel,
  listResultJobs,
  runResultNow,
  startResultJob,
  type PreFlightReport,
  type ResultGenerationJob,
} from "@/lib/academic-results";
import { toast } from "@/lib/swal";
import {
  ActionCell,
  BTN,
  BTN_PRIMARY,
  EmptyRow,
  FilterCard,
  KpiTile,
  ScopeSelect,
  StatusBadge,
  TableWrap,
  termOptions,
  useCascadingScope,
  useTerms,
} from "../_components/shared";

const BLOCKER_LABELS: Record<string, string> = {
  TERM_NOT_IN_MARKS_ENTRY: "Term is not in MARKS_ENTRY",
  NO_ENROLLED_STUDENTS: "No active students enrolled",
  NO_SYLLABUS_SUBJECTS: "No syllabus subjects configured",
  NO_COMPONENTS: "Subject has no components",
  COMPONENT_SUM_MISMATCH: "Component converted-max total ≠ full marks (CC-17)",
  MISSING_COMPONENT_MARKS: "Students missing component marks (CC-19)",
  CT_HAS_NO_CHILD_TERMS: "Class-test component but no child terms (CC-06)",
  ATTENDANCE_SUMMARY_MISSING: "Attendance summaries not recorded (AD-4)",
  CUMULATIVE_NO_WEIGHTS: "Annual term has no child-term weights (AD-7)",
  CUMULATIVE_WEIGHTS_NOT_100: "Child weights do not total 100 (AD-7)",
  CUMULATIVE_CHILD_NOT_PUBLISHED: "A child term is not published yet (AD-7)",
};

export default function ProcessView() {
  const { sessionId, setSessionId, classId, setClassId, sessions, classes, loading: scopesLoading } = useCascadingScope();
  const [termId, setTermId] = useState("");
  const { terms } = useTerms(sessionId, classId);

  const [preFlight, setPreFlight] = useState<PreFlightReport | null>(null);
  const [job, setJob] = useState<ResultGenerationJob | null>(null);
  const [history, setHistory] = useState<ResultGenerationJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  const activeJob = Boolean(job && (job.status === "QUEUED" || job.status === "RUNNING"));

  const loadPreFlight = useCallback(async (id: string) => {
    if (!id) {
      setPreFlight(null);
      return;
    }
    setChecking(true);
    try {
      setPreFlight(await getPreFlight(id));
    } catch (error) {
      setPreFlight(null);
      toast(error instanceof Error ? error.message : "Pre-flight check failed", "error");
    } finally {
      setChecking(false);
    }
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    if (!id) {
      setHistory([]);
      return;
    }
    try {
      const jobs = await listResultJobs(id);
      setHistory(jobs);
      setJob((current) => current ?? jobs[0] ?? null);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (!termId) return;
    setJob(null);
    void loadPreFlight(termId);
    void loadHistory(termId);
  }, [termId, loadPreFlight, loadHistory]);

  /* Live progress: poll the job endpoint while a run is in flight. */
  useEffect(() => {
    if (!job || (job.status !== "QUEUED" && job.status !== "RUNNING")) return;
    const handle = window.setInterval(() => {
      void (async () => {
        try {
          const next = await getResultJob(job.id);
          setJob(next);
          if (next.status === "COMPLETED") {
            toast("Result generation completed", "success");
            void loadPreFlight(next.examTermId);
            void loadHistory(next.examTermId);
          } else if (next.status === "FAILED") {
            toast(next.errorMessage ?? "Result generation failed", "error");
            void loadHistory(next.examTermId);
          }
        } catch {
          /* transient — keep polling */
        }
      })();
    }, 1500);
    return () => window.clearInterval(handle);
  }, [job, loadPreFlight, loadHistory]);

  const queueJob = async () => {
    if (!termId) return;
    setBusy(true);
    try {
      const created = await startResultJob(termId);
      setJob(created);
      toast("Generation queued", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not queue generation", "error");
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    if (!termId) return;
    setBusy(true);
    try {
      const result = await runResultNow(termId);
      setJob(result.job);
      toast(`Generated ${result.subjectRows} subject rows for ${result.marksheets} students`, "success");
      await loadPreFlight(termId);
      await loadHistory(termId);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Generation failed", "error");
      await loadHistory(termId);
    } finally {
      setBusy(false);
    }
  };

  const blockers = preFlight?.blockers ?? [];
  const grouped = blockers.reduce<Record<string, typeof blockers>>((acc, blocker) => {
    acc[blocker.code] = [...(acc[blocker.code] ?? []), blocker];
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Generate & Publish Result"
        description="Spec §PHASE 5 — pre-flight validation (CC-17/CC-19/CC-06/AD-4/AD-7) then the in-DB generation job (AD-2)."
      />

      <FilterCard title="Filter exam term">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" />
        <ScopeSelect label="Exam Term" value={termId} onChange={setTermId} options={termOptions(terms)} placeholder="Select term" />
        <ActionCell>
          <button type="button" className={BTN} onClick={() => void loadPreFlight(termId)} disabled={!termId || checking}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Re-run pre-flight
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => void queueJob()} disabled={!termId || busy || activeJob}>
            <Play className="h-3.5 w-3.5" />
            Queue generation
          </button>
          <button type="button" className={BTN} onClick={() => void runNow()} disabled={!termId || busy || activeJob}>
            <Zap className="h-3.5 w-3.5" />
            Run now (sync)
          </button>
        </ActionCell>
      </FilterCard>

      {!termId ? (
        <DashCard title="Pre-flight checklist">
          <p className="py-6 text-center text-xs text-ink-400">
            {scopesLoading ? "Loading scope options…" : "Pick an academic session, class and exam term to validate the run."}
          </p>
        </DashCard>
      ) : checking && !preFlight ? (
        <DashCard title="Pre-flight checklist">
          <AdminPageLoader variant="inline" />
        </DashCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile label="Term status" value={preFlight?.termStatus ?? "—"} tone="navy" />
            <KpiTile label="Students" value={String(preFlight?.students ?? 0)} />
            <KpiTile label="Subjects" value={String(preFlight?.subjects ?? 0)} />
            <KpiTile label="Components" value={String(preFlight?.components ?? 0)} />
          </div>

          <DashCard
            title="Pre-flight checklist"
            action={
              preFlight?.ok ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready to generate
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> {blockers.length} blocker(s)
                </span>
              )
            }
          >
            {preFlight?.ok ? (
              <p className="py-4 text-center text-xs text-emerald-700">
                Every CC-17 / CC-19 / CC-06 / AD-4 / AD-7 check passed. Generation may be queued.
              </p>
            ) : (
              <TableWrap>
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Check</th>
                      <th className="px-2.5 py-1.5 font-semibold">Detail</th>
                      <th className="px-2.5 py-1.5 font-semibold">Occurrences</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {Object.entries(grouped).map(([code, list]) => (
                      <tr key={code} className="hover:bg-ink-50">
                        <td className="px-2.5 py-1 font-semibold text-rose-700">{BLOCKER_LABELS[code] ?? code}</td>
                        <td className="px-2.5 py-1 text-ink-700">
                          {list[0]?.message}
                          {list[0]?.componentCode ? ` · ${list[0].componentCode}` : ""}
                        </td>
                        <td className="px-2.5 py-1 font-mono">{list.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </DashCard>
        </>
      )}

      <DashCard
        title="Generation job"
        action={
          <button type="button" className={BTN} onClick={() => void loadHistory(termId)} disabled={!termId}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      >
        {!job ? (
          <p className="py-6 text-center text-xs text-ink-400">No generation has been started for this term yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-600">
              <Cpu className="h-3.5 w-3.5" />
              <span className="font-mono">{job.id.slice(0, 8)}</span>
              <StatusBadge status={job.status} />
              <span>Stage: {jobStageLabel(job.currentStage)}</span>
              <span className="font-mono">
                {job.processedStudents}/{job.totalStudents} students
              </span>
              <span className="font-mono">{job.progressPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-xs border border-ink-200 bg-ink-50">
              <div
                className={`h-full ${job.status === "FAILED" ? "bg-rose-500" : "bg-brand-600"}`}
                style={{ width: `${Math.max(0, Math.min(100, job.progressPct))}%` }}
              />
            </div>
            {job.errorMessage && (
              <p className="rounded-xs border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">{job.errorMessage}</p>
            )}
          </div>
        )}
      </DashCard>

      <DashCard title="Job history">
        <TableWrap>
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-50 text-ink-700">
              <tr>
                <th className="px-2.5 py-1.5 font-semibold">Job</th>
                <th className="px-2.5 py-1.5 font-semibold">Status</th>
                <th className="px-2.5 py-1.5 font-semibold">Stage</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Students</th>
                <th className="px-2.5 py-1.5 font-semibold">Started</th>
                <th className="px-2.5 py-1.5 font-semibold">Finished</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 bg-white">
              {history.length === 0 ? (
                <EmptyRow colSpan={6} message="No jobs recorded for this term." />
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1 font-mono">{row.id.slice(0, 8)}</td>
                    <td className="px-2.5 py-1">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2.5 py-1">{jobStageLabel(row.currentStage)}</td>
                    <td className="px-2.5 py-1 text-right font-mono">
                      {row.processedStudents}/{row.totalStudents}
                    </td>
                    <td className="px-2.5 py-1 font-mono">{row.startedAt ? new Date(row.startedAt).toLocaleString() : "—"}</td>
                    <td className="px-2.5 py-1 font-mono">{row.finishedAt ? new Date(row.finishedAt).toLocaleString() : "—"}</td>
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
