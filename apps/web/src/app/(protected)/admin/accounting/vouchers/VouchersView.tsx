"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Search, Undo2, CheckCheck, Stamp } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { apiFetch } from "@/lib/api";
import { confirmDialog, promptDialog, toast } from "@/lib/swal";
import DatePickerField from "@/components/ui/DatePicker";
import {
  VOUCHER_TYPES,
  VOUCHER_TYPE_LABELS,
  fmtMoney,
  parseAmount,
  type ChartOfAccount,
  type CostCenter,
  type FiscalPeriod,
  type Fund,
  type JournalEntry,
  type JournalLineForm,
  type JournalStatus,
  type VoucherType,
} from "@/lib/accounting";

const INPUT_BASE =
  "w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400";

const STATUS_BADGE: Record<JournalStatus, string> = {
  DRAFT: "bg-slate-200 text-slate-700",
  VERIFIED: "bg-sky-100 text-sky-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REVERSED: "bg-rose-100 text-rose-700",
};

function newLine(): JournalLineForm {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    glAccountId: "",
    fundId: "",
    costCenterId: "",
    subledgerType: "",
    subledgerId: "",
    debitAmount: "",
    creditAmount: "",
    lineMemo: "",
  };
}

const today = () => new Date().toISOString().slice(0, 10);

export default function VouchersView() {
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState<JournalEntry[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const [voucherType, setVoucherType] = useState<Exclude<VoucherType, "REVERSAL">>("JOURNAL");
  const [txnDate, setTxnDate] = useState(today());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<JournalLineForm[]>([newLine(), newLine()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("voucherType", typeFilter);
      if (search.trim()) params.set("search", search.trim());
      const [v, f, a, c, p] = await Promise.all([
        apiFetch<JournalEntry[]>(`/api/accounting/vouchers?${params.toString()}`),
        apiFetch<Fund[]>("/api/accounting/funds"),
        apiFetch<ChartOfAccount[]>("/api/accounting/chart-of-accounts?activeOnly=true"),
        apiFetch<CostCenter[]>("/api/accounting/cost-centers"),
        apiFetch<FiscalPeriod[]>("/api/accounting/fiscal-periods"),
      ]);
      setVouchers(Array.isArray(v) ? v : []);
      setFunds(Array.isArray(f) ? f : []);
      setAccounts(Array.isArray(a) ? a : []);
      setCenters(Array.isArray(c) ? c : []);
      setPeriods(Array.isArray(p) ? p : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load vouchers", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const fundById = useMemo(() => new Map(funds.map((f) => [f.id, f])), [funds]);

  /* Client-side mirror of posting Rules 1 + 3 (server re-validates). */
  const totals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    const perFund = new Map<string, { dr: number; cr: number }>();
    for (const l of lines) {
      const d = parseAmount(l.debitAmount);
      const c = parseAmount(l.creditAmount);
      if (!Number.isFinite(d) || !Number.isFinite(c)) continue;
      dr += d;
      cr += c;
      if (l.fundId) {
        const agg = perFund.get(l.fundId) ?? { dr: 0, cr: 0 };
        perFund.set(l.fundId, { dr: agg.dr + d, cr: agg.cr + c });
      }
    }
    const fundGaps = Array.from(perFund.entries())
      .map(([fundId, agg]) => ({ fundId, diff: Math.round((agg.dr - agg.cr) * 100) / 100 }))
      .filter((g) => g.diff !== 0);
    return {
      dr: Math.round(dr * 100) / 100,
      cr: Math.round(cr * 100) / 100,
      diff: Math.round((dr - cr) * 100) / 100,
      fundGaps,
    };
  }, [lines]);

  const formValid =
    narration.trim().length >= 3 &&
    lines.length >= 2 &&
    lines.every((l) => {
      const d = parseAmount(l.debitAmount);
      const c = parseAmount(l.creditAmount);
      const oneSide = (d > 0 && c === 0) || (c > 0 && d === 0);
      if (!l.glAccountId || !l.fundId || !oneSide) return false;
      const acct = accountById.get(l.glAccountId);
      if (acct?.isControlAccount && (!l.subledgerType || !l.subledgerId)) return false;
      return true;
    }) &&
    totals.dr > 0 &&
    totals.diff === 0 &&
    totals.fundGaps.length === 0;

  function setLine(key: string, patch: Partial<JournalLineForm>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submitDraft() {
    if (!formValid || saving) return;
    setSaving(true);
    try {
      const payload = {
        voucherType,
        transactionDate: txnDate,
        narration: narration.trim(),
        lines: lines.map((l) => ({
          glAccountId: l.glAccountId,
          fundId: l.fundId,
          costCenterId: l.costCenterId || null,
          subledgerType: l.subledgerType || null,
          subledgerId: l.subledgerId || null,
          debitAmount: parseAmount(l.debitAmount).toFixed(2),
          creditAmount: parseAmount(l.creditAmount).toFixed(2),
          lineMemo: l.lineMemo.trim() || null,
        })),
      };
      const created = await apiFetch<JournalEntry>("/api/accounting/vouchers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast(`Draft ${created.voucherNo} created`, "success");
      setShowForm(false);
      setNarration("");
      setLines([newLine(), newLine()]);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create voucher", "error");
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, action: "verify" | "approve" | "reverse" | "delete", voucherNo: string) {
    if (action === "delete") {
      const ok = await confirmDialog({
        title: `Delete draft ${voucherNo}?`,
        text: "The draft and its lines will be permanently removed. Approved vouchers can never be deleted — they need a reversal instead.",
        confirmText: "Yes, delete draft",
        icon: "warning",
        danger: true,
      });
      if (!ok) return;
    }
    let body: string | undefined;
    if (action === "reverse") {
      const reason = await promptDialog({
        title: `Reverse ${voucherNo}?`,
        text: "A mirror REVERSAL voucher swaps every debit and credit. The original is marked REVERSED.",
        input: "textarea",
        placeholder: "e.g. Wrong fund used — repost to General Fund",
        confirmText: "Post reversal",
        icon: "warning",
        minLength: 3,
        danger: true,
      });
      if (reason === null) return;
      body = JSON.stringify({ reason });
    }
    setActing(`${action}:${id}`);
    try {
      if (action === "delete") {
        await apiFetch(`/api/accounting/vouchers/${id}`, { method: "DELETE" });
        toast(`Draft ${voucherNo} deleted`, "success");
      } else {
        const updated = await apiFetch<JournalEntry>(`/api/accounting/vouchers/${id}/${action}`, {
          method: "POST",
          body,
        });
        toast(
          action === "reverse"
            ? `Reversed via ${updated.voucherNo}`
            : `${voucherNo} → ${updated.status}`,
          "success",
        );
      }
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed", "error");
    } finally {
      setActing(null);
    }
  }

  async function toggleExpand(id: string) {
    if (expanded.has(id)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    try {
      const detail = await apiFetch<JournalEntry>(`/api/accounting/vouchers/${id}`);
      setVouchers((prev) => prev.map((v) => (v.id === id ? detail : v)));
      setExpanded((prev) => new Set(prev).add(id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load detail", "error");
    }
  }

  if (loading) return <AdminPageLoader />;
  const openPeriod = periods.find((p) => !p.isClosed);

  return (
    <div>
      <DashPageHeader
        title="Vouchers"
        description="Double-entry workbench — drafts must balance overall and per fund before the Maker → Checker → Approver queue."
      />
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New voucher
        </button>
      </div>

      {openPeriod && (
        <p className="mb-3 text-xs text-ink-500">
          Posting into open period: <span className="font-semibold">{openPeriod.periodName}</span>
          {periods.some((p) => p.isClosed) && (
            <> — closed periods reject new vouchers (period lock).</>
          )}
        </p>
      )}

      {showForm && (
        <DashCard title="New draft voucher" className="mb-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink-700">Type</span>
              <select value={voucherType} onChange={(e) => setVoucherType(e.target.value as Exclude<VoucherType, "REVERSAL">)} className={INPUT_BASE}>
                {VOUCHER_TYPES.filter((t) => t !== "REVERSAL").map((t) => (
                  <option key={t} value={t}>{VOUCHER_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <DatePickerField
              label="Transaction date"
              value={txnDate}
              onChange={setTxnDate}
              required
            />
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block font-medium text-ink-700">Narration (min 3 chars)</span>
              <input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. October tuition collection — Class 8" className={INPUT_BASE} />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            {lines.map((l, idx) => {
              const acct = accountById.get(l.glAccountId);
              return (
                <div key={l.key} className="grid gap-2 rounded-md border border-ink-200 bg-ink-50/50 p-2 md:grid-cols-[26px_1fr_1fr_110px_110px_90px]">
                  <span className="pt-2 text-center text-xs font-bold text-ink-400">{idx + 1}</span>
                  <select value={l.glAccountId} onChange={(e) => setLine(l.key, { glAccountId: e.target.value })} className={INPUT_BASE}>
                    <option value="">GL account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.glCode} — {a.accountName}{a.isControlAccount ? " (control)" : ""}</option>
                    ))}
                  </select>
                  <select value={l.fundId} onChange={(e) => setLine(l.key, { fundId: e.target.value })} className={INPUT_BASE}>
                    <option value="">Fund…</option>
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>{f.fundCode} — {f.fundName}</option>
                    ))}
                  </select>
                  <input value={l.debitAmount} onChange={(e) => setLine(l.key, { debitAmount: e.target.value })} placeholder="Dr" inputMode="decimal" className={`${INPUT_BASE} text-right`} />
                  <input value={l.creditAmount} onChange={(e) => setLine(l.key, { creditAmount: e.target.value })} placeholder="Cr" inputMode="decimal" className={`${INPUT_BASE} text-right`} />
                  <button type="button" disabled={lines.length <= 2} onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="rounded-md px-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40" title="Remove line">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <select value={l.costCenterId} onChange={(e) => setLine(l.key, { costCenterId: e.target.value })} className={`${INPUT_BASE} md:col-start-2`}>
                    <option value="">Cost center (optional)…</option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>{c.centerCode} — {c.centerName}</option>
                    ))}
                  </select>
                  {acct?.isControlAccount ? (
                    <>
                      <select value={l.subledgerType} onChange={(e) => setLine(l.key, { subledgerType: e.target.value })} className={INPUT_BASE}>
                        <option value="">Sub-ledger type…</option>
                        {["STUDENT", "VENDOR", "EMPLOYEE", "DONOR"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <input value={l.subledgerId} onChange={(e) => setLine(l.key, { subledgerId: e.target.value })} placeholder="Sub-ledger UUID" className={`${INPUT_BASE} md:col-span-2`} />
                    </>
                  ) : (
                    <input value={l.lineMemo} onChange={(e) => setLine(l.key, { lineMemo: e.target.value })} placeholder="Line memo (optional)" className={`${INPUT_BASE} md:col-span-3`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setLines((prev) => [...prev, newLine()])} className="flex items-center gap-1 rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100">
              <Plus className="h-3.5 w-3.5" /> Add line
            </button>
            <div className="ml-auto flex items-center gap-3 rounded-md bg-ink-900 px-3 py-1.5 font-mono text-xs text-white">
              <span>Dr {fmtMoney(totals.dr)}</span>
              <span>Cr {fmtMoney(totals.cr)}</span>
              <span className={totals.diff === 0 && totals.dr > 0 ? "text-emerald-300" : "text-rose-300"}>
                Δ {fmtMoney(totals.diff)}
              </span>
            </div>
          </div>
          {totals.fundGaps.length > 0 && (
            <div className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Cross-fund leak: {totals.fundGaps.map((g) => {
                const f = fundById.get(g.fundId);
                return <span key={g.fundId} className="mr-2 font-semibold">{f ? `${f.fundCode} ${f.fundName}` : g.fundId} Δ {fmtMoney(g.diff)}</span>;
              })}
              Every fund must balance on its own.
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100">
              Cancel
            </button>
            <button type="button" disabled={!formValid || saving} onClick={submitDraft} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save draft"}
            </button>
          </div>
          {!formValid && (
            <p className="mt-2 text-right text-xs text-ink-500">
              Save unlocks when every line has an account + fund + one positive side, control lines carry a sub-ledger, and totals + every fund balance to zero.
            </p>
          )}
        </DashCard>
      )}

      <DashCard title={`Vouchers (${vouchers.length})`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search voucher no / narration…" className={`${INPUT_BASE} pl-8`} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-ink-200 bg-white px-2 py-2 text-sm">
            <option value="">All statuses</option>
            {["DRAFT", "VERIFIED", "APPROVED", "REVERSED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-ink-200 bg-white px-2 py-2 text-sm">
            <option value="">All types</option>
            {VOUCHER_TYPES.map((t) => (
              <option key={t} value={t}>{VOUCHER_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {vouchers.map((v) => {
            const open = expanded.has(v.id);
            const busy = acting?.endsWith(v.id);
            return (
              <div key={v.id} className="rounded-md border border-ink-200">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => toggleExpand(v.id)} className="text-ink-500 hover:text-ink-800">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <span className="font-mono text-sm font-bold text-ink-900">{v.voucherNo}</span>
                  <span className="text-xs text-ink-500">{VOUCHER_TYPE_LABELS[v.voucherType] ?? v.voucherType} · {String(v.transactionDate).slice(0, 10)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[v.status]}`}>{v.status}</span>
                  <span className="hidden max-w-md truncate text-xs text-ink-500 md:inline">— {v.narration}</span>
                  <span className="ml-auto flex gap-1.5">
                    {v.status === "DRAFT" && (
                      <>
                        <button type="button" disabled={!!acting} onClick={() => act(v.id, "verify", v.voucherNo)} className="flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
                          <CheckCheck className="h-3.5 w-3.5" /> {busy ? "…" : "Verify"}
                        </button>
                        <button type="button" disabled={!!acting} onClick={() => act(v.id, "delete", v.voucherNo)} className="flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </>
                    )}
                    {v.status === "VERIFIED" && (
                      <button type="button" disabled={!!acting} onClick={() => act(v.id, "approve", v.voucherNo)} className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        <Stamp className="h-3.5 w-3.5" /> {busy ? "…" : "Approve"}
                      </button>
                    )}
                    {v.status === "APPROVED" && v.voucherType !== "REVERSAL" && (
                      <button type="button" disabled={!!acting} onClick={() => act(v.id, "reverse", v.voucherNo)} className="flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                        <Undo2 className="h-3.5 w-3.5" /> {busy ? "…" : "Reverse"}
                      </button>
                    )}
                  </span>
                </div>
                {open && (
                  <div className="overflow-x-auto border-t border-ink-100 px-3 py-2">
                    <table className="w-full min-w-[640px] text-xs">
                      <thead>
                        <tr className="text-left text-ink-500">
                          <th className="py-1 pr-2 font-semibold">GL</th>
                          <th className="py-1 pr-2 font-semibold">Fund</th>
                          <th className="py-1 pr-2 font-semibold">Memo</th>
                          <th className="py-1 pr-2 text-right font-semibold">Dr</th>
                          <th className="py-1 text-right font-semibold">Cr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(v.lines ?? []).map((l) => (
                          <tr key={l.id ?? l.key} className="border-t border-ink-100">
                            <td className="py-1 pr-2 font-mono">{l.glAccount ? `${l.glAccount.glCode} ${l.glAccount.accountName}` : l.glAccountId}</td>
                            <td className="py-1 pr-2">{l.fund ? `${l.fund.fundCode}` : String(l.fundId).slice(0, 8)}{l.subledgerType ? ` · ${l.subledgerType}` : ""}</td>
                            <td className="py-1 pr-2 text-ink-500">{l.lineMemo ?? "—"}</td>
                            <td className="py-1 pr-2 text-right font-mono">{fmtMoney(Number(l.debitAmount))}</td>
                            <td className="py-1 text-right font-mono">{fmtMoney(Number(l.creditAmount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {v.reversedEntryId && (
                      <p className="mt-1 text-xs text-rose-600">Reversed — see linked REVERSAL entry.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {vouchers.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-500">No vouchers yet — create the first draft above.</p>
          )}
        </div>
      </DashCard>
    </div>
  );
}
