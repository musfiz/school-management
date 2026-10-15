"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import FamilyLookupCard from "@/components/admissions/FamilyLookupCard";
import Step2FormCard from "@/components/admissions/Step2FormCard";
import SubjectPickerCard from "@/components/admissions/SubjectPickerCard";
import WaiverCalculatorCard from "@/components/admissions/WaiverCalculatorCard";
import StayExtrasCard from "@/components/admissions/StayExtrasCard";
import FeeConfirmCard from "@/components/admissions/FeeConfirmCard";
import AdmissionPrintViews from "@/components/admissions/AdmissionPrintViews";
import { apiFetch } from "@/lib/api";
import {
  EMPTY_EXTRAS,
  EMPTY_IDENTITY,
  type ConfirmResult,
  type FamilyLookupResult,
  type FeePreview,
  type IdentityState,
  type PlacementMeta,
  type PrevEduRow,
  type StayExtras,
  type SubjectPreview,
  type WaiverInputs,
  type WaiverSuggestion,
} from "@/lib/admissions";

const STEPS = [
  "Family & Sibling",
  "Student Identity",
  "Placement & Subjects",
  "Waivers & Residence",
  "Fee & Collection",
] as const;

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-3 py-1 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

/**
 * Direct Admission Wizard shell (Plan §2 + §4, Phase 4). All five steps
 * wired with carried state: family → identity → placement/subjects →
 * waivers/extras → atomic confirm → instant prints.
 */
export default function DirectAdmissionView() {
  const searchParams = useSearchParams();
  const draftQuery = searchParams.get("query") ?? undefined;
  const draftId = searchParams.get("draft") ?? undefined;

  const [step, setStep] = useState(0);
  const [family, setFamily] = useState<FamilyLookupResult | null>(null);
  const [institution, setInstitution] = useState("SCHOOL");
  const [identity, setIdentity] = useState<IdentityState>({ ...EMPTY_IDENTITY });
  const [prevEdus, setPrevEdus] = useState<PrevEduRow[]>([]);
  const [placement, setPlacement] = useState<PlacementMeta | null>(null);
  const [subjectPreview, setSubjectPreview] = useState<SubjectPreview | null>(null);
  const [waivers, setWaivers] = useState<WaiverSuggestion[]>([]);
  const [waiverInputs, setWaiverInputs] = useState<WaiverInputs>({});
  const [extras, setExtras] = useState<StayExtras>({ ...EMPTY_EXTRAS });
  const [draftGpa, setDraftGpa] = useState<string | undefined>(undefined);
  const [draftQuota, setDraftQuota] = useState<string | undefined>(undefined);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [confirmFeePreview, setConfirmFeePreview] = useState<FeePreview | null>(null);

  // Convert-to-draft handoff: pre-fill Step 2 identity + Step 4 GPA/quota.
  useEffect(() => {
    if (!draftId) return;
    apiFetch<{
      studentPrefill: { fullNameEn: string; fullNameBn?: string | null; gender: string; dateOfBirth: string; birthRegNo?: string | null };
      waiverPrefill: { prevGpa?: string | null; quotaTag?: string | null };
    }>(`/api/admissions/applications/${draftId}/draft`)
      .then((d) => {
        setIdentity((prev) => ({
          ...prev,
          fullNameEn: d.studentPrefill.fullNameEn ?? prev.fullNameEn,
          fullNameBn: d.studentPrefill.fullNameBn ?? prev.fullNameBn,
          gender: d.studentPrefill.gender ?? prev.gender,
          dateOfBirth: d.studentPrefill.dateOfBirth?.slice(0, 10) ?? prev.dateOfBirth,
        }));
        if (d.waiverPrefill.prevGpa) setDraftGpa(d.waiverPrefill.prevGpa);
        if (d.waiverPrefill.quotaTag) setDraftQuota(d.waiverPrefill.quotaTag);
      })
      .catch(() => {
        /* phone query still works without the draft */
      });
  }, [draftId]);

  const siblingHint =
    draftQuota ?? (family?.found && family.activeSiblings.length > 0 ? "SIBLING" : undefined);

  // Light per-step gate for the Next button — mirrors what each step needs to
  // be useful downstream (final validation still happens at confirm).
  function stepReady(i: number): boolean {
    switch (i) {
      case 0:
        return family !== null;
      case 1:
        return Boolean(
          identity.fullNameEn.trim() && identity.gender && identity.dateOfBirth && identity.religion && identity.admissionDate,
        );
      case 2:
        return placement !== null;
      default:
        return true;
    }
  }

  const STEP_HINT = [
    "Run the family lookup (guardian phone / NID) to continue",
    "Fill name, gender, DOB, religion and admission date",
    "Enter a session + class and load subjects",
    "",
    "",
  ];

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Direct Admission Wizard"
        description="Spec §4 — 5-step onboarding: family → student → subjects → waiver → invoice & POS"
      />

      <ol className="flex flex-wrap items-center gap-1.5 border-b border-ink-100 pb-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-xs border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                i === step
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-ink-200 bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && <FamilyLookupCard initialQuery={draftQuery} onResult={setFamily} />}

      {step === 1 && (
        <Step2FormCard
          institution={institution}
          onInstitutionChange={setInstitution}
          value={identity}
          prevEdus={prevEdus}
          onChange={(id, rows) => {
            setIdentity(id);
            setPrevEdus(rows);
          }}
          familyCode={family?.found ? family.family.familyCode : undefined}
          familyZakat={family?.found ? family.family.isZakatEligibleFamily : null}
        />
      )}

      {step === 2 && (
        <SubjectPickerCard
          onSelect={(ids, meta, preview) => {
            setPlacement({ ...meta, subjectIds: ids });
            setSubjectPreview(preview);
          }}
        />
      )}

      {step === 3 && (
        <div className="space-y-4">
          <WaiverCalculatorCard
            familyId={family?.found ? family.family.id : undefined}
            familyCode={family?.found ? family.family.familyCode : undefined}
            initialQuota={siblingHint}
            initialGpa={draftGpa}
            institution={institution}
            onSelect={(selected, inputs) => {
              setWaivers(selected);
              setWaiverInputs(inputs);
            }}
          />
          <StayExtrasCard value={extras} onChange={setExtras} isMadrasah={institution === "MADRASAH"} />
        </div>
      )}

      {step === 4 && (
        <FeeConfirmCard
          family={family}
          placement={placement}
          waiverInputs={waiverInputs}
          waiverRuleCodes={waivers.map((w) => w.ruleCode)}
          identity={identity}
          prevEdus={prevEdus}
          extras={extras}
          institution={institution}
          applicationId={draftId}
          onDone={(res, pv) => {
            setConfirmResult(res);
            setConfirmFeePreview(pv);
          }}
        />
      )}

      {!confirmResult && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
          <button type="button" className={BTN_GHOST} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            ← Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {step < STEPS.length - 1 && !stepReady(step) && (
              <span className="text-[11px] text-ink-500">{STEP_HINT[step]}</span>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className={BTN} disabled={!stepReady(step)} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Next: {STEPS[step + 1]} →
              </button>
            ) : (
              <span className="text-[11px] text-ink-500">Use the confirm buttons above to admit.</span>
            )}
          </div>
        </div>
      )}

      {confirmResult && (
        <AdmissionPrintViews
          result={confirmResult}
          identity={identity}
          family={family}
          placement={placement}
          subjectPreview={subjectPreview}
          pickedIds={placement?.subjectIds ?? []}
          feePreview={confirmFeePreview}
          institution={institution}
        />
      )}

      {!confirmResult && step !== 0 && (
        <DashCard title="Carry-over">
          <p className="text-xs text-ink-500">
            {family?.found ? `Family ${family.family.familyCode} · ` : "New family · "}
            {identity.fullNameEn || "identity pending in Step 2"} ·{" "}
            {placement ? `${placement.subjectIds.length} subject(s)` : "subjects pending in Step 3"} ·{" "}
            {waivers.length > 0 ? `waivers ${waivers.map((w) => w.ruleCode).join(", ")}` : "waivers pending in Step 4"}
          </p>
        </DashCard>
      )}
    </div>
  );
}
