<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## UI Design Rules (frontend — `apps/web`)

- **Corner radius: always `rounded-xs` (sharp corners).** All inputs, textareas,
  selects, buttons, cards, sections, panels, alerts, table wrappers, dropdown /
  submenu menus, modals, and image thumbnails use `rounded-xs`. Never use
  `rounded`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, or
  `rounded-2xl` for these elements.
- **Keep `rounded-full` only for truly circular elements:** avatars, status
  dots, spinner rings, and blurred decorative background blobs.
- **Standard control height: exactly 30px everywhere.** Every form control —
  text/number input, textarea (single row), `SearchSelect`, `DatePickerField`,
  and filter-bar buttons sitting beside inputs — renders at the same 30px
  height so filter rows align pixel-perfect across all Accounts Management
  pages (and every other menu). The exact recipe:
  - Native inputs/selects/buttons: `text-sm` + `py-1` + `px-2.5` + 1px border
    (= 20px line + 8px padding + 2px border = 30px). Never `py-2`/`py-2.5`/
    `py-3` on form controls, and never `px-3` (use `px-2.5`).
  - `SearchSelect`: exactly 30px via its style config in
    `components/ui/SearchSelect.tsx` — `control.minHeight: 30`,
    `valueContainer` padding `2px 8px`, `dropdownIndicator` + `clearIndicator`
    padding `2px 6px`, `indicatorSeparator` margin `4px 0`. (react-select's
    default 8px icon padding alone stretches the control to ~36px regardless
    of `minHeight` — that is why the indicator override exists.) Do not change
    any of these per-page.
  - `DatePickerField`: `text-sm` + `py-1` input (already set in
    `components/ui/DatePicker.tsx` — do not change it per-page).
  - Page-level `INPUT`/`INPUT_BASE` constants must all be exactly:
    `"w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400"`.
  - **Standard button size: exactly 30px, same as inputs.** Every button —
    tab nav, filter actions (Run/CSV/Print/PDF), preset chips, table-row and
    card actions — uses `text-xs font-medium` + `py-1.5` + `px-2.5`/`px-3`
    **plus a border box**: outlined buttons `border border-ink-200`, solid
    buttons a matching `border-brand-500`/`border-brand-600`, visually
    borderless buttons `border-transparent` (= 16px line + 12px padding + 2px
    border = 30px). Never `py-1` (26px) or `py-0.5` chips on buttons — that is
    what broke row alignment before. Large modal primary/close pairs
    (`text-sm` + `py-2`) are the only exception.
  - When adding or editing a filter row, eyeball-check that every control's
    top and bottom edges line up — if one sits 2px off, its padding or the
    shared component config is wrong, not the row layout.
- **Pointer cursor on all inputs.** Every `input`, `select`, `textarea`,
  toggle switch, and react-select control/option carries `cursor-pointer`
  (including native select dropdown options).
- **Flat controls (no glow, no depth).** Inputs and buttons never use focus
  rings (`focus:ring-*`, `focus-within:ring-*`, `focus-visible:ring-*`) or
  shadows (`shadow-*`, `hover:shadow-*`). Focus state is shown only by a flat
  border-color change (`focus:border-*` / `focus-within:border-*`). Card and
  menu-panel shadows (`shadow-card`, `shadow-soft`) stay — only controls are
  flat.
- **JS-styled components must match:** `SearchSelect` uses `borderRadius: 2`,
  `minHeight: 30`, pointer cursor on control + options; SweetAlert2
  buttons/popups/inputs in `lib/swal.ts` use `rounded-xs` classes.
- **All dropdowns use `SearchSelect` (react-select) — never native `<select>`.**
  In new or edited dashboard code, every dropdown (filters, form fields,
  status/type pickers) must be `@/components/ui/SearchSelect`. It is
  string-controlled: `options: { value: string; label: string }[]`,
  `<SearchSelect options={opts} value={v} onChange={setV} placeholder="…" />`
  with `isClearable` (empty string = All/none), `isDisabled`, `ariaLabel`.
  It portals the menu to `document.body` (escapes modals/cards) and already
  matches the flat `rounded-xs`/32px control style — do not restyle it
  per-page. Put your own `<label>` above it like other filter fields.
- **All date inputs use `DatePickerField` (react-datepicker) — never
  `<input type="date">`.** In new or edited dashboard code, every date
  (filters, transaction/invoice dates) must be `@/components/ui/DatePicker`.
  Values are local ISO `YYYY-MM-DD` strings (no UTC-midnight shift):
  `<DatePickerField label="From" value={from} onChange={setFrom} maxDate={to} />`.
  Pass `label` (it renders its own accessible `<label>` — do not wrap it in
  another one), `minDate`/`maxDate` for range cross-bounds, plus `required` /
  `error` / `placeholder` for forms. Helpers `parseISODate` / `toISODate` /
  `todayISO` live in the same file. The clear (X) is parked left of the
  calendar toggle by global CSS — do not re-style or fight it per-page.
- **Boy-scout rule for legacy controls.** When editing a file that still
  contains a native `<select>` or `<input type="date">`, migrate those
  controls to `SearchSelect` / `DatePickerField` in the same change.
