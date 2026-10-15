"use client";

import { useState } from "react";
import { BookOpenCheck, Loader2, Lock } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashPage";
import SearchSelect from "@/components/ui/SearchSelect";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { SubjectPreview, SubjectPreviewRow } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const GROUPS = ["GENERAL", "SCIENCE", "ARTS", "COMMERCE", "MUZABBID", "HIFZ"].map((v) => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));

interface Props {
  /** Selection + placement meta + full preview carried into wizard state. */
  onSelect?: (
    ids: string[],
    meta: { sessionId: string; classId: string; group: string; shiftId: string; sectionId: string },
    preview: SubjectPreview,
  ) => void;
}

/**
 * Workflow 3 — Step 3: Academic Placement & Subject Selection
 * (Plan §4 Workflow 3). Locked compulsory + group electives, single-pick
 * 4th optional, credit checklist for university mode.
 */
export default function SubjectPickerCard({ onSelect }: Props) {
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [group, setGroup] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<SubjectPreview | null>(null);
  const [fourth, setFourth] = useState("");
  const [rollPreview, setRollPreview] = useState<{ previewRoll: number; scopeHighest: number } | null>(null);

  function meta() {
    return { sessionId: sessionId.trim(), classId: classId.trim(), group: group.trim(), shiftId: shiftId.trim(), sectionId: sectionId.trim() };
  }

  async function load() {
    if (!sessionId.trim() || !classId.trim()) {
      toast("Enter academic session ID and class/dept ID first", "error");
      return;
    }
    const params = new URLSearchParams({
      academicSessionId: sessionId.trim(),
      classOrDeptId: classId.trim(),
    });
    if (group) params.set("academicGroup", group);
    setBusy(true);
    try {
      const data = await apiFetch<SubjectPreview>(
        `/api/admissions/syllabus/preview?${params.toString()}`,
      );
      setPreview(data);
      setFourth("");
      onSelect?.(data.lockedIds, meta(), data);
      // Advisory roll preview (final roll is locked at confirm).
      try {
        const rollParams = new URLSearchParams({
          academicSessionId: sessionId.trim(),
          classOrDeptId: classId.trim(),
        });
        if (sectionId.trim()) rollParams.set("sectionOrBatchId", sectionId.trim());
        setRollPreview(
          await apiFetch<{ previewRoll: number; scopeHighest: number }>(
            `/api/admissions/roll-preview?${rollParams.toString()}`,
          ),
        );
      } catch {
        setRollPreview(null);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load subjects", "error");
    } finally {
      setBusy(false);
    }
  }

  function pickFourth(id: string) {
    if (!preview) return;
    setFourth(id);
    onSelect?.([...preview.lockedIds, id], meta(), preview);
  }

  return (
    <DashCard title="Step 3 — Academic Placement & Subject Selection">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Academic session ID</label>
          <input className={INPUT} placeholder="UUID…" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Class / Dept ID</label>
          <input className={INPUT} placeholder="UUID…" value={classId} onChange={(e) => setClassId(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Academic group</label>
          <SearchSelect options={GROUPS} value={group} onChange={setGroup} placeholder="Select…" isClearable ariaLabel="Academic group" />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Shift ID (optional)</label>
          <input className={`${INPUT} font-mono`} placeholder="UUID…" value={shiftId} onChange={(e) => setShiftId(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Section ID (optional)</label>
          <input className={`${INPUT} font-mono`} placeholder="UUID…" value={sectionId} onChange={(e) => setSectionId(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-3">
          <button type="button" className={BTN} disabled={busy} onClick={load}>
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <BookOpenCheck className="h-3.5 w-3.5" /> Load subjects
              </span>
            )}
          </button>
          <span className="text-[11px] text-ink-500">Session/class pickers arrive with Academic Core — IDs for now.</span>
        </div>
      </div>

      {preview && (
        <div className="mt-3 space-y-3">
          {rollPreview && (
            <p className="rounded-xs border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800">
              Class roll preview: {rollPreview.previewRoll}
              <span className="font-normal"> (advisory — final roll locks at confirm)</span>
            </p>
          )}
          {preview.creditMode && (
            <p className="rounded-xs border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800">
              Credit mode — {preview.totalCredits} total credit hours this placement.
            </p>
          )}

          <SubjectTable title={`Compulsory (${preview.compulsory.length})`} rows={preview.compulsory} locked creditMode={preview.creditMode} />
          {preview.groupElectives.length > 0 && (
            <SubjectTable title={`Group electives — auto-locked for ${group || "group"} (${preview.groupElectives.length})`} rows={preview.groupElectives} locked creditMode={preview.creditMode} />
          )}
          {preview.fourthOptions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-700">
                4th / Optional subject — pick exactly 1 <span className="font-normal text-ink-500">(SSC/Dakhil/HSC rule)</span>
              </p>
              <div className="space-y-1.5">
                {preview.fourthOptions.map((s) => (
                  <label
                    key={s.syllabusSubjectId}
                    className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-xs border px-2.5 py-1.5 text-xs ${
                      fourth === s.syllabusSubjectId
                        ? "border-brand-500 bg-brand-50 font-semibold text-ink-900"
                        : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="fourth-subject"
                      className="cursor-pointer"
                      checked={fourth === s.syllabusSubjectId}
                      onChange={() => pickFourth(s.syllabusSubjectId)}
                    />
                    <span className="font-mono">{subjectLabel(s)}</span>
                    {s.combinedGroupName && <span className="text-ink-500">· {s.combinedGroupName}</span>}
                    <span className="ml-auto font-mono text-ink-500">{s.fullMarks} marks</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {preview.nonCredit.length > 0 && (
            <SubjectTable title={`Non-credit (${preview.nonCredit.length})`} rows={preview.nonCredit} locked creditMode={preview.creditMode} />
          )}
          {preview.compulsory.length + preview.groupElectives.length + preview.fourthOptions.length === 0 && (
            <p className="rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-700">
              No syllabus rows for this session + class yet — add them via{" "}
              <span className="font-mono">POST /admissions/syllabus</span> (Result Engine matrix reuses the same endpoint).
            </p>
          )}
          {preview.requiresFourth && !fourth && preview.fourthOptions.length > 0 && (
            <p className="text-xs font-semibold text-amber-700">
              Pick 1 optional subject to complete this placement (Phase 3 blocks confirm without it).
            </p>
          )}
        </div>
      )}
    </DashCard>
  );
}

function SubjectTable({ title, rows, locked, creditMode }: { title: string; rows: SubjectPreviewRow[]; locked: boolean; creditMode: boolean }) {
  return (
    <div>
      <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-700">
        {locked && <Lock className="h-3 w-3" />} {title}
      </p>
      <div className="overflow-x-auto rounded-xs border border-ink-100">
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-ink-100 bg-white">
            {rows.map((s) => (
              <tr key={s.syllabusSubjectId} className="hover:bg-ink-50">
                <td className="px-2.5 py-1 font-mono">{subjectLabel(s)}</td>
                <td className="px-2.5 py-1 text-ink-500">{s.combinedGroupName ?? "—"}</td>
                <td className="px-2.5 py-1 text-right font-mono">{s.fullMarks}</td>
                {creditMode && <td className="px-2.5 py-1 text-right font-mono">{s.creditHours} cr</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function subjectLabel(s: { subjectCode: string; subjectName: string; paperNumber: number | null }) {
  return `${s.subjectCode} — ${s.subjectName}${s.paperNumber ? ` (P${s.paperNumber})` : ""}`;
}
