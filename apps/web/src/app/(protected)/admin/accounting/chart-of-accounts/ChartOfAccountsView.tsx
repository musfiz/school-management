"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/dashboard/DataTable";
import { DashCard, DashPageHeader, StatGrid } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { apiFetch } from "@/lib/api";
import { confirmDialog, toast } from "@/lib/swal";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  INSTITUTION_TYPES,
  NORMAL_BALANCE_BY_TYPE,
  isContraPair,
  type AccountTreeNode,
  type AccountType,
  type ChartOfAccount,
  type CostCenter,
  type FiscalPeriod,
  type Fund,
  type InstitutionType,
} from "@/lib/accounting";

const INPUT_BASE =
  "w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400";

const TYPE_BADGE: Record<AccountType, string> = {
  ASSET: "bg-sky-100 text-sky-800",
  LIABILITY: "bg-orange-100 text-orange-800",
  EQUITY: "bg-violet-100 text-violet-800",
  REVENUE: "bg-emerald-100 text-emerald-800",
  EXPENSE: "bg-rose-100 text-rose-800",
  CONTRA_REVENUE: "bg-amber-100 text-amber-800",
  CONTRA_ASSET: "bg-slate-200 text-slate-700",
};

type ModalKind = "account" | "fund" | "center" | "period";

interface ModalState {
  kind: ModalKind;
  /** existing record id when editing, null when creating */
  id: number | null;
  /** preset parent for "add child" shortcut */
  parentId?: number | null;
}

const EMPTY_ACCOUNT_FORM = {
  glCode: "",
  accountName: "",
  accountNameBn: "",
  accountType: "ASSET" as AccountType,
  normalBalance: "DR" as "DR" | "CR",
  parentId: "",
  isControlAccount: false,
  isCashOrBank: false,
  defaultFundId: "",
  isActive: true,
};

function flatten(nodes: AccountTreeNode[]): AccountTreeNode[] {
  const out: AccountTreeNode[] = [];
  const walk = (list: AccountTreeNode[]) => {
    list.forEach((n) => {
      out.push(n);
      if (n.children?.length) walk(n.children);
    });
  };
  walk(nodes);
  return out;
}

function collectIds(nodes: AccountTreeNode[]): Set<number> {
  return new Set(flatten(nodes).map((n) => n.id));
}

/** Prune the tree to matching branches (match = self or any descendant matches). */
function filterTree(
  nodes: AccountTreeNode[],
  query: string,
  type: AccountType | "ALL",
  fundId: string,
  showInactive: boolean,
): AccountTreeNode[] {
  const q = query.trim().toLowerCase();
  const pruned: AccountTreeNode[] = [];
  for (const node of nodes) {
    const kids = filterTree(node.children ?? [], query, type, fundId, showInactive);
    const selfMatch =
      (!q || `${node.glCode} ${node.accountName}`.toLowerCase().includes(q)) &&
      (type === "ALL" || node.accountType === type) &&
      (fundId === "ALL" || String(node.defaultFundId ?? "") === fundId) &&
      (showInactive || node.isActive);
    if (selfMatch || kids.length > 0) pruned.push({ ...node, children: kids });
  }
  return pruned;
}

export default function ChartOfAccountsView() {
  const [tree, setTree] = useState<AccountTreeNode[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "ALL">("ALL");
  const [fundFilter, setFundFilter] = useState("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [modal, setModal] = useState<ModalState | null>(null);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [fundForm, setFundForm] = useState({
    fundCode: "",
    fundName: "",
    isRestricted: false,
    shariahCompliant: false,
    isActive: true,
  });
  const [centerForm, setCenterForm] = useState({
    centerCode: "",
    centerName: "",
    institutionType: "SCHOOL" as InstitutionType,
    parentId: "",
    isActive: true,
  });
  const [periodForm, setPeriodForm] = useState({
    periodName: "",
    startDate: "",
    endDate: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [t, f, c, p] = await Promise.all([
        apiFetch<AccountTreeNode[]>("/api/accounting/chart-of-accounts/tree"),
        apiFetch<Fund[]>("/api/accounting/funds"),
        apiFetch<CostCenter[]>("/api/accounting/cost-centers"),
        apiFetch<FiscalPeriod[]>("/api/accounting/fiscal-periods"),
      ]);
      setTree(t);
      setFunds(f);
      setCenters(c);
      setPeriods(p);
      // Tree starts fully collapsed — user expands branches on demand
      // (Expand all button, chevrons, or search which auto-reveals matches).
    } catch (err) {
      toast({ title: "Failed to load chart of accounts", text: (err as Error).message, icon: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtering = query.trim() !== "" || typeFilter !== "ALL" || fundFilter !== "ALL" || showInactive;
  const visibleTree = useMemo(
    () => (filtering ? filterTree(tree, query, typeFilter, fundFilter, showInactive) : tree),
    [tree, query, typeFilter, fundFilter, showInactive, filtering],
  );
  const allAccounts = useMemo(() => flatten(tree), [tree]);
  const openPeriod = periods.find((p) => !p.isClosed) ?? null;

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ---------------- modal openers ---------------- */

  function openAccountModal(editing?: ChartOfAccount, parentPreset?: ChartOfAccount) {
    const type = (editing?.accountType ?? parentPreset?.accountType ?? "ASSET") as AccountType;
    setAccountForm({
      glCode: editing?.glCode ?? "",
      accountName: editing?.accountName ?? "",
      accountNameBn: editing?.accountNameBn ?? "",
      accountType: type,
      normalBalance: editing?.normalBalance ?? NORMAL_BALANCE_BY_TYPE[type],
      parentId: editing
        ? (editing.parentId != null ? String(editing.parentId) : "")
        : parentPreset
          ? String(parentPreset.id)
          : "",
      isControlAccount: editing?.isControlAccount ?? false,
      isCashOrBank: editing?.isCashOrBank ?? false,
      defaultFundId: editing?.defaultFundId != null ? String(editing.defaultFundId) : "",
      isActive: editing?.isActive ?? true,
    });
    setModal({ kind: "account", id: editing?.id ?? null, parentId: parentPreset?.id ?? null });
  }

  function openFundModal(editing?: Fund) {
    setFundForm({
      fundCode: editing?.fundCode ?? "",
      fundName: editing?.fundName ?? "",
      isRestricted: editing?.isRestricted ?? false,
      shariahCompliant: editing?.shariahCompliant ?? false,
      isActive: editing?.isActive ?? true,
    });
    setModal({ kind: "fund", id: editing?.id ?? null });
  }

  function openCenterModal(editing?: CostCenter) {
    setCenterForm({
      centerCode: editing?.centerCode ?? "",
      centerName: editing?.centerName ?? "",
      institutionType: editing?.institutionType ?? "SCHOOL",
      parentId: editing?.parentId != null ? String(editing.parentId) : "",
      isActive: editing?.isActive ?? true,
    });
    setModal({ kind: "center", id: editing?.id ?? null });
  }

  function openPeriodModal(editing?: FiscalPeriod) {
    setPeriodForm({
      periodName: editing?.periodName ?? "",
      startDate: editing?.startDate?.slice(0, 10) ?? "",
      endDate: editing?.endDate?.slice(0, 10) ?? "",
    });
    setModal({ kind: "period", id: editing?.id ?? null });
  }

  /* ---------------- mutations ---------------- */

  async function saveModal() {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.kind === "account") {
        const payload = {
          glCode: accountForm.glCode.trim(),
          accountName: accountForm.accountName.trim(),
          accountNameBn: accountForm.accountNameBn.trim() || null,
          accountType: accountForm.accountType,
          normalBalance: accountForm.normalBalance,
          parentId: accountForm.parentId === "" ? null : Number(accountForm.parentId),
          isControlAccount: accountForm.isControlAccount,
          isCashOrBank: accountForm.isCashOrBank,
          defaultFundId: accountForm.defaultFundId === "" ? null : Number(accountForm.defaultFundId),
          isActive: accountForm.isActive,
        };
        if (!payload.glCode || !payload.accountName) throw new Error("GL code and account name are required");
        if (modal.id) await apiFetch(`/api/accounting/chart-of-accounts/${modal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        else await apiFetch("/api/accounting/chart-of-accounts", { method: "POST", body: JSON.stringify(payload) });
        toast(modal.id ? "Account updated" : "Account created");
      } else if (modal.kind === "fund") {
        const payload = {
          fundCode: fundForm.fundCode.trim(),
          fundName: fundForm.fundName.trim(),
          isRestricted: fundForm.isRestricted,
          shariahCompliant: fundForm.shariahCompliant,
          isActive: fundForm.isActive,
        };
        if (!payload.fundCode || !payload.fundName) throw new Error("Fund code and name are required");
        if (modal.id) await apiFetch(`/api/accounting/funds/${modal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        else await apiFetch("/api/accounting/funds", { method: "POST", body: JSON.stringify(payload) });
        toast(modal.id ? "Fund updated" : "Fund created");
      } else if (modal.kind === "center") {
        const payload = {
          centerCode: centerForm.centerCode.trim(),
          centerName: centerForm.centerName.trim(),
          institutionType: centerForm.institutionType,
          parentId: centerForm.parentId === "" ? null : Number(centerForm.parentId),
          isActive: centerForm.isActive,
        };
        if (!payload.centerCode || !payload.centerName) throw new Error("Center code and name are required");
        if (modal.id) await apiFetch(`/api/accounting/cost-centers/${modal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        else await apiFetch("/api/accounting/cost-centers", { method: "POST", body: JSON.stringify(payload) });
        toast(modal.id ? "Cost center updated" : "Cost center created");
      } else {
        const payload = { ...periodForm };
        if (!payload.periodName || !payload.startDate || !payload.endDate) throw new Error("Name, start and end dates are required");
        if (modal.id) await apiFetch(`/api/accounting/fiscal-periods/${modal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        else await apiFetch("/api/accounting/fiscal-periods", { method: "POST", body: JSON.stringify(payload) });
        toast(modal.id ? "Fiscal period updated" : "Fiscal period created");
      }
      setModal(null);
      await load();
    } catch (err) {
      toast({ title: "Save failed", text: (err as Error).message, icon: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(node: AccountTreeNode) {
    const ok = await confirmDialog({
      title: `Delete ${node.glCode}?`,
      text: `"${node.accountName}" will be removed permanently. Accounts with children cannot be deleted.`,
      confirmText: "Yes, delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/accounting/chart-of-accounts/${node.id}`, { method: "DELETE" });
      toast("Account deleted");
      await load();
    } catch (err) {
      toast({ title: "Delete failed", text: (err as Error).message, icon: "error" });
    }
  }

  async function toggleAccountActive(node: AccountTreeNode) {
    try {
      await apiFetch(`/api/accounting/chart-of-accounts/${node.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          glCode: node.glCode,
          accountName: node.accountName,
          accountType: node.accountType,
          isActive: !node.isActive,
        }),
      });
      toast(node.isActive ? "Account deactivated" : "Account reactivated");
      await load();
    } catch (err) {
      toast({ title: "Update failed", text: (err as Error).message, icon: "error" });
    }
  }

  async function setPeriodClosed(period: FiscalPeriod, closed: boolean) {
    const ok = await confirmDialog({
      title: closed ? `Close ${period.periodName}?` : `Reopen ${period.periodName}?`,
      text: closed
        ? "Postings into closed periods are rejected by the journal engine."
        : "Reopening allows postings into this period again.",
      confirmText: closed ? "Yes, close period" : "Yes, reopen",
      danger: closed,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/accounting/fiscal-periods/${period.id}/${closed ? "close" : "reopen"}`, { method: "PATCH" });
      toast(closed ? "Period closed" : "Period reopened");
      await load();
    } catch (err) {
      toast({ title: "Update failed", text: (err as Error).message, icon: "error" });
    }
  }

  /* ---------------- tree rows ---------------- */

  function renderNode(node: AccountTreeNode, depth: number): React.ReactNode {
    const hasKids = (node.children?.length ?? 0) > 0;
    const isOpen = filtering || expanded.has(node.id);
    const fund = funds.find((f) => f.id === node.defaultFundId);
    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-ink-100 ${
            node.isActive ? "" : "opacity-55"
          }`}
          style={{ paddingLeft: `${8 + depth * 22}px` }}
        >
          {hasKids ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-ink-200 hover:text-navy-800"
              aria-label={isOpen ? "Collapse" : "Expand"}
            >
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0 text-center text-xs leading-5 text-ink-300">·</span>
          )}
          <code className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-navy-800">
            {node.glCode}
          </code>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">{node.accountName}</span>
          <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${TYPE_BADGE[node.accountType]}`}>
            {ACCOUNT_TYPE_LABELS[node.accountType]}
          </span>
          <span className="hidden shrink-0 rounded border border-ink-200 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-500 md:inline">
            {node.normalBalance}
          </span>
          {node.isControlAccount && (
            <span className="hidden shrink-0 rounded bg-navy-800 px-1.5 py-0.5 text-[11px] font-semibold text-white lg:inline">
              CONTROL
            </span>
          )}
          {node.isCashOrBank && (
            <span className="hidden shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white lg:inline">
              CASH/BANK
            </span>
          )}
          {fund && (
            <span className="hidden shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-navy-800 xl:inline">
              {fund.fundCode} · {fund.fundName}
            </span>
          )}
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              title="Add child account"
              onClick={() => openAccountModal(undefined, node)}
              className="rounded p-1 text-ink-400 hover:bg-white hover:text-brand-600"
            >
              <Plus size={14} />
            </button>
            <button
              title="Edit account"
              onClick={() => openAccountModal(node)}
              className="rounded p-1 text-ink-400 hover:bg-white hover:text-navy-800"
            >
              <Pencil size={14} />
            </button>
            <button
              title={node.isActive ? "Deactivate" : "Reactivate"}
              onClick={() => toggleAccountActive(node)}
              className="rounded p-1 text-ink-400 hover:bg-white hover:text-amber-600"
            >
              <span className="text-xs font-bold">{node.isActive ? "⊘" : "↺"}</span>
            </button>
            <button
              title="Delete account"
              onClick={() => deleteAccount(node)}
              className="rounded p-1 text-ink-400 hover:bg-white hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          </span>
        </div>
        {hasKids && isOpen && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  }

  /* ---------------- small-manager tables ---------------- */

  const fundColumns: ColumnDef<Fund>[] = useMemo(
    () => [
      { header: "Code", accessorKey: "fundCode", cell: (c) => <code className="font-mono text-xs font-bold text-navy-800">{c.getValue<string>()}</code> },
      { header: "Fund Name", accessorKey: "fundName" },
      {
        header: "Flags",
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            {row.original.isRestricted && <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">RESTRICTED</span>}
            {row.original.shariahCompliant && <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">SHARIAH</span>}
            {!row.original.isActive && <span className="rounded bg-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-500">INACTIVE</span>}
          </span>
        ),
      },
      {
        header: "Actions",
        cell: ({ row }) => (
          <button onClick={() => openFundModal(row.original)} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-navy-800" title="Edit fund">
            <Pencil size={14} />
          </button>
        ),
      },
    ],
    [],
  );

  const centerColumns: ColumnDef<CostCenter>[] = useMemo(
    () => [
      { header: "Code", accessorKey: "centerCode", cell: (c) => <code className="font-mono text-xs font-bold text-navy-800">{c.getValue<string>()}</code> },
      { header: "Cost Center", accessorKey: "centerName" },
      { header: "Type", accessorKey: "institutionType", cell: (c) => <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{c.getValue<string>()}</span> },
      {
        header: "Actions",
        cell: ({ row }) => (
          <button onClick={() => openCenterModal(row.original)} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-navy-800" title="Edit cost center">
            <Pencil size={14} />
          </button>
        ),
      },
    ],
    [],
  );

  const periodColumns: ColumnDef<FiscalPeriod>[] = useMemo(
    () => [
      { header: "Period", accessorKey: "periodName" },
      { header: "Start", accessorKey: "startDate", cell: (c) => String(c.getValue() ?? "").slice(0, 10) },
      { header: "End", accessorKey: "endDate", cell: (c) => String(c.getValue() ?? "").slice(0, 10) },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.isClosed ? (
            <span className="rounded bg-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-600">CLOSED</span>
          ) : (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">OPEN</span>
          ),
      },
      {
        header: "Actions",
        cell: ({ row }) => (
          <span className="flex items-center gap-1">
            {!row.original.isClosed && (
              <button onClick={() => openPeriodModal(row.original)} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-navy-800" title="Edit period">
                <Pencil size={14} />
              </button>
            )}
            <button
              onClick={() => setPeriodClosed(row.original, !row.original.isClosed)}
              className="rounded border border-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-600 hover:bg-ink-50"
            >
              {row.original.isClosed ? "Reopen" : "Close"}
            </button>
          </span>
        ),
      },
    ],
    [],
  );

  /** Parent options for the account form: same type or contra-pair, excluding self. */
  const parentOptions = useMemo(() => {
    const type = accountForm.accountType;
    return allAccounts.filter(
      (a) => a.id !== modal?.id && (a.accountType === type || isContraPair(a.accountType, type)),
    );
  }, [allAccounts, accountForm.accountType, modal?.id]);

  useEffect(() => {
    // Keep the suggested normal balance in sync when the type changes on create.
    if (modal?.kind === "account" && modal.id === null) {
      setAccountForm((f) => ({ ...f, normalBalance: NORMAL_BALANCE_BY_TYPE[f.accountType] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountForm.accountType]);

  if (loading) return <AdminPageLoader />;

  return (
    <div>
      <DashPageHeader
        title="Chart of Accounts"
        description="5-digit segmented CoA with fund segregation, cost centers and fiscal periods — spec §2, plan Phase 1 + 8.1."
      />

      <StatGrid
        items={[
          { value: String(allAccounts.length), label: "GL Accounts" },
          { value: String(funds.filter((f) => f.isActive).length), label: "Active Funds" },
          { value: String(allAccounts.filter((a) => a.isControlAccount).length), label: "Control Accounts" },
          { value: openPeriod ? openPeriod.periodName : "—", label: "Open Fiscal Period" },
        ]}
      />

      <div className="mt-4 grid gap-4">
        <DashCard title="Account Tree">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by code or name…"
                className={`${INPUT_BASE} pl-9`}
              />
            </label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as AccountType | "ALL")} className={`${INPUT_BASE} lg:w-48`}>
              <option value="ALL">All types</option>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <select value={fundFilter} onChange={(e) => setFundFilter(e.target.value)} className={`${INPUT_BASE} lg:w-56`}>
              <option value="ALL">All funds</option>
              {funds.map((f) => (
                <option key={f.id} value={String(f.id)}>{f.fundCode} · {f.fundName}</option>
              ))}
            </select>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-600">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
            <span className="flex shrink-0 gap-2">
              <button onClick={() => setExpanded(collectIds(tree))} className="rounded-md border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-50">
                Expand all
              </button>
              <button onClick={() => setExpanded(new Set())} className="rounded-md border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-50">
                Collapse
              </button>
              <button onClick={() => openAccountModal()} className="flex items-center gap-1 rounded-md bg-navy-800 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-900">
                <Plus size={14} /> New Account
              </button>
            </span>
          </div>

          <div className="max-h-[540px] overflow-y-auto rounded-lg border border-ink-200 bg-white p-2">
            {visibleTree.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-400">
                No accounts match. Run the accounting seeder (<code>pnpm --filter api seed:accounting</code>) or create the first account.
              </p>
            ) : (
              visibleTree.map((node) => renderNode(node, 0))
            )}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            CONTROL lines require a sub-ledger at posting time · CASH/BANK lines feed the DIA Receipts &amp; Payments report · Balances appear once Phase 2 journals post.
          </p>
        </DashCard>

        <div className="grid gap-4 xl:grid-cols-2">
          <DashCard title="Funds">
            <div className="mb-2 flex justify-end">
              <button onClick={() => openFundModal()} className="flex items-center gap-1 rounded-md border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50">
                <Plus size={13} /> New Fund
              </button>
            </div>
            <DataTable columns={fundColumns} data={funds} emptyMessage="No funds yet." />
          </DashCard>

          <DashCard title="Cost Centers">
            <div className="mb-2 flex justify-end">
              <button onClick={() => openCenterModal()} className="flex items-center gap-1 rounded-md border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50">
                <Plus size={13} /> New Center
              </button>
            </div>
            <DataTable columns={centerColumns} data={centers} emptyMessage="No cost centers yet." />
          </DashCard>
        </div>

        <DashCard title="Fiscal Periods">
          <div className="mb-2 flex justify-end">
            <button onClick={() => openPeriodModal()} className="flex items-center gap-1 rounded-md border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50">
              <Plus size={13} /> New Period
            </button>
          </div>
          <DataTable columns={periodColumns} data={periods} emptyMessage="No fiscal periods yet." />
        </DashCard>
      </div>

      {/* ---------------- modal ---------------- */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" onClick={() => !saving && setModal(null)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-base font-bold text-navy-900">
              {modal.id ? "Edit" : "New"}{" "}
              {modal.kind === "account" ? "GL Account" : modal.kind === "fund" ? "Fund" : modal.kind === "center" ? "Cost Center" : "Fiscal Period"}
            </h2>

            {modal.kind === "account" && (
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-ink-600">
                    GL Code *
                    <input value={accountForm.glCode} onChange={(e) => setAccountForm({ ...accountForm, glCode: e.target.value })} placeholder="41101" className={`${INPUT_BASE} mt-1 font-mono`} />
                  </label>
                  <label className="text-xs font-semibold text-ink-600">
                    Type *
                    <select value={accountForm.accountType} onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value as AccountType, parentId: "" })} className={`${INPUT_BASE} mt-1`}>
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="text-xs font-semibold text-ink-600">
                  Account Name *
                  <input value={accountForm.accountName} onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })} placeholder="Tuition Fee Revenue" className={`${INPUT_BASE} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-ink-600">
                  Account Name (Bangla)
                  <input value={accountForm.accountNameBn} onChange={(e) => setAccountForm({ ...accountForm, accountNameBn: e.target.value })} className={`${INPUT_BASE} mt-1`} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-ink-600">
                    Normal Balance
                    <select value={accountForm.normalBalance} onChange={(e) => setAccountForm({ ...accountForm, normalBalance: e.target.value as "DR" | "CR" })} className={`${INPUT_BASE} mt-1`}>
                      <option value="DR">DR (Debit)</option>
                      <option value="CR">CR (Credit)</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-ink-600">
                    Parent
                    <select value={accountForm.parentId} onChange={(e) => setAccountForm({ ...accountForm, parentId: e.target.value })} className={`${INPUT_BASE} mt-1`}>
                      <option value="">— Top level —</option>
                      {parentOptions.map((a) => (
                        <option key={a.id} value={String(a.id)}>{a.glCode} · {a.accountName}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="text-xs font-semibold text-ink-600">
                  Default Fund
                  <select value={accountForm.defaultFundId} onChange={(e) => setAccountForm({ ...accountForm, defaultFundId: e.target.value })} className={`${INPUT_BASE} mt-1`}>
                    <option value="">— None —</option>
                    {funds.map((f) => (
                      <option key={f.id} value={String(f.id)}>{f.fundCode} · {f.fundName}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-4 text-xs text-ink-600">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={accountForm.isControlAccount} onChange={(e) => setAccountForm({ ...accountForm, isControlAccount: e.target.checked })} />
                    Control account (needs sub-ledger)
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={accountForm.isCashOrBank} onChange={(e) => setAccountForm({ ...accountForm, isCashOrBank: e.target.checked })} />
                    Cash / Bank (DIA report)
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={accountForm.isActive} onChange={(e) => setAccountForm({ ...accountForm, isActive: e.target.checked })} />
                    Active
                  </label>
                </div>
              </div>
            )}

            {modal.kind === "fund" && (
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-ink-600">
                    Fund Code *
                    <input value={fundForm.fundCode} onChange={(e) => setFundForm({ ...fundForm, fundCode: e.target.value })} placeholder="01" className={`${INPUT_BASE} mt-1 font-mono`} />
                  </label>
                  <label className="text-xs font-semibold text-ink-600">
                    Fund Name *
                    <input value={fundForm.fundName} onChange={(e) => setFundForm({ ...fundForm, fundName: e.target.value })} placeholder="General Fund" className={`${INPUT_BASE} mt-1`} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-ink-600">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={fundForm.isRestricted} onChange={(e) => setFundForm({ ...fundForm, isRestricted: e.target.checked })} />
                    Restricted (isolated postings)
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={fundForm.shariahCompliant} onChange={(e) => setFundForm({ ...fundForm, shariahCompliant: e.target.checked })} />
                    Shariah-compliant (Zakat/Lillah)
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={fundForm.isActive} onChange={(e) => setFundForm({ ...fundForm, isActive: e.target.checked })} />
                    Active
                  </label>
                </div>
              </div>
            )}

            {modal.kind === "center" && (
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-ink-600">
                    Center Code *
                    <input value={centerForm.centerCode} onChange={(e) => setCenterForm({ ...centerForm, centerCode: e.target.value })} placeholder="102" className={`${INPUT_BASE} mt-1 font-mono`} />
                  </label>
                  <label className="text-xs font-semibold text-ink-600">
                    Center Name *
                    <input value={centerForm.centerName} onChange={(e) => setCenterForm({ ...centerForm, centerName: e.target.value })} placeholder="Science / CSE Dept" className={`${INPUT_BASE} mt-1`} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-ink-600">
                    Institution Type
                    <select value={centerForm.institutionType} onChange={(e) => setCenterForm({ ...centerForm, institutionType: e.target.value as InstitutionType })} className={`${INPUT_BASE} mt-1`}>
                      {INSTITUTION_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-ink-600">
                    Parent Center
                    <select value={centerForm.parentId} onChange={(e) => setCenterForm({ ...centerForm, parentId: e.target.value })} className={`${INPUT_BASE} mt-1`}>
                      <option value="">— Top level —</option>
                      {centers.filter((c) => c.id !== modal.id).map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.centerCode} · {c.centerName}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-ink-600">
                  <input type="checkbox" checked={centerForm.isActive} onChange={(e) => setCenterForm({ ...centerForm, isActive: e.target.checked })} />
                  Active
                </label>
              </div>
            )}

            {modal.kind === "period" && (
              <div className="mt-4 grid gap-3">
                <label className="text-xs font-semibold text-ink-600">
                  Period Name *
                  <input value={periodForm.periodName} onChange={(e) => setPeriodForm({ ...periodForm, periodName: e.target.value })} placeholder="FY 2026-2027 (July-June)" className={`${INPUT_BASE} mt-1`} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-ink-600">
                    Start Date *
                    <input type="date" value={periodForm.startDate} onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })} className={`${INPUT_BASE} mt-1`} />
                  </label>
                  <label className="text-xs font-semibold text-ink-600">
                    End Date *
                    <input type="date" value={periodForm.endDate} onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })} className={`${INPUT_BASE} mt-1`} />
                  </label>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModal(null)} disabled={saving} className="rounded-md border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={saveModal} disabled={saving} className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-900 disabled:opacity-50">
                {saving ? "Saving…" : modal.id ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
