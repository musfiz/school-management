"use client";

import Select, { type StylesConfig } from "react-select";

export interface SearchOption {
  value: string;
  label: string;
}

interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  placeholder?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
  ariaLabel?: string;
}

const styles: StylesConfig<SearchOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 30,
    fontSize: 14,
    cursor: "pointer",
    overflow: "hidden",
    minWidth: 0,
    borderColor: state.isFocused ? "var(--color-brand-400, #38bdf8)" : "#e2e8f0",
    borderRadius: 2,
    boxShadow: "none",
    backgroundColor: "#fff",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-400, #38bdf8)" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "2px 8px",
    overflow: "hidden",
    flexWrap: "nowrap",
    whiteSpace: "nowrap",
    minWidth: 0,
  }),
  /* Compact indicators: react-select's default 8px icon padding stretches
     the control to ~36px regardless of minHeight — keep it at 30px. */
  dropdownIndicator: (base) => ({ ...base, padding: "2px 6px" }),
  clearIndicator: (base) => ({ ...base, padding: "2px 6px" }),
  indicatorSeparator: (base) => ({ ...base, margin: "4px 0" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: 14 }),
  placeholder: (base) => ({
    ...base,
    fontSize: 14,
    color: "#94a3b8",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: 14,
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  }),
  menu: (base) => ({ ...base, zIndex: 50, fontSize: 14 }),
  menuPortal: (base) => ({ ...base, zIndex: 50 }),
  option: (base, state) => ({
    ...base,
    fontSize: 14,
    backgroundColor: state.isSelected ? "var(--color-brand-600, #0284c7)" : state.isFocused ? "#f1f5f9" : "#fff",
    color: state.isSelected ? "#fff" : "#0f172a",
    cursor: "pointer",
  }),
};

/**
 * Searchable dropdown (react-select) styled for the dashboard.
 * Controlled by plain string value for easy use in voucher/journal forms.
 */
export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  isClearable = true,
  isDisabled = false,
  ariaLabel,
}: SearchSelectProps) {
  const selected = options.find((o) => o.value === value) ?? null;
  // Native tooltip shows the full text when the single-line ellipsis truncates it.
  const tooltip = selected ? selected.label : placeholder;
  return (
    <div className="w-full min-w-0" title={tooltip}>
    <Select<SearchOption, false>
      aria-label={ariaLabel}
      value={selected}
      onChange={(opt) => onChange(opt?.value ?? "")}
      options={options}
      placeholder={placeholder}
      isClearable={isClearable}
      isDisabled={isDisabled}
      isSearchable
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      styles={styles}
    />
    </div>
  );
}
