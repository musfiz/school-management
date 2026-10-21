"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FiEye, FiLoader, FiRefreshCcw, FiSearch, FiShieldOff, FiUsers } from "react-icons/fi";
import { RiShieldCheckLine } from "react-icons/ri";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import FamilyLookupCard from "@/components/admissions/FamilyLookupCard";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { FamilyDirectoryRow, FamilyProfile } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const MODAL_BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const ZAKAT_FILTER = [
  { value: "true", label: "Zakat-verified only" },
  { value: "false", label: "Not verified only" },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  TC_ISSUED: "bg-rose-100 text-rose-700",
  GRADUATED: "bg-sky-100 text-sky-800",
  DROPPED: "bg-slate-200 text-slate-600",
  SUSPENDED: "bg-amber-100 text-amber-800",
};

/**
 * Phase 2 — Families Directory (Plan §3.2).
 * Parent/guardian master with phone/code/NID search, the Workflow 1 quick
 * lookup, a multi-sibling linkage viewer, and the zakat-eligibility gate for
 * Fund 02 (Lillah) Madrasah boarding.
 */
export default function FamiliesView() {
  const [rows, setRows] = useState<FamilyDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState("");
  const [zakat, setZakat] = useState("");

  // detail drawer
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FamilyDirectoryRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (zakat) params.set("zakatEligible", zakat);
      setRows(await apiFetch<FamilyDirectoryRow[]>(`/api/admissions/families?${params.toString()}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load families", "error");
    } finally {
      setLoading(false);
    }
  }, [search, zakat]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(
    () => ({
      total: rows.length,
      zakat: rows.filter((r) => r.isZakatEligibleFamily).length,
      multi: rows.filter((r) => r.childCount >= 2).length,
      children: rows.reduce((n, r) => n + r.childCount, 0),
    }),
    [rows],
  );

  async function openDetail(id: string) {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await apiFetch<FamilyDirectoryRow>(`/api/admissions/families/${id}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load family", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
  }

  async function verify(next: boolean) {
    if (!detail) return;
    setVerifying(true);
    try {
      const updated = await apiFetch<FamilyProfile>(`/api/admissions/families/${detail.id}/verify`, {
        method: "PATCH",
        body: JSON.stringify({ zakatEligible: next }),
      });
      setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
      setRows((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, isZakatEligibleFamily: updated.isZakatEligibleFamily } : r)),
      );
      toast(next ? "Family marked zakat-eligible (Fund 02 unlocked)" : "Zakat eligibility removed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Verification failed", "error");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Families Directory"
        description="Spec §3.2 — parent/guardian master, NID/phone lookup, multi-sibling linkage viewer"
      />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Families in view" value={String(kpis.total)} />
        <Tile label="Zakat-verified" value={String(kpis.zakat)} tone="text-emerald-700" />
        <Tile label="Multi-sibling" value={String(kpis.multi)} tone="text-brand-700" />
        <Tile label="Linked students" value={String(kpis.children)} />
      </div>

      {/* Workflow 1 — quick phone/NID lookup (opens the family drawer on a hit). */}
      <FamilyLookupCard
        onResult={(result) => {
          if (result.found) openDetail(result.family.id);
        }}
      />

      <DashCard title="Filter families">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0 sm:col-span-2 2xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Search (phone / code / father / mother / NID)
            </label>
            <input
              className={INPUT}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="e.g. 01712… / FAM-2026-00891 / Rahman"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Zakat status</label>
            <SearchSelect
              options={ZAKAT_FILTER}
              value={zakat}
              onChange={setZakat}
              placeholder="All families…"
              isClearable
              ariaLabel="Zakat eligibility filter"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-2">
            <button type="button" className={BTN} disabled={loading} onClick={load}>
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <FiLoader className="h-3.5 w-3.5 animate-spin" /> Loading…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <FiSearch className="h-3.5 w-3.5" /> Run
                </span>
              )}
            </button>
            <button type="button" className={BTN_GHOST} disabled={loading} onClick={load}>
              <span className="inline-flex items-center gap-1">
                <FiRefreshCcw className="h-3.5 w-3.5" /> Refresh
              </span>
            </button>
          </div>
        </div>
      </DashCard>

      <DashCard title={`Family registry (${rows.length})`}>
        {loading && rows.length === 0 ? (
          <AdminPageLoader variant="inline" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">
            No families match — admit a student via the Direct Admission Wizard to create one.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Family</th>
                  <th className="px-2.5 py-1.5 font-semibold">Primary guardian</th>
                  <th className="px-2.5 py-1.5 font-semibold">Father</th>
                  <th className="px-2.5 py-1.5 font-semibold">Mother</th>
                  <th className="px-2.5 py-1.5 font-semibold">Area</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Children</th>
                  <th className="px-2.5 py-1.5 font-semibold">Zakat</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1">
                      <span className="font-mono font-medium">{r.familyCode}</span>
                    </td>
                    <td className="px-2.5 py-1 font-mono text-ink-600">{r.primaryGuardianPhone}</td>
                    <td className="px-2.5 py-1">
                      <span className="font-medium">{r.fatherNameEn}</span>
                      {r.isFatherDeceased && (
                        <span className="ml-1 rounded-xs bg-slate-200 px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                          DECEASED
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1 text-ink-600">{r.motherNameEn}</td>
                    <td className="px-2.5 py-1 text-ink-600">
                      {r.upazilaThana || r.district ? `${r.upazilaThana ?? "—"}, ${r.district ?? "—"}` : "—"}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono">
                      <span className="font-bold">{r.activeChildCount}</span>
                      <span className="text-ink-400"> / {r.childCount}</span>
                    </td>
                    <td className="px-2.5 py-1">
                      {r.isZakatEligibleFamily ? (
                        <span className="rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          VERIFIED
                        </span>
                      ) : (
                        <span className="rounded-xs bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          NOT VERIFIED
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1">
                      <button type="button" className={BTN_GHOST} onClick={() => openDetail(r.id)}>
                        <span className="inline-flex items-center gap-1">
                          <FiEye className="h-3 w-3" /> View
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

      {/* ── Family detail drawer ── */}
      {detailId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
          onClick={closeDetail}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xs bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <AdminPageLoader variant="inline" />
            ) : detail ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono text-base font-semibold text-ink-900">{detail.familyCode}</h3>
                  <span
                    className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                      detail.isZakatEligibleFamily
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {detail.isZakatEligibleFamily ? "ZAKAT-VERIFIED (Fund 02)" : "NOT ZAKAT-VERIFIED"}
                  </span>
                </div>

                <div className="mt-3 space-y-3 text-xs">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label="Father (EN)" value={detail.fatherNameEn} />
                    <Field label="Father (BN)" value={detail.fatherNameBn ?? "—"} />
                    <Field label="Father NID" value={detail.fatherNid ?? "—"} />
                    <Field label="Father occupation" value={detail.fatherOccupation ?? "—"} />
                    <Field label="Father income (BDT)" value={detail.fatherMonthlyIncome} />
                    <Field label="Father deceased" value={detail.isFatherDeceased ? "Yes" : "No"} />
                    <Field label="Mother (EN)" value={detail.motherNameEn} />
                    <Field label="Mother (BN)" value={detail.motherNameBn ?? "—"} />
                    <Field label="Mother NID" value={detail.motherNid ?? "—"} />
                    <Field label="Mother phone" value={detail.motherPhone ?? "—"} />
                    <Field label="Mother occupation" value={detail.motherOccupation ?? "—"} />
                    <Field label="Primary phone (login/SMS)" value={detail.primaryGuardianPhone} />
                  </div>

                  <Section title="Local guardian">
                    <p>
                      {detail.localGuardianName
                        ? `${detail.localGuardianName} (${detail.localGuardianRelation ?? "—"}) · ${detail.localGuardianPhone ?? "—"}`
                        : "—"}
                    </p>
                    <p className="text-ink-500">NID {detail.localGuardianNid ?? "—"}</p>
                  </Section>

                  <Section title="Address">
                    <p>{detail.presentAddress}</p>
                    <p className="text-ink-500">
                      Permanent: {detail.permanentAddress ?? "—"}
                    </p>
                    <p className="text-ink-500">
                      Area: {detail.upazilaThana ?? "—"}, {detail.district ?? "—"}
                    </p>
                  </Section>

                  {detail.activeChildCount >= 1 && (
                    <p className="rounded-xs border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-900">
                      <span className="font-semibold">Sibling waiver applies</span> to any new admission in this family —
                      25% off Admission Fee + 20% off Monthly Tuition ({detail.activeChildCount} active child
                      {detail.activeChildCount === 1 ? "" : "ren"} on record).
                    </p>
                  )}

                  <Section title={`Children / siblings (${detail.children.length})`}>
                    {detail.children.length === 0 ? (
                      <p className="inline-flex items-center gap-1.5 text-ink-500">
                        <FiUsers className="h-3.5 w-3.5" /> No students linked yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-xs border border-ink-100">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-ink-50 text-ink-700">
                            <tr>
                              <th className="px-2.5 py-1.5 font-semibold">Student</th>
                              <th className="px-2.5 py-1.5 font-semibold">Status</th>
                              <th className="px-2.5 py-1.5 font-semibold">Placement</th>
                              <th className="px-2.5 py-1.5 text-right font-semibold">Roll</th>
                              <th className="px-2.5 py-1.5 font-semibold">Group / Quota</th>
                              <th className="px-2.5 py-1.5 font-semibold">Residence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100 bg-white">
                            {detail.children.map((c) => (
                              <tr key={c.studentId} className="hover:bg-ink-50">
                                <td className="px-2.5 py-1">
                                  <span className="font-medium">{c.name}</span>
                                  <span className="block font-mono text-ink-500">{c.studentUniqueId}</span>
                                </td>
                                <td className="px-2.5 py-1">
                                  <span
                                    className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                                      STATUS_BADGE[c.currentStatus] ?? "bg-slate-200 text-slate-600"
                                    }`}
                                  >
                                    {c.currentStatus}
                                  </span>
                                </td>
                                <td
                                  className="px-2.5 py-1 font-mono text-ink-500"
                                  title={
                                    c.classOrDeptId
                                      ? `${c.classOrDeptId} · ${c.sectionOrBatchId ?? "no section"}`
                                      : "no active enrollment"
                                  }
                                >
                                  {c.classOrDeptId
                                    ? `${c.classOrDeptId.slice(0, 8)} · ${c.sectionOrBatchId?.slice(0, 8) ?? "—"}`
                                    : "—"}
                                </td>
                                <td className="px-2.5 py-1 text-right font-mono">{c.classRollNo ?? "—"}</td>
                                <td className="px-2.5 py-1">
                                  {c.academicGroup ?? "—"}
                                  <span className="block text-ink-500">{c.quotaTag ?? "—"}</span>
                                </td>
                                <td className="px-2.5 py-1 text-ink-600">{c.residenceType ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Section>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => verify(!detail.isZakatEligibleFamily)}
                    className="inline-flex items-center gap-1.5 rounded-xs border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                  >
                    {verifying ? (
                      <FiLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : detail.isZakatEligibleFamily ? (
                      <FiShieldOff className="h-3.5 w-3.5" />
                    ) : (
                      <RiShieldCheckLine className="h-3.5 w-3.5" />
                    )}
                    {detail.isZakatEligibleFamily ? "Remove verification" : "Verify zakat eligibility"}
                  </button>
                  <button type="button" className={MODAL_BTN_GHOST} onClick={closeDetail}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-500">Could not load family.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xs border border-ink-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase text-ink-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${tone ?? "text-ink-900"}`}>{value}</p>
    </div>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-semibold text-ink-700">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
