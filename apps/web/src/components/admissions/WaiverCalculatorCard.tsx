"use client";

import { useState } from "react";
import { Calculator, Loader2, ShieldAlert } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashPage";
import SearchSelect from "@/components/ui/SearchSelect";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { WaiverInputs, WaiverSuggestion } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const QUOTAS = [
  "GENERAL",
  "MERIT",
  "SIBLING",
  "FREEDOM_FIGHTER",
  "ORPHAN_LILLAH",
  "STAFF_CHILD",
].map((v) => ({ value: v, label: v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) }));

const RESIDENCES = [
  { value: "DAY_SCHOLAR", label: "Day scholar" },
  { value: "HOSTEL_REGULAR", label: "Hostel (regular)" },
  { value: "MADRASAH_LILLAH_BOARDER", label: "Madrasah Lillah boarder (Fund 02)" },
];

interface Props {
  familyId?: string;
  familyCode?: string;
  /** Pre-select quota (wizard passes SIBLING when Step 1 found siblings). */
  initialQuota?: string;
  /** Pre-seed GPA (convert-to-draft handoff). */
  initialGpa?: string;
  /** Institution locked from Step 2 (single source — no second selector here). */
  institution?: string;
  /** Selections + the inputs that produced them, carried for Phase 3 confirm. */
  onSelect?: (selected: WaiverSuggestion[], inputs: WaiverInputs) => void;
}

/**
 * Workflow 2 — Step 4: Waivers, Stipends & Residential/Transport
 * (Plan §4 Workflow 2). GPA/quota/residence → preset suggestions with the
 * Fund-02 zakat gate enforced server-side (blocked cards, never applied).
 */
export default function WaiverCalculatorCard({ familyId, familyCode, initialQuota, initialGpa, institution, onSelect }: Props) {
  const [prevGpa, setPrevGpa] = useState(initialGpa ?? "");
  const [quota, setQuota] = useState(initialQuota ?? "");
  const [residence, setResidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);
  const [suggestions, setSuggestions] = useState<WaiverSuggestion[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function inputs(): WaiverInputs {
    return {
      ...(prevGpa.trim() ? { prevGpa: prevGpa.trim() } : {}),
      ...(institution ? { institutionType: institution } : {}),
      ...(quota ? { quotaTag: quota } : {}),
      ...(residence ? { residenceType: residence } : {}),
    };
  }

  async function calculate() {
    const inp = inputs();
    const params = new URLSearchParams();
    if (inp.prevGpa) params.set("prevGpa", inp.prevGpa);
    if (inp.institutionType) params.set("institutionType", inp.institutionType);
    if (inp.quotaTag) params.set("quotaTag", inp.quotaTag);
    if (inp.residenceType) params.set("residenceType", inp.residenceType);
    if (familyId) params.set("familyId", familyId);
    setBusy(true);
    try {
      const data = await apiFetch<{ suggestions: WaiverSuggestion[] }>(
        `/api/admissions/waivers/calculate?${params.toString()}`,
      );
      setSuggestions(data.suggestions);
      setPicked(new Set(data.suggestions.filter((s) => s.allowed).map((s) => s.ruleCode)));
      setRan(true);
      onSelect?.(data.suggestions.filter((s) => s.allowed), inp);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Calculation failed", "error");
    } finally {
      setBusy(false);
    }
  }

  function toggle(ruleCode: string) {
    const next = new Set(picked);
    if (next.has(ruleCode)) next.delete(ruleCode);
    else next.add(ruleCode);
    setPicked(next);
    onSelect?.(suggestions.filter((s) => s.allowed && next.has(s.ruleCode)), inputs());
  }

  return (
    <DashCard title="Step 4 — Waivers, Stipends & Residential/Transport">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Previous GPA (0–5)</label>
          <input
            className={INPUT}
            inputMode="decimal"
            placeholder="e.g. 5.00"
            value={prevGpa}
            onChange={(e) => setPrevGpa(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Institution (from Step 2)</label>
          <p className="truncate rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1 text-sm font-semibold" title={institution || "Not set — pick it in Step 2"}>
            {institution || "Not set"}
          </p>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Quota</label>
          <SearchSelect options={QUOTAS} value={quota} onChange={setQuota} placeholder="Select…" isClearable ariaLabel="Quota tag" />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Residence</label>
          <SearchSelect options={RESIDENCES} value={residence} onChange={setResidence} placeholder="Select…" isClearable ariaLabel="Residence type" />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Family (from Step 1)</label>
          <p className="truncate rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1 font-mono text-sm" title={familyCode ?? "Not linked"}>
            {familyCode ?? "Not linked"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-1">
          <button type="button" className={BTN} disabled={busy} onClick={calculate}>
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" /> Calculate waiver
              </span>
            )}
          </button>
        </div>
      </div>

      {ran && suggestions.length === 0 && (
        <p className="mt-3 rounded-xs border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-700">
          No preset matched. Check GPA band / quota / residence — or ask an
          admin to seed presets (<span className="font-mono">POST /admissions/waiver-presets/seed-defaults</span>).
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestions.map((s) =>
            s.allowed ? (
              <label
                key={s.ruleCode}
                className="flex cursor-pointer flex-wrap items-center gap-2 rounded-xs border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900"
              >
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={picked.has(s.ruleCode)}
                  onChange={() => toggle(s.ruleCode)}
                />
                <span className="font-semibold">{s.ruleName}</span>
                <span className="font-mono">
                  {s.admissionFeePct}% admission + {s.tuitionFeePct}% tuition
                </span>
                <span className="rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                  {s.waiverType}
                </span>
                {s.requiresZakatEligible && (
                  <span className="text-emerald-700">· Fund 02 verified ✓</span>
                )}
              </label>
            ) : (
              <p
                key={s.ruleCode}
                className="flex flex-wrap items-center gap-2 rounded-xs border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span className="font-semibold">{s.ruleName} — blocked:</span>
                <span>{s.reason}</span>
              </p>
            ),
          )}
          <p className="text-xs text-ink-500">
            {picked.size} waiver(s) selected — carried into admission confirm
            (Phase 3 posts them to <span className="font-mono">student_waivers</span> with
            contra 41901–41904; Lillah lines stay in Fund 02).
          </p>
        </div>
      )}
    </DashCard>
  );
}
