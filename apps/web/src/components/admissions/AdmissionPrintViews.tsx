"use client";

import { Printer } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashPage";
import { printElement } from "@/lib/print";
import { resolveImageUrl } from "@/lib/media";
import type {
  ConfirmResult,
  FamilyLookupResult,
  FeePreview,
  IdentityState,
  PlacementMeta,
  SubjectPreview,
} from "@/lib/admissions";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50";

interface Props {
  result: ConfirmResult;
  identity: IdentityState;
  family: FamilyLookupResult | null;
  placement: PlacementMeta | null;
  subjectPreview: SubjectPreview | null;
  pickedIds: string[];
  feePreview: FeePreview | null;
  institution: string;
}

/**
 * Phase 4 — instant print views (Plan §4): A4 admission form (photo,
 * subject list, signature blocks), admission money receipt, ID card
 * preview. Printed via the repo-standard printElement (isolated iframe).
 */
export default function AdmissionPrintViews({ result, identity, family, placement, subjectPreview, pickedIds, feePreview, institution }: Props) {
  const fam = family?.found ? family.family : null;
  const pickedRows = (() => {
    if (!subjectPreview) return [];
    const all = [
      ...subjectPreview.compulsory,
      ...subjectPreview.groupElectives,
      ...subjectPreview.fourthOptions,
      ...subjectPreview.nonCredit,
    ];
    return all.filter((r) => pickedIds.includes(r.syllabusSubjectId));
  })();
  const photo = resolveImageUrl(identity.photoUrl);
  const paid = result.moneyReceiptNo ? result.netAmount : "0.00";

  return (
    <DashCard title="Print — admission form, receipt & ID card">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button type="button" className={BTN_GHOST} onClick={() => printElement("printable-admission-form", `Admission-Form-${result.studentUniqueId}`)}>
          <span className="inline-flex items-center gap-1"><Printer className="h-3.5 w-3.5" /> Admission form (A4)</span>
        </button>
        <button type="button" className={BTN_GHOST} onClick={() => printElement("printable-admission-receipt", `Receipt-${result.moneyReceiptNo ?? result.invoiceNo}`)}>
          <span className="inline-flex items-center gap-1"><Printer className="h-3.5 w-3.5" /> Money receipt</span>
        </button>
        <button type="button" className={BTN_GHOST} onClick={() => printElement("printable-student-id", `ID-Card-${result.studentUniqueId}`)}>
          <span className="inline-flex items-center gap-1"><Printer className="h-3.5 w-3.5" /> ID card</span>
        </button>
      </div>

      {/* ── A4 admission form ── */}
      <div id="printable-admission-form" className="rounded-xs border border-ink-200 bg-white p-4 text-xs text-ink-900">
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink-900 pb-2">
          <div>
            <p className="text-base font-bold">Student Admission Form</p>
            <p className="text-ink-600">{institution || "—"} · Session admission {result.invoiceNo} · Roll {result.classRollNo}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-bold">{result.studentUniqueId}</p>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Student" style={{ width: 80, height: 96, objectFit: "cover", border: "1px solid #000", marginTop: 4 }} />
            ) : (
              <p className="mt-1 border border-ink-300 px-2 py-4 text-ink-400">Photo</p>
            )}
          </div>
        </div>
        <FormGrid
          title="Student"
          rows={[
            ["Name (EN)", identity.fullNameEn],
            ["Name (BN)", identity.fullNameBn || "—"],
            ["Gender / DOB", `${identity.gender} / ${identity.dateOfBirth}`],
            ["BRN / Religion", `${identity.birthRegNo || "—"} / ${identity.religion}`],
            ["Blood / Allergy", `${identity.bloodGroup || "—"} / ${identity.medicalAllergyNotes || "—"}`],
            ["Admission date", identity.admissionDate],
          ]}
        />
        <FormGrid
          title={`Family (${result.familyCode})`}
          rows={[
            ["Father", fam ? `${fam.fatherNameEn}${fam.fatherNid ? ` · NID ${fam.fatherNid}` : ""}` : "—"],
            ["Mother", fam ? `${fam.motherNameEn}${fam.motherPhone ? ` · ${fam.motherPhone}` : ""}` : "—"],
            ["Guardian phone", fam?.primaryGuardianPhone ?? "—"],
            ["Address", fam?.presentAddress ?? "—"],
          ]}
        />
        <div className="mt-2">
          <p className="font-bold">Enrolled subjects ({pickedRows.length})</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
            <tbody>
              {pickedRows.map((r) => (
                <tr key={r.syllabusSubjectId} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "2px 4px" }}>{r.subjectCode} — {r.subjectName}{r.paperNumber ? ` (P${r.paperNumber})` : ""}</td>
                  <td style={{ padding: "2px 4px", textAlign: "right" }}>{r.defaultRole}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <p className="font-bold">Admission fees (BDT)</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
            <tbody>
              {(feePreview?.lines ?? []).map((l) => (
                <tr key={l.feeHeadId} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "2px 4px" }}>{l.headCode}</td>
                  <td style={{ padding: "2px 4px", textAlign: "right" }}>{l.gross}</td>
                  <td style={{ padding: "2px 4px", textAlign: "right" }}>−{l.waiver}</td>
                  <td style={{ padding: "2px 4px", textAlign: "right" }}>{l.net}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: "bold" }}>
                <td style={{ padding: "2px 4px" }}>Net payable</td>
                <td style={{ padding: "2px 4px", textAlign: "right" }}>{result.grossAmount}</td>
                <td style={{ padding: "2px 4px", textAlign: "right" }}>−{result.waiverAmount}</td>
                <td style={{ padding: "2px 4px", textAlign: "right" }}>{result.netAmount}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-16 flex justify-between gap-6">
          {["Guardian signature", "Admission officer", "Principal / Head"].map((s) => (
            <p key={s} className="flex-1 border-t border-ink-900 pt-1 text-center">{s}</p>
          ))}
        </div>
      </div>

      {/* ── Money receipt ── */}
      <div id="printable-admission-receipt" className="mt-4 rounded-xs border border-ink-200 bg-white p-4 text-xs text-ink-900">
        <p className="text-center text-base font-bold">Admission Money Receipt</p>
        <p className="text-center font-mono">{result.moneyReceiptNo ?? result.invoiceNo}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ddd" }}><td style={{ padding: "2px 4px" }}>Received from</td><td style={{ padding: "2px 4px", fontWeight: "bold" }}>{identity.fullNameEn} ({result.studentUniqueId})</td></tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}><td style={{ padding: "2px 4px" }}>Invoice</td><td style={{ padding: "2px 4px", fontFamily: "monospace" }}>{result.invoiceNo}</td></tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}><td style={{ padding: "2px 4px" }}>Gross / Waiver / Net (BDT)</td><td style={{ padding: "2px 4px", fontFamily: "monospace" }}>{result.grossAmount} / −{result.waiverAmount} / {result.netAmount}</td></tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}><td style={{ padding: "2px 4px" }}>Paid now (BDT)</td><td style={{ padding: "2px 4px", fontFamily: "monospace", fontWeight: "bold" }}>{paid}</td></tr>
            <tr><td style={{ padding: "2px 4px" }}>Due (BDT)</td><td style={{ padding: "2px 4px", fontFamily: "monospace" }}>{(Number(result.netAmount) - Number(paid)).toFixed(2)}</td></tr>
          </tbody>
        </table>
        <div className="mt-12 flex justify-between gap-6">
          {["Cashier", "Guardian"].map((s) => (
            <p key={s} className="flex-1 border-t border-ink-900 pt-1 text-center">{s}</p>
          ))}
        </div>
      </div>

      {/* ── ID card ── */}
      <div className="mt-4">
        <div id="printable-student-id" style={{ width: 320, border: "2px solid #000", borderRadius: 4, padding: 8, display: "flex", gap: 8, background: "#fff", color: "#000" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="ID photo" style={{ width: 64, height: 76, objectFit: "cover", border: "1px solid #000" }} />
          ) : (
            <div style={{ width: 64, height: 76, border: "1px solid #000" }} />
          )}
          <div style={{ fontSize: 11, lineHeight: 1.5 }}>
            <p style={{ fontWeight: "bold", fontSize: 13 }}>{identity.fullNameEn}</p>
            <p>ID: <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{result.studentUniqueId}</span></p>
            <p>Group: {placement?.group || "—"} · Roll: {result.classRollNo}</p>
            <p>Guardian: {fam?.primaryGuardianPhone ?? "—"}</p>
          </div>
        </div>
      </div>
    </DashCard>
  );
}

function FormGrid({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="mt-2">
      <p className="font-bold">{title}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "2px 4px", width: 140, color: "#444" }}>{k}</td>
              <td style={{ padding: "2px 4px", fontWeight: 600 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
