"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Save, X } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import SearchSelect from "@/components/ui/SearchSelect";
import DatePickerField, { todayISO } from "@/components/ui/DatePicker";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { AdmissionCampaign } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

/** Page-level secondary action (30px, same height as the primary button). */
const BTN_SECONDARY =
  "rounded-xs border border-ink-200 bg-white px-3 py-1 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

const ACTIVE_OPTS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Closed" },
];

interface FormState {
  academicSessionId: string;
  classOrDeptId: string;
  campaignTitle: string;
  applicationFee: string;
  totalSeats: string;
  minRequiredGpa: string;
  startDate: string;
  endDate: string;
  isActive: string;
}

const EMPTY_FORM: FormState = {
  academicSessionId: "",
  classOrDeptId: "",
  campaignTitle: "",
  applicationFee: "0",
  totalSeats: "",
  minRequiredGpa: "0",
  startDate: todayISO(),
  endDate: todayISO(),
  isActive: "true",
};

/**
 * Phase 2 — Campaigns & Circulars. CRUD over
 * `/admissions/campaigns`: circular title, class/dept, seat capacity,
 * eligibility GPA, application window and prospectus/form fee (→ GL 44102
 * when collected from the Applications pipeline).
 */
export default function CampaignsView() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<AdmissionCampaign[]>([]);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCampaigns(await apiFetch<AdmissionCampaign[]>("/api/admissions/campaigns"));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load campaigns", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  function reset() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  }

  function startEdit(c: AdmissionCampaign) {
    setEditingId(c.id);
    setForm({
      academicSessionId: c.academicSessionId,
      classOrDeptId: c.classOrDeptId,
      campaignTitle: c.campaignTitle,
      applicationFee: c.applicationFee,
      totalSeats: String(c.totalSeats),
      minRequiredGpa: c.minRequiredGpa,
      startDate: c.startDate?.slice(0, 10) ?? todayISO(),
      endDate: c.endDate?.slice(0, 10) ?? todayISO(),
      isActive: c.isActive ? "true" : "false",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.campaignTitle.trim()) {
      toast("Campaign title is required", "error");
      return;
    }
    if (!form.totalSeats.trim() || Number(form.totalSeats) < 1) {
      toast("Total seats must be at least 1", "error");
      return;
    }
    if (!form.academicSessionId.trim() || !form.classOrDeptId.trim()) {
      toast("Academic session ID and class/dept ID are required", "error");
      return;
    }
    if (form.endDate < form.startDate) {
      toast("End date cannot precede start date", "error");
      return;
    }
    const payload = {
      academicSessionId: form.academicSessionId.trim(),
      classOrDeptId: form.classOrDeptId.trim(),
      campaignTitle: form.campaignTitle.trim(),
      applicationFee: form.applicationFee.trim() || "0",
      totalSeats: Number(form.totalSeats),
      minRequiredGpa: form.minRequiredGpa.trim() || "0",
      startDate: form.startDate,
      endDate: form.endDate,
      isActive: form.isActive === "true",
    };
    setBusy("save");
    try {
      if (editingId) {
        const { academicSessionId: _s, classOrDeptId: _c, ...patch } = payload;
        await apiFetch(`/api/admissions/campaigns/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        toast("Campaign updated", "success");
      } else {
        await apiFetch("/api/admissions/campaigns", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast("Campaign created", "success");
      }
      reset();
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(c: AdmissionCampaign) {
    setBusy(c.id);
    try {
      await apiFetch(`/api/admissions/campaigns/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, isActive: !x.isActive } : x)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setBusy(null);
    }
  }

  if (loading && campaigns.length === 0) return <AdminPageLoader />;

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Campaigns & Circulars"
        description="Admission circulars, seat capacity, eligibility rules, form sale (posts to GL 44102)"
      />

      <DashCard title={editingId ? "Edit campaign" : "Create campaign"}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
          <div className="min-w-0 sm:col-span-2 2xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-700">Campaign title *</label>
            <input
              className={INPUT}
              value={form.campaignTitle}
              onChange={(e) => set({ campaignTitle: e.target.value })}
              placeholder="e.g. HSC Admission 2026-27"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Academic session ID *</label>
            <input
              className={`${INPUT} font-mono`}
              value={form.academicSessionId}
              onChange={(e) => set({ academicSessionId: e.target.value })}
              placeholder="UUID…"
              disabled={Boolean(editingId)}
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Class / Dept ID *</label>
            <input
              className={`${INPUT} font-mono`}
              value={form.classOrDeptId}
              onChange={(e) => set({ classOrDeptId: e.target.value })}
              placeholder="UUID…"
              disabled={Boolean(editingId)}
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Total seats *</label>
            <input
              className={`${INPUT} text-right font-mono`}
              value={form.totalSeats}
              onChange={(e) => set({ totalSeats: e.target.value })}
              placeholder="e.g. 120"
              inputMode="numeric"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Form fee (BDT)</label>
            <input
              className={`${INPUT} text-right font-mono`}
              value={form.applicationFee}
              onChange={(e) => set({ applicationFee: e.target.value })}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Min required GPA</label>
            <input
              className={`${INPUT} text-right font-mono`}
              value={form.minRequiredGpa}
              onChange={(e) => set({ minRequiredGpa: e.target.value })}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Opens</label>
            <DatePickerField value={form.startDate} onChange={(v) => set({ startDate: v })} maxDate={form.endDate} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Closes</label>
            <DatePickerField value={form.endDate} onChange={(v) => set({ endDate: v })} minDate={form.startDate} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">Status</label>
            <SearchSelect options={ACTIVE_OPTS} value={form.isActive} onChange={(v) => set({ isActive: v })} ariaLabel="Campaign status" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-2">
            <button type="button" className={BTN} disabled={busy !== null} onClick={save}>
              {busy === "save" ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
              ) : editingId ? (
                <span className="inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Update campaign</span>
              ) : (
                <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Create campaign</span>
              )}
            </button>
            {editingId && (
              <button type="button" className={BTN_SECONDARY} disabled={busy !== null} onClick={reset}>
                <span className="inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> Cancel edit</span>
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-500">
          Session/class pickers arrive with Academic Core — IDs for now.
        </p>
      </DashCard>

      <DashCard
        title={`Campaigns (${campaigns.length})`}
        action={
          <button type="button" className={BTN_GHOST} disabled={busy !== null} onClick={load}>
            <span className="inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Refresh</span>
          </button>
        }
      >
        {campaigns.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">No campaigns yet — create the first one above.</p>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Campaign</th>
                  <th className="px-2.5 py-1.5 font-semibold">Session / Class</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Seats</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Form fee</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Min GPA</th>
                  <th className="px-2.5 py-1.5 font-semibold">Window</th>
                  <th className="px-2.5 py-1.5 font-semibold">Status</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1 font-medium">{c.campaignTitle}</td>
                    <td className="px-2.5 py-1 font-mono text-ink-500" title={`${c.academicSessionId} · ${c.classOrDeptId}`}>
                      {c.academicSessionId.slice(0, 8)} · {c.classOrDeptId.slice(0, 8)}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono">{c.totalSeats}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{c.applicationFee}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{c.minRequiredGpa}</td>
                    <td className="px-2.5 py-1 font-mono">{c.startDate?.slice(0, 10)} → {c.endDate?.slice(0, 10)}</td>
                    <td className="px-2.5 py-1">
                      <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${c.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                        {c.isActive ? "ACTIVE" : "CLOSED"}
                      </span>
                    </td>
                    <td className="px-2.5 py-1">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className={BTN_GHOST} disabled={busy !== null} onClick={() => startEdit(c)}>
                          <span className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</span>
                        </button>
                        <button type="button" className={BTN_GHOST} disabled={busy !== null} onClick={() => toggleActive(c)}>
                          {busy === c.id ? "…" : c.isActive ? "Close" : "Reopen"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>
    </div>
  );
}
