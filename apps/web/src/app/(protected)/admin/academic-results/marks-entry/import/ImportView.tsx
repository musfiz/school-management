"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiDownload as Download, FiUpload as Upload, FiUploadCloud as UploadCloud } from "react-icons/fi";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import { toast } from "@/lib/swal";
import {
  downloadCsv,
  fmt2,
  getTermComponents,
  importMarksCsv,
  type ImportResult,
  type ImportRowError,
  type SubjectComponent,
} from "@/lib/academic-results";
import {
  ActionCell,
  BTN,
  BTN_PRIMARY,
  EmptyRow,
  FilterCard,
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

export default function ImportView() {
  const { sessionId, setSessionId, classId, setClassId, sectionId, setSectionId, sessions, classes, sections } =
    useCascadingScope({ includeSection: true });
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const { terms } = useTerms(sessionId, classId);
  const { subjects } = useSyllabus(sessionId, classId);

  const [file, setFile] = useState<File | null>(null);
  const [components, setComponents] = useState<SubjectComponent[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [serverErrors, setServerErrors] = useState<ImportRowError[]>([]);
  const [busy, setBusy] = useState(false);

  const openTerms = useMemo(() => terms.filter((term) => MARKABLE_STATUSES.includes(term.status)), [terms]);
  const manualComponents = useMemo(
    () => components.filter((component) => component.sourceType === "MANUAL_ENTRY"),
    [components],
  );

  useEffect(() => {
    if (!termId || !subjectId) {
      setComponents([]);
      return;
    }
    void (async () => {
      try {
        setComponents(await getTermComponents(termId, subjectId));
      } catch {
        setComponents([]);
      }
    })();
  }, [termId, subjectId]);

  // Any change to the target or the file invalidates a previous dry run.
  const reset = () => {
    setResult(null);
    setServerErrors([]);
  };

  const template = () => {
    if (!manualComponents.length) {
      toast("This subject has no manual-entry components", "error");
      return;
    }
    const headers = ["roll", ...manualComponents.map((component) => component.componentCode)];
    downloadCsv("marks-import-template.csv", headers, [[1, ...manualComponents.map(() => "")]]);
  };

  const run = useCallback(
    async (commit: boolean) => {
      if (!termId || !subjectId) {
        toast("Pick an exam term and a subject first", "error");
        return;
      }
      if (!file) {
        toast("Choose a CSV file to import", "error");
        return;
      }
      setBusy(true);
      setServerErrors([]);
      try {
        const response = await importMarksCsv({
          examTermId: termId,
          syllabusSubjectId: subjectId,
          ...(sectionId ? { sectionOrBatchId: sectionId } : {}),
          commit,
          file,
        });
        setResult(response);
        if (response.committed) {
          toast(`Imported ${response.saved ?? 0} mark(s) from ${response.rows} row(s)`, "success");
        } else {
          toast(`Dry run: ${response.plan ?? 0} cell(s) ready, ${response.errors?.length ?? 0} problem row(s)`, response.errors?.length ? "warning" : "success");
        }
      } catch (error) {
        const withErrors = error as Error & { errors?: ImportRowError[] };
        if (withErrors.errors?.length) setServerErrors(withErrors.errors);
        setResult(null);
        toast(withErrors.message, "error");
      } finally {
        setBusy(false);
      }
    },
    [termId, subjectId, sectionId, file],
  );

  const errors = serverErrors.length ? serverErrors : (result?.errors ?? []);

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Import Marks (CSV / OMR)"
        description="Spec §PHASE 4 — dry-run diff first, then commit. Values are keyed by class roll; absent/exempt/cell validation happens server-side."
      />

      <FilterCard title="Import marks">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={(value) => { setSessionId(value); reset(); }} options={sessions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={(value) => { setClassId(value); reset(); }} options={classes} placeholder="Select class" isClearable={false} />
        <ScopeSelect label="Exam Term" value={termId} onChange={(value) => { setTermId(value); reset(); }} options={termOptions(openTerms)} placeholder="Open term" isClearable={false} />
        <ScopeSelect label="Section / Batch" value={sectionId} onChange={(value) => { setSectionId(value); reset(); }} options={sections} placeholder="All sections" />
        <ScopeSelect label="Subject" value={subjectId} onChange={(value) => { setSubjectId(value); reset(); }} options={subjectOptions(subjects)} placeholder="Select subject" isClearable={false} />
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">CSV file</label>
          <input
            type="file"
            accept=".csv,text/csv"
            className="w-full cursor-pointer text-xs text-ink-700"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              reset();
            }}
          />
        </div>
        <ActionCell>
          <button type="button" className={BTN} onClick={template} disabled={!manualComponents.length}>
            <Download className="h-3.5 w-3.5" />
            Download template
          </button>
          <button type="button" className={BTN} onClick={() => void run(false)} disabled={busy || !file}>
            <Upload className="h-3.5 w-3.5" />
            {busy ? "Working…" : "Dry run"}
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => void run(true)}
            disabled={busy || !file || !result?.dryRun || !result.canCommit}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Commit import
          </button>
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Data rows" value={String(result?.rows ?? 0)} />
        <KpiTile label="Cells to write" value={String(result?.plan ?? 0)} tone="emerald" />
        <KpiTile label="Problem rows" value={String(errors.length)} tone={errors.length ? "rose" : "ink"} />
        <KpiTile
          label="State"
          value={result ? (result.committed ? "COMMITTED" : result.canCommit ? "READY" : "BLOCKED") : "NOT RUN"}
          tone={result?.committed ? "emerald" : result?.canCommit ? "navy" : errors.length ? "rose" : "ink"}
        />
      </div>

      {result?.committed ? (
        <DashCard title="Import committed">
          <p className="py-4 text-center text-xs text-emerald-700">
            Saved {result.saved ?? 0} mark(s) from {result.rows} row(s). Reload the marks grid to see them.
          </p>
        </DashCard>
      ) : null}

      <DashCard title="Dry-run diff">
        {!result && !errors.length ? (
          <p className="py-6 text-center text-xs text-ink-400">
            Choose a file and run a dry run — nothing is written until you commit.
          </p>
        ) : errors.length > 0 ? (
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Line</th>
                  <th className="px-2.5 py-1.5 font-semibold">Code</th>
                  <th className="px-2.5 py-1.5 font-semibold">Message</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Roll</th>
                  <th className="px-2.5 py-1.5 font-semibold">Component</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {errors.map((error, index) => (
                  <tr key={`${error.line}-${index}`} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1 font-mono">{error.line}</td>
                    <td className="px-2.5 py-1 font-semibold text-rose-700">{error.code.replace(/_/g, " ")}</td>
                    <td className="px-2.5 py-1 text-ink-700">{error.message}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{error.classRollNo ?? "—"}</td>
                    <td className="px-2.5 py-1 font-mono">{error.componentCode ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Line</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Roll</th>
                  <th className="px-2.5 py-1.5 font-semibold">Component</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Value</th>
                  <th className="px-2.5 py-1.5 font-semibold">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {(result?.diff?.length ?? 0) === 0 ? (
                  <EmptyRow colSpan={5} message="Nothing to write — the file matched no component column." />
                ) : (
                  result?.diff?.map((row, index) => (
                    <tr key={`${row.line}-${row.componentCode}-${index}`} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-mono">{row.line}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{row.classRollNo}</td>
                      <td className="px-2.5 py-1 font-mono">{row.componentCode}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{fmt2(row.rawMarksObtained)}</td>
                      <td className="px-2.5 py-1 text-ink-600">
                        {[row.isAbsent ? "absent" : null, row.isExempted ? "exempt" : null].filter(Boolean).join(", ") || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        )}
      </DashCard>

      <DashCard title="Component columns recognised">
        <TableWrap>
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-50 text-ink-700">
              <tr>
                <th className="px-2.5 py-1.5 font-semibold">Code</th>
                <th className="px-2.5 py-1.5 font-semibold">Name</th>
                <th className="px-2.5 py-1.5 font-semibold">Source</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Max raw</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Weight %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 bg-white">
              {components.length === 0 ? (
                <EmptyRow colSpan={5} message="Pick a term and subject to list its components." />
              ) : (
                components.map((component) => (
                  <tr key={component.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1 font-mono">{component.componentCode}</td>
                    <td className="px-2.5 py-1">{component.componentName ?? "—"}</td>
                    <td className="px-2.5 py-1 text-ink-600">{component.sourceType.replace(/_/g, " ")}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(component.maxRawMarks)}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(component.conversionWeightPct)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
        <p className="mt-2 text-[11px] text-ink-500">
          The file must carry a <span className="font-mono">roll</span> column plus one column per manual component code.
          Auto-populated components (CT, attendance) are refused with <span className="font-mono">NOT_MANUAL</span>.
        </p>
      </DashCard>
    </div>
  );
}
