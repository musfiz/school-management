"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Calculator, Loader2 } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashPage";
import SearchSelect from "@/components/ui/SearchSelect";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type {
  ConfirmResult,
  FamilyLookupResult,
  FeePreview,
  FeeSuggestItem,
  IdentityState,
  PlacementMeta,
  PrevEduRow,
  StayExtras,
  WaiverInputs,
} from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_OUTLINE =
  "rounded-xs border border-brand-600 bg-white px-3 py-1 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50";

const ENROLL_TYPES = ["NEW_ADMISSION", "PROMOTED", "REPEAT", "READMISSION"].map((v) => ({
  value: v,
  label: v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
}));
const CHANNELS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_CHALLAN", label: "Bank challan" },
  { value: "BKASH", label: "bKash" },
  { value: "NAGAD", label: "Nagad" },
  { value: "ROCKET", label: "Rocket" },
  { value: "UPAY", label: "Upay" },
  { value: "SSLCOMMERZ", label: "SSLCommerz" },
  { value: "EKPAY", label: "EkPay" },
];
const MFS = new Set(["BKASH", "NAGAD", "ROCKET", "UPAY", "SSLCOMMERZ", "EKPAY"]);

interface Props {
  family: FamilyLookupResult | null;
  placement: PlacementMeta | null;
  waiverInputs: WaiverInputs;
  waiverRuleCodes: string[];
  identity: IdentityState;
  prevEdus: PrevEduRow[];
  extras: StayExtras;
  /** Institution mode locked in Step 2 — authoritative for the enrollment. */
  institution?: string;
  /** Source application id — closes the pipeline loop (status → ADMITTED). */
  applicationId?: string;
  onDone?: (result: ConfirmResult, preview: FeePreview | null) => void;
}

/**
 * Workflow 4 — Step 5: Admission Fee Breakdown & Instant Collection
 * (Plan §4 Workflow 4). Identity (Step 2), placement (Step 3) and waivers
 * (Step 4) arrive as carried state — this card only adds the fee table,
 * dry preview and the two atomic confirm paths.
 */
export default function FeeConfirmCard({ family, placement, waiverInputs, waiverRuleCodes, identity, prevEdus, extras, institution, applicationId, onDone }: Props) {
  const [enrollType, setEnrollType] = useState("NEW_ADMISSION");
  // new-family basics (Step 1 found → hidden)
  const [fPhone, setFPhone] = useState("");
  const [fFather, setFFather] = useState("");
  const [fMother, setFMother] = useState("");
  const [fAddr, setFAddr] = useState("");
  // fees
  const [suggest, setSuggest] = useState<FeeSuggestItem[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<FeePreview | null>(null);
  const [dirty, setDirty] = useState(true);
  // collect-now
  const [channel, setChannel] = useState("CASH");
  const [trxId, setTrxId] = useState("");
  const [collectAmt, setCollectAmt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<ConfirmResult | null>(null);

  useEffect(() => {
    apiFetch<FeeSuggestItem[]>("/api/admissions/onboarding/fee-suggest")
      .then((items) => {
        setSuggest(items);
        setChecked(new Set(items.map((i) => i.feeHeadId)));
        setAmounts(Object.fromEntries(items.map((i) => [i.feeHeadId, i.grossAmount])));
      })
      .catch((e) => toast(e instanceof Error ? e.message : "Failed to load fee heads", "error"));
  }, []);

  function toggleHead(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    setDirty(true);
  }

  function feeItems() {
    return suggest
      .filter((s) => checked.has(s.feeHeadId))
      .map((s) => ({ feeHeadId: s.feeHeadId, amount: (amounts[s.feeHeadId] ?? "").trim() || s.grossAmount }));
  }

  async function runPreview(): Promise<FeePreview | null> {
    if (!family) {
      toast("Run Step 1 lookup first", "error");
      return null;
    }
    setBusy("preview");
    try {
      const data = await apiFetch<FeePreview>("/api/admissions/onboarding/fee-preview", {
        method: "POST",
        body: JSON.stringify({
          feeItems: feeItems(),
          waiverInputs,
          familyId: family.found ? family.family.id : undefined,
          applyWaiverRuleCodes: waiverRuleCodes,
          admissionDate: identity.admissionDate || undefined,
        }),
      });
      setPreview(data);
      setDirty(false);
      if (!collectAmt) setCollectAmt(data.totals.net);
      return data;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Preview failed", "error");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function confirm(payNow: boolean) {
    if (!family || !placement) {
      toast("Complete Steps 1 and 3 first (family + placement)", "error");
      return;
    }
    if (!identity.fullNameEn.trim() || !identity.gender || !identity.dateOfBirth || !identity.religion || !identity.admissionDate) {
      toast("Complete Step 2 first (name, gender, DOB, religion, admission date)", "error");
      return;
    }
    let pv = preview;
    if (!pv || dirty) {
      pv = await runPreview();
      if (!pv) return;
    }
    if (payNow && MFS.has(channel) && !trxId.trim()) {
      toast(`${channel} needs a gateway transaction ID`, "error");
      return;
    }
    const clean = (v: string) => (v.trim() === "" ? undefined : v.trim());
    setBusy(payNow ? "collect" : "later");
    try {
      const body = {
        family: family.found
          ? { familyId: family.family.id }
          : {
              primaryGuardianPhone: fPhone.trim(),
              fatherNameEn: fFather.trim(),
              motherNameEn: fMother.trim(),
              presentAddress: fAddr.trim(),
            },
        student: {
          fullNameEn: identity.fullNameEn.trim(),
          fullNameBn: clean(identity.fullNameBn),
          gender: identity.gender,
          dateOfBirth: identity.dateOfBirth,
          birthRegNo: clean(identity.birthRegNo),
          nationalIdNo: clean(identity.nationalIdNo),
          religion: identity.religion,
          bloodGroup: clean(identity.bloodGroup),
          photoUrl: clean(identity.photoUrl),
          medicalAllergyNotes: clean(identity.medicalAllergyNotes),
          stipendMfsType: clean(extras.stipendMfsType),
          stipendAccountNo: clean(extras.stipendAccountNo),
          pickupGuardianName: clean(identity.pickupGuardianName),
          pickupGuardianPhone: clean(identity.pickupGuardianPhone),
          admissionDate: identity.admissionDate,
        },
        previousEducations: prevEdus
          .filter((r) => r.examTitle && r.instituteName.trim())
          .map((r) => ({
            examTitle: r.examTitle,
            instituteName: r.instituteName.trim(),
            educationBoard: clean(r.educationBoard),
            academicGroup: clean(r.academicGroup),
            rollNo: clean(r.rollNo),
            regNo: clean(r.regNo),
            passingYear: r.passingYear.trim() === "" ? undefined : Number(r.passingYear),
            gpaObtained: clean(r.gpaObtained),
            tcNumber: clean(r.tcNumber),
          })),
        placement: {
          academicSessionId: placement.sessionId,
          classOrDeptId: placement.classId,
          institutionType: institution || waiverInputs.institutionType || "SCHOOL",
          shiftId: placement.shiftId || undefined,
          sectionOrBatchId: placement.sectionId || undefined,
          academicGroup: placement.group || "GENERAL",
          enrollmentType: enrollType,
          residenceType: waiverInputs.residenceType || "DAY_SCHOLAR",
          quotaTag: waiverInputs.quotaTag || "NONE",
          hostelSeatId: clean(extras.hostelSeatId),
          transportRouteId: clean(extras.transportRouteId),
          syllabusSubjectIds: placement.subjectIds,
        },
        waiverInputs,
        applyWaiverRuleCodes: waiverRuleCodes,
        feeItems: feeItems(),
        applicationId: applicationId || undefined,
        collectNow: payNow
          ? {
              paymentChannel: channel,
              amount: collectAmt.trim() || pv.totals.net,
              gatewayTrxId: trxId.trim() || null,
              remark: `Admission POS — Step 5 (${channel})`,
            }
          : null,
      };
      const res = await apiFetch<ConfirmResult>("/api/admissions/onboarding/confirm", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setDone(res);
      onDone?.(res, pv);
      toast(
        payNow
          ? `Admitted ${res.studentUniqueId} — receipt ${res.moneyReceiptNo}`
          : `Admitted ${res.studentUniqueId} — invoice ${res.invoiceNo}`,
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Admission failed — nothing was saved", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!placement) {
    return (
      <DashCard title="Step 5 — Admission Fee Breakdown & Instant Collection">
        <p className="text-sm text-ink-500">
          Complete Step 3 first (enter a session + class and load subjects) — the fee breakdown needs the placement.
        </p>
      </DashCard>
    );
  }

  return (
    <DashCard title="Step 5 — Admission Fee Breakdown & Instant Collection">
      {done && (
        <p className="mb-3 flex flex-wrap items-center gap-2 rounded-xs border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
          <BadgeCheck className="h-4 w-4" />
          Admitted {done.studentUniqueId} (roll {done.classRollNo}) — invoice {done.invoiceNo}:
          net {done.netAmount} BDT
          {done.moneyReceiptNo ? ` — receipt ${done.moneyReceiptNo}` : " — pay later"}
          . Print views are below the wizard.
        </p>
      )}

      <p className="mb-2 text-xs text-ink-500">
        Admitting <span className="font-semibold text-ink-700">{identity.fullNameEn || "—"}</span>
        {family?.found ? ` · family ${family.family.familyCode}` : " · new family (fill parents below)"}
        {` · ${placement.subjectIds.length} subject(s)`}
        {waiverRuleCodes.length > 0 ? ` · waivers ${waiverRuleCodes.join(", ")}` : " · no waivers"}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Enrollment</label>
          <SearchSelect options={ENROLL_TYPES} value={enrollType} onChange={setEnrollType} ariaLabel="Enrollment type" />
        </div>
      </div>

      {family && !family.found && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Guardian phone *</label>
            <input className={INPUT} value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Father name (EN) *</label>
            <input className={INPUT} value={fFather} onChange={(e) => setFFather(e.target.value)} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Mother name (EN) *</label>
            <input className={INPUT} value={fMother} onChange={(e) => setFMother(e.target.value)} />
          </div>
          <div className="min-w-0 sm:col-span-2 2xl:col-span-3">
            <label className="mb-1 block text-xs font-medium text-ink-700">Present address *</label>
            <input className={INPUT} value={fAddr} onChange={(e) => setFAddr(e.target.value)} />
          </div>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-xs border border-ink-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-ink-50 text-ink-700">
            <tr>
              <th className="px-2.5 py-1.5 font-semibold">Fee head</th>
              <th className="px-2.5 py-1.5 font-semibold">Type</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Gross</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Waiver</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {suggest.map((s) => {
              const line = preview?.lines.find((l) => l.feeHeadId === s.feeHeadId);
              const on = checked.has(s.feeHeadId);
              return (
                <tr key={s.feeHeadId} className="hover:bg-ink-50">
                  <td className="px-2.5 py-1">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="cursor-pointer" checked={on} onChange={() => toggleHead(s.feeHeadId)} />
                      <span className={on ? "" : "text-ink-400 line-through"}>
                        {s.headCode} — {s.headName}
                        {s.isCautionDeposit && <span className="text-ink-400"> (caution, never waived)</span>}
                      </span>
                    </label>
                  </td>
                  <td className="px-2.5 py-1 text-ink-500">{s.billingType}</td>
                  <td className="px-2.5 py-1 text-right">
                    <input
                      className={`${INPUT} !w-28 text-right font-mono`}
                      value={amounts[s.feeHeadId] ?? s.grossAmount}
                      onChange={(e) => { setAmounts((a) => ({ ...a, [s.feeHeadId]: e.target.value })); setDirty(true); }}
                    />
                  </td>
                  <td className="px-2.5 py-1 text-right font-mono">{line && on ? line.waiver : "—"}</td>
                  <td className="px-2.5 py-1 text-right font-mono">{line && on ? line.net : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          {preview && (
            <tfoot>
              <tr className="border-t-2 border-ink-300 bg-ink-100 font-semibold">
                <td className="px-2.5 py-1" colSpan={2}>Total payable (BDT)</td>
                <td className="px-2.5 py-1 text-right font-mono">{preview.totals.gross}</td>
                <td className="px-2.5 py-1 text-right font-mono">{preview.totals.waiver}</td>
                <td className="px-2.5 py-1 text-right font-mono">{preview.totals.net}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {preview && preview.appliedWaivers.length > 0 && (
        <p className="mt-1 text-xs text-ink-500">
          Applied: {preview.appliedWaivers.map((w) => `${w.ruleCode} (${w.admissionFeePct}% adm + ${w.tuitionFeePct}% tui)`).join(" · ")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <button type="button" className={BTN_OUTLINE} disabled={busy !== null} onClick={() => runPreview()}>
          {busy === "preview" ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Previewing…</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5" /> Preview breakdown</span>
          )}
        </button>
        <button type="button" className={BTN_OUTLINE} disabled={busy !== null} onClick={() => confirm(false)}>
          {busy === "later" ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Admitting…</span>
          ) : (
            "Confirm Admission & Generate Invoice (Pay Later)"
          )}
        </button>
        <div className="flex flex-wrap items-end gap-1.5 rounded-xs border border-ink-200 p-2">
          <div className="w-36">
            <SearchSelect options={CHANNELS} value={channel} onChange={setChannel} ariaLabel="Payment channel" />
          </div>
          {MFS.has(channel) && (
            <input className={`${INPUT} !w-36`} placeholder="Gateway trx ID" value={trxId} onChange={(e) => setTrxId(e.target.value)} />
          )}
          <input
            className={`${INPUT} !w-28 text-right font-mono`}
            placeholder={preview?.totals.net ?? "Amount"}
            value={collectAmt}
            onChange={(e) => setCollectAmt(e.target.value)}
          />
          <button type="button" className={BTN} disabled={busy !== null} onClick={() => confirm(true)}>
            {busy === "collect" ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Admitting…</span>
            ) : (
              "Confirm & Collect Now (Cash / bKash / Bank)"
            )}
          </button>
        </div>
      </div>
    </DashCard>
  );
}
