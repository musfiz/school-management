"use client";

/**
 * Shared Result-Engine UI kit — Phase 7.
 *
 * Everything the 13 Academic Results pages reuse lives here so the repo UI
 * rules in `AGENTS.md` are applied in exactly one place:
 *   - 30px controls (`text-sm` + `py-1` + `px-2.5`, or `text-xs` + `py-1.5`)
 *   - `rounded-xs` on every control / card / badge
 *   - flat controls (border-colour focus only, no rings, no shadows)
 *   - `SearchSelect` for every dropdown, `DatePickerField` for every date
 *   - tables: `overflow-x-auto rounded-xs border border-ink-100` wrapper,
 *     `bg-ink-50` head, `divide-y divide-ink-100` body, `px-2.5 py-1` cells
 */

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DashCard } from "@/components/dashboard/DashPage";
import SearchSelect from "@/components/ui/SearchSelect";
import { site } from "@/lib/site";
import {
  filterOptionsToSearch,
  getScopeFilterOptions,
  listSyllabus,
  listTerms,
  type ExamTerm,
  type FilterOption,
  type ScopeFilterOptions,
  type SearchOptionLike,
  type SyllabusRow,
} from "@/lib/academic-results";

/* ================================================================== */
/*  Control recipes (single source of truth for sizes)                 */
/* ================================================================== */

/** Native input / select — exactly 30px (AGENTS.md). */
export const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

/** Field label above a control. */
export const LABEL = "mb-1 block text-xs font-medium text-ink-700";

/** Page-level button, outlined (30px). */
export const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50";

/** Page-level button, solid brand (30px). */
export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";

/** Page-level button, danger (30px). */
export const BTN_DANGER =
  "inline-flex items-center justify-center gap-1.5 rounded-xs border border-rose-500 bg-rose-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50";

/** Compact in-table row action (26px, uniform among themselves). */
export const BTN_ROW =
  "inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50";

/** Modal-footer button (38px). */
export const BTN_MODAL =
  "inline-flex items-center justify-center gap-1.5 rounded-xs border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

export const BTN_MODAL_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50";

/* ================================================================== */
/*  Badges                                                             */
/* ================================================================== */

const TONE_CLASS = "rounded-xs px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = status ?? "—";
  const tone =
    value === "PUBLISHED"
      ? "bg-emerald-100 text-emerald-800"
      : value === "MARKS_ENTRY"
        ? "bg-sky-100 text-sky-800"
        : value === "PROCESSING"
          ? "bg-amber-100 text-amber-800"
          : value === "LOCKED"
            ? "bg-navy-100 text-navy-800"
            : "bg-slate-100 text-slate-800";
  return <span className={`${TONE_CLASS} ${tone}`}>{value.replace(/_/g, " ")}</span>;
}

export function ResultStatusBadge({ status }: { status: string | null | undefined }) {
  const value = status ?? "—";
  const tone =
    value === "PASSED"
      ? "bg-emerald-100 text-emerald-800"
      : value === "PROMOTED_WITH_F"
        ? "bg-amber-100 text-amber-800"
        : value === "FAILED"
          ? "bg-rose-100 text-rose-800"
          : value === "ABSENT"
            ? "bg-slate-100 text-slate-800"
            : "bg-slate-100 text-slate-800";
  return <span className={`${TONE_CLASS} ${tone}`}>{value.replace(/_/g, " ")}</span>;
}

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const value = role ?? "—";
  const tone =
    value === "COMPULSORY"
      ? "bg-navy-100 text-navy-800"
      : value === "FOURTH_OPTIONAL"
        ? "bg-amber-100 text-amber-800"
        : value === "GROUP_ELECTIVE"
          ? "bg-sky-100 text-sky-800"
          : "bg-slate-100 text-slate-700";
  return <span className={`${TONE_CLASS} ${tone}`}>{value.replace(/_/g, " ")}</span>;
}

export function FailReasonBadge({ reason }: { reason: string | null | undefined }) {
  if (!reason) return <span className="text-ink-400">—</span>;
  return <span className={`${TONE_CLASS} bg-rose-100 text-rose-800`}>{reason.replace(/_/g, " ")}</span>;
}

/** Letter-grade chip — F is red, everything else neutral/positive. */
export function GradeChip({ letter }: { letter: string | null | undefined }) {
  const value = letter ?? "—";
  const tone = value === "F" ? "bg-rose-100 text-rose-800" : value === "A+" ? "bg-emerald-100 text-emerald-800" : "bg-ink-100 text-ink-800";
  return <span className={`${TONE_CLASS} ${tone}`}>{value}</span>;
}

/* ================================================================== */
/*  Layout primitives                                                  */
/* ================================================================== */

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

/** Standard filter card: `DashCard` + the 1/2/6-column responsive grid. */
export function FilterCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DashCard title={title} className={className}>
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 2xl:grid-cols-6">{children}</div>
    </DashCard>
  );
}

/** Action cluster that sits inside a `FilterCard` grid cell. */
export function ActionCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-2 ${className}`}>{children}</div>
  );
}

export function KpiTile({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "emerald" | "rose" | "amber" | "navy" }) {
  const color =
    tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : tone === "navy" ? "text-navy-800" : "text-ink-900";
  return (
    <div className="min-w-0 rounded-xs border border-ink-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase text-ink-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xs border border-ink-100">{children}</div>;
}

export function EmptyRow({ colSpan, message = "No records." }: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-ink-400">
        {message}
      </td>
    </tr>
  );
}

export function TabNav({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-100 pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            active === tab.id ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-ink-100 text-ink-700 hover:bg-ink-200"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xs bg-white p-5 ${wide ? "max-w-3xl" : "max-w-lg"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="mb-4 font-display text-base font-bold text-navy-900">{title}</h3>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Print blocks                                                       */
/* ================================================================== */

/** School letter-head, only rendered on paper. */
export function PrintSchoolHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="hidden print:block mb-4 border-b-2 border-navy-900 pb-3 text-center">
      <h1 className="text-xl font-bold uppercase tracking-wide">{site.name}</h1>
      <p className="text-[11px] text-ink-600">
        {site.address} · EIIN {site.eiin} · {site.phone}
      </p>
      <h2 className="mt-1 text-sm font-semibold uppercase text-ink-700">{title}</h2>
      {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
    </div>
  );
}

/** Statutory signature row (print only). */
export function SignatureBlocks({ labels }: { labels: string[] }) {
  return (
    <div className="hidden print:block mt-16">
      <div className="flex justify-between gap-6">
        {labels.map((label) => (
          <div key={label} className="flex-1 border-t border-ink-400 pt-1 text-center text-[11px]">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * QR verification block.
 *
 * The API returns a compact `payload` + SHA-256 `checksum`; no QR encoder is
 * bundled in this repo, so the block prints the payload/checksum verbatim
 * (scannable as text) and drops in a real QR image the moment `qrcode` is
 * installed. Nothing else on the marksheet depends on it.
 */
export function QrBlock({ payload, checksum, verifyPath }: { payload: string; checksum: string; verifyPath?: string }) {
  return (
    <div className="inline-block rounded-xs border border-ink-300 p-2 text-left">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-600">QR verification</p>
      <p className="mt-0.5 max-w-[240px] break-all font-mono text-[8px] leading-tight text-ink-700">{payload}</p>
      <p className="mt-0.5 font-mono text-[8px] text-ink-500">SHA-256 {checksum}</p>
      {verifyPath && <p className="font-mono text-[8px] text-ink-500">{verifyPath}</p>}
    </div>
  );
}

/* ================================================================== */
/*  Data hooks (AD-3 — scope options derived from enrollments)         */
/* ================================================================== */

export interface ScopeOptions {
  sessions: SearchOptionLike[];
  classes: SearchOptionLike[];
  sections: SearchOptionLike[];
  raw: ScopeFilterOptions | null;
}

export function useScopeOptions(params?: { academicSessionId?: string; classOrDeptId?: string }) {
  const [state, setState] = useState<ScopeOptions>({ sessions: [], classes: [], sections: [], raw: null });
  const [loading, setLoading] = useState(true);

  // The backend `scope` endpoint always returns all sessions and scopes
  // classes/sections by the given params — one call covers every dropdown.
  const sessionKey = params?.academicSessionId ?? "";
  const classKey = params?.classOrDeptId ?? "";

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getScopeFilterOptions(
        sessionKey || classKey ? { ...(sessionKey ? { academicSessionId: sessionKey } : {}), ...(classKey ? { classOrDeptId: classKey } : {}) } : undefined,
      );
      const option = (rows: FilterOption[]) => filterOptionsToSearch(rows);
      setState({
        sessions: option(raw?.sessions ?? []),
        classes: option(raw?.classes ?? []),
        sections: option(raw?.sections ?? []),
        raw: raw ?? null,
      });
    } catch {
      setState({ sessions: [], classes: [], sections: [], raw: null });
    } finally {
      setLoading(false);
    }
  }, [sessionKey, classKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, loading, reload };
}

/**
 * Cascading scope state (AD-3): session → class → section.
 *
 * Owns the three ids and refetches the downstream dropdowns through the
 * scoped lookups endpoint. Changing the session clears the class, section
 * and every dependent pick; changing the class clears the section — stale
 * cross-scope selections are impossible.
 */
export function useCascadingScope({ includeSection = false }: { includeSection?: boolean } = {}) {
  const [sessionId, setSessionIdState] = useState("");
  const [classId, setClassIdState] = useState("");
  const [sectionId, setSectionIdState] = useState("");

  const { sessions, classes, sections, loading, reload } = useScopeOptions(
    sessionId ? { academicSessionId: sessionId, ...(classId ? { classOrDeptId: classId } : {}) } : undefined,
  );

  const setSessionId = useCallback((value: string) => {
    setSessionIdState(value);
    setClassIdState("");
    setSectionIdState("");
  }, []);

  const setClassId = useCallback((value: string) => {
    setClassIdState(value);
    setSectionIdState("");
  }, []);

  const setSectionId = useCallback((value: string) => {
    setSectionIdState(value);
  }, []);

  return {
    sessionId,
    setSessionId,
    classId,
    setClassId,
    sectionId,
    setSectionId,
    sessions,
    classes,
    sections: includeSection ? sections : [],
    loading,
    reload,
  };
}

export function useTerms(academicSessionId: string, classOrDeptId: string, termType?: string) {
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!academicSessionId || !classOrDeptId) {
      setTerms([]);
      return;
    }
    setLoading(true);
    try {
      setTerms(await listTerms({ academicSessionId, classOrDeptId, ...(termType ? { termType } : {}) }));
    } catch {
      setTerms([]);
    } finally {
      setLoading(false);
    }
  }, [academicSessionId, classOrDeptId, termType]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { terms, loading, reload };
}

export function useSyllabus(academicSessionId: string, classOrDeptId: string) {
  const [subjects, setSubjects] = useState<SyllabusRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!academicSessionId || !classOrDeptId) {
      setSubjects([]);
      return;
    }
    setLoading(true);
    try {
      setSubjects(await listSyllabus(academicSessionId, classOrDeptId));
    } catch {
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [academicSessionId, classOrDeptId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { subjects, loading, reload };
}

/* ================================================================== */
/*  Small helpers                                                      */
/* ================================================================== */

export function ScopeSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  isClearable = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchOptionLike[];
  placeholder: string;
  isClearable?: boolean;
}) {
  return (
    <Field label={label}>
      <SearchSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        isClearable={isClearable}
        ariaLabel={label}
      />
    </Field>
  );
}

export function termOptions(terms: ExamTerm[]): SearchOptionLike[] {
  return terms.map((term) => ({ value: term.id, label: `${term.termName} · ${term.status}` }));
}

export function subjectOptions(subjects: SyllabusRow[]): SearchOptionLike[] {
  return subjects.map((subject) => ({
    value: subject.id,
    label: `${subject.subjectCode ?? ""} ${subject.subjectName ?? ""}`.trim() || subject.id,
  }));
}
