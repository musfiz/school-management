"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashPage";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { FamilyLookupResult } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

interface Props {
  /** Pre-fill + auto-run (convert-to-draft handoff via ?query=). */
  initialQuery?: string;
  /** Fired on a successful lookup (found or not) so wizards can carry the result forward. */
  onResult?: (result: FamilyLookupResult) => void;
}

/**
 * Workflow 1 — Step 1: Family & Sibling Check (Plan §4 Workflow 1).
 * Shared by Families Directory and the Direct Admission Wizard: type a
 * guardian phone / father NID → existing family auto-fills + sibling
 * banner + waiver badge, or a clean "new family" state.
 */
export default function FamilyLookupCard({ initialQuery, onResult }: Props) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FamilyLookupResult | null>(null);
  const [waiverOn, setWaiverOn] = useState(true);
  const autoRan = useRef(false);

  // Convert-to-draft handoff: pre-fill + auto-run once.
  useEffect(() => {
    if (initialQuery?.trim() && !autoRan.current) {
      autoRan.current = true;
      setQuery(initialQuery.trim());
      run(initialQuery.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  async function run(raw?: string) {
    const q = (raw ?? query).trim();
    if (q.length < 4) {
      toast("Type at least 4 characters — guardian phone or father NID", "error");
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch<FamilyLookupResult>(
        `/api/admissions/families/lookup?query=${encodeURIComponent(q)}`,
      );
      setResult(data);
      setWaiverOn(true);
      onResult?.(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Lookup failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashCard title="Step 1 — Family & Sibling Check">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
        <div className="min-w-0 sm:col-span-2 2xl:col-span-2">
          <label className="mb-1 block text-xs font-medium text-ink-700">
            Guardian phone / Father NID
          </label>
          <input
            className={INPUT}
            placeholder="01XXXXXXXXX or NID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-2">
          <button type="button" className={BTN} disabled={busy} onClick={() => run()}>
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking up…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" /> Lookup family
              </span>
            )}
          </button>
        </div>
      </div>

      {result && !result.found && (
        <p className="mt-3 rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-700">
          No family found for “{result.query}” — continue as a{" "}
          <span className="font-semibold">new family</span>. Parent fields stay
          blank for fresh entry.
        </p>
      )}

      {result?.found && (
        <div className="mt-3 space-y-3">
          <p className="rounded-xs border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
            Existing Family Found ({result.activeSiblings.length} active
            sibling{result.activeSiblings.length === 1 ? "" : "s"} ·{" "}
            {result.family.familyCode}) — parent fields auto-filled below.
          </p>

          {result.suggestedWaiver && (
            <label className="flex cursor-pointer flex-wrap items-center gap-2 rounded-xs border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={waiverOn}
                onChange={(e) => setWaiverOn(e.target.checked)}
              />
              <span className="font-semibold">
                Sibling Waiver: {result.suggestedWaiver.admissionFeePct}% off
                Admission Fee + {result.suggestedWaiver.tuitionFeePct}% off
                Monthly Tuition
              </span>
              <span className="text-amber-700">({result.suggestedWaiver.reason})</span>
            </label>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Father (EN)" value={result.family.fatherNameEn} />
            <Field label="Father NID" value={result.family.fatherNid ?? "—"} />
            <Field label="Mother (EN)" value={result.family.motherNameEn} />
            <Field label="Mother phone" value={result.family.motherPhone ?? "—"} />
            <Field
              label="Local guardian"
              value={
                result.family.localGuardianName
                  ? `${result.family.localGuardianName} (${result.family.localGuardianRelation ?? "—"}) · ${result.family.localGuardianPhone ?? "—"}`
                  : "—"
              }
            />
            <Field label="Primary phone (login/SMS)" value={result.family.primaryGuardianPhone} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Present address" value={result.family.presentAddress} />
            <Field
              label="Area"
              value={`${result.family.upazilaThana ?? "—"}, ${result.family.district ?? "—"}`}
            />
          </div>

          {result.activeSiblings.length > 0 ? (
            <div className="overflow-x-auto rounded-xs border border-ink-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 text-ink-700">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Sibling</th>
                    <th className="px-2.5 py-1.5 font-semibold">Student ID</th>
                    <th className="px-2.5 py-1.5 font-semibold">Status</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">Roll</th>
                    <th className="px-2.5 py-1.5 font-semibold">Group</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {result.activeSiblings.map((s) => (
                    <tr key={s.studentId} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-medium">{s.name}</td>
                      <td className="px-2.5 py-1 font-mono">{s.studentUniqueId}</td>
                      <td className="px-2.5 py-1">
                        <span className="rounded-xs bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                          {s.status}
                        </span>
                      </td>
                      <td className="px-2.5 py-1 text-right font-mono">
                        {s.classRollNo ?? "—"}
                      </td>
                      <td className="px-2.5 py-1">{s.academicGroup ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-xs text-ink-500">
              <Users className="h-3.5 w-3.5" /> No active siblings — waiver
              suggestion stays off for this family.
            </p>
          )}
        </div>
      )}
    </DashCard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-ink-700">{label}</p>
      <p className="truncate rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1 text-sm" title={value}>
        {value}
      </p>
    </div>
  );
}
