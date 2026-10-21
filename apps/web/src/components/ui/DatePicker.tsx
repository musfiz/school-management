"use client";

import { useId, useState, type KeyboardEvent } from "react";
import ReactDatePicker from "react-datepicker";
import { GoCalendar as CalendarDays } from "react-icons/go";
import "react-datepicker/dist/react-datepicker.css";

export interface DatePickerFieldProps {
  /** ISO date `YYYY-MM-DD` (matches API `date` columns); empty string = cleared. */
  value: string;
  onChange: (isoDate: string) => void;
  label?: string;
  placeholder?: string;
  /** ISO lower/upper bounds (`YYYY-MM-DD`). */
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  name?: string;
  className?: string;
}

/** Parse `YYYY-MM-DD` in local time (avoids the UTC-midnight shift of `new Date(str)`). */
export function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a Date to local `YYYY-MM-DD`. */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Today's local date as `YYYY-MM-DD`. */
export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * Project-wide date picker for any form (journal dates, invoice dates,
 * filters, …). Single source of styling + ISO format handling so every
 * form behaves the same.
 *
 * ```tsx * <DatePickerField label="Transaction date" value={txnDate} onChange={setTxnDate} required /> * ```
 */
export default function DatePickerField({
  value,
  onChange,
  label,
  placeholder = "Select date",
  minDate,
  maxDate,
  disabled = false,
  required = false,
  error,
  name,
  className = "",
}: DatePickerFieldProps) {
  // Controlled open state so the calendar ALWAYS auto-closes on pick —
  // including clicking the already-selected date (which fires `onSelect`
  // but no `onChange`, so the uncontrolled picker would stay open).
  const [open, setOpen] = useState(false);
  // NOTE: the wrapper is a <div>, NOT a <label>. The calendar popup lives
  // inside this wrapper for positioning — nesting it in a <label> made
  // every day-click also trigger the label's click-forwarding to the
  // input, which re-opened the calendar right after selection. The title
  // keeps a real <label htmlFor> association for accessibility.
  const inputId = useId();
  return (
    <div className={`block text-sm ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block cursor-pointer font-medium text-ink-700"
        >
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      <div className="relative block">
        <ReactDatePicker
          id={inputId}
          selected={value ? parseISODate(value) : null}
          onChange={(d: Date | null) => {
            onChange(d ? toISODate(d) : "");
            setOpen(false);
          }}
          onSelect={() => setOpen(false)}
          open={open}
          onInputClick={() => !disabled && setOpen(true)}
          onClickOutside={() => setOpen(false)}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
          }}
          shouldCloseOnSelect
          dateFormat="yyyy-MM-dd"
          placeholderText={placeholder}
          portalId="sm-datepicker-portal"
          minDate={minDate ? parseISODate(minDate) ?? undefined : undefined}
          maxDate={maxDate ? parseISODate(maxDate) ?? undefined : undefined}
          disabled={disabled}
          required={required}
          name={name}
          isClearable={!required && !disabled}
          className={`w-full rounded-xs cursor-pointer border bg-white py-1 pl-3 pr-14 text-sm outline-none transition-colors focus:border-brand-400 disabled:bg-ink-50 disabled:text-ink-400 ${ error ? "border-rose-400" : "border-ink-200" }`}
          wrapperClassName="block w-full"
          calendarClassName="sm-datepicker"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Close calendar" : "Open calendar"}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-navy-700 disabled:opacity-40"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </div>
  );
}
