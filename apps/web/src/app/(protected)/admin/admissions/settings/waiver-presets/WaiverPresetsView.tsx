"use client";

import { useCallback, useEffect, useState } from "react";
import { FiLoader, FiXCircle } from "react-icons/fi";
import { LuSprout } from "react-icons/lu";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { apiFetch } from "@/lib/api";
import { toast, confirmDialog } from "@/lib/swal";
import type { WaiverPresetRule } from "@/lib/admissions";

const BTN =
  "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";

const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

export default function WaiverPresetsView() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<WaiverPresetRule[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await apiFetch<WaiverPresetRule[]>("/api/admissions/waiver-presets"));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load presets", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function seed() {
    setActing("seed");
    try {
      await apiFetch("/api/admissions/waiver-presets/seed-defaults", { method: "POST" });
      toast("Standard presets seeded", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Seed failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function toggle(rule: WaiverPresetRule) {
    setActing(rule.id);
    try {
      await apiFetch(`/api/admissions/waiver-presets/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function deleteRule(rule: WaiverPresetRule) {
    const confirmed = await confirmDialog({
      title: `Delete preset "${rule.ruleCode}"`,
      text: `This will permanently delete the "${rule.ruleCode}" waiver preset rule. This action cannot be undone.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setActing(rule.id);
    try {
      await apiFetch(`/api/admissions/waiver-presets/${rule.id}`, {
        method: "DELETE",
      });
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setActing(null);
    }
  }

  if (loading) return <AdminPageLoader />;

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Quota & Waiver Presets"
        description="Plan §4 Workflow 2 — merit, sibling, freedom-fighter, orphan/Lillah presets driving Step 4"
      />
      <DashCard
        title="Preset rules"
        action={
          <button type="button" className={BTN} disabled={acting !== null} onClick={seed}>
            {acting === "seed" ? (
              <span className="inline-flex items-center gap-1.5">
                <FiLoader className="h-3.5 w-3.5 animate-spin" /> Seeding…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <LuSprout className="h-3.5 w-3.5" /> Seed defaults
              </span>
            )}
          </button>
        }
      >
        {rules.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">
            No presets yet — click <span className="font-semibold">Seed defaults</span> to load the
            standard catalogue (Golden GPA5, GPA4+, sibling, freedom-fighter, Lillah…).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Rule</th>
                  <th className="px-2.5 py-1.5 font-semibold">Conditions</th>
                  <th className="px-2.5 py-1.5 font-semibold">Waiver</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Adm%</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Tui%</th>
                  <th className="px-2.5 py-1.5 font-semibold">Status</th>
                  <th className="px-2.5 py-1.5 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1">
                      <span className="font-mono font-semibold">{r.ruleCode}</span>
                      <span className="block text-ink-500">{r.ruleName}</span>
                    </td>
                    <td className="px-2.5 py-1 text-ink-600">
                      {[r.minGpa || r.maxGpa ? `GPA ${r.minGpa ?? "0"}–${r.maxGpa ?? "5"}` : null,
                        r.quotaTag ? `quota ${r.quotaTag}` : null,
                        r.residenceType ? `res ${r.residenceType}` : null,
                        r.institutionType ?? null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-2.5 py-1">
                      <span className="rounded-xs bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                        {r.waiverType}
                      </span>
                      {r.requiresZakatEligible && (
                        <span className="ml-1 rounded-xs bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          Fund 02 gate
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono">{r.admissionFeePct}%</td>
                    <td className="px-2.5 py-1 text-right font-mono">{r.tuitionFeePct}%</td>
                    <td className="px-2.5 py-1">
                      <span
                        className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${r.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                      >
                        {r.isActive ? "ACTIVE" : "OFF"}
                      </span>
                    </td>
                    <td className="px-2.5 py-1">
                      <button
                        type="button"
                        className={BTN_GHOST}
                        disabled={acting !== null}
                        onClick={() => toggle(r)}
                      >
                        {acting === r.id ? "…" : r.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className={BTN_GHOST}
                        disabled={acting !== null}
                        onClick={() => deleteRule(r)}
                        title="Delete preset"
                      >
                        <FiXCircle className="h-3 w-3" />
                      </button>
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
