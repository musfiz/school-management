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
  - **Standard button size: exactly 30px, same as inputs.** Page-level buttons —
    tab nav, filter actions (Run/CSV/Print/PDF), preset chips, card actions —
    use **one of two recipes, always with a border box** (outlined
    `border-ink-200`, solid matching `border-brand-500`/`border-brand-600`,
    visually borderless `border-transparent`):
    `text-xs font-medium` + `py-1.5` + `px-2.5`/`px-3`, or `text-sm
    font-semibold` + `py-1` + `px-3` (both = 30px). Never `py-1` on `text-xs`
    (26px), `py-1.5` on `text-sm` (34px), or `py-0.5` chips on page-level
    buttons. `PrintMenu` follows this too (`size="md"` default; `size="lg"`
    for modal footers).
  - Compact table-row action buttons (Verify/Approve/Reverse/Print/Settle per
    row) use `text-xs font-semibold` + `px-2`/`px-2.5` + `py-1` **with a
    border box** (26px, uniform among themselves) — dense rows stay readable.
  - Modal footer Cancel/Create/Save pairs use `text-sm font-semibold` +
    `px-3`/`px-4` + `py-2` **with a border box** (38px), plus
    `disabled:opacity-50` on async actions.
  - Legacy underline tab style (`border-b-2`, payables-tax/payroll) is
    internally consistent — converge it to the pill tab nav via the
    boy-scout rule when those files are next touched.
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
- **One loading pattern: `AdminPageLoader`, centered in content only.**
  Every loading state — route `loading.tsx` suspense boundaries, full-view
  fetches (`if (loading) return …`), and in-card/tab refreshes — renders
  `components/dashboard/AdminPageLoader`. Never invent a local spinner,
  skeleton block, or off-palette color (no indigo/slate spinners):
  - `<AdminPageLoader label="…" />` (page variant, default) centers the
    spinner in the content viewport (`min-h-[60vh]`). It renders inside
    `<main>` — sidebar and topbar stay visible and untouched; no fullscreen
    overlays, no layout modals for loading.
  - `<AdminPageLoader variant="inline" />` for refreshes inside a
    card/tab (shorter `min-h-60` block so surrounding layout doesn't jump).
  - The loader text is always exactly `"Loading..."` (the component default).
    Never pass a custom `label` — every loading state shows the same text.
  - Button-level busy states keep the inline `Loader2 animate-spin` icon swap
    (see `PrintMenu`); they never use `AdminPageLoader`.

## Accounts Management Page Layout (frontend — `apps/web/.../admin/accounting/`)

Every page under Accounts Management (vouchers, billing, collection,
payables-tax, payroll, reports, audit, chart-of-accounts) follows the same
shell. New pages must copy it; edited pages must converge to it.

- **Route split.** `page.tsx` is only a session guard:
  `export const dynamic = "force-dynamic"`, `getSession()` + login redirect
  with `returnTo`, then render the client `*View.tsx` holding all logic.
- **Page shell.** `<div className="space-y-4">` + `DashPageHeader` (title plus
  a description naming the spec phase/section, e.g. "Spec §1.7 — …") from
  `@/components/dashboard/DashPage`.
- **Tab nav (multi-section pages).** `flex flex-wrap items-center gap-1.5
  border-b border-ink-100 pb-2`; tab buttons follow the 30px button standard
  with an icon (`h-3.5 w-3.5`) + label, active = `bg-brand-600 text-white`,
  inactive = `bg-ink-100 text-ink-700 hover:bg-ink-200`.
- **Filter card.** `DashCard` titled `"Filter …"` containing
  `grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6 items-end`. Every
  field has `<label className="mb-1 block text-xs font-medium
  text-ink-700">` above its control (`DatePickerField` renders its own label
  via the `label` prop instead). Action buttons sit in a
  `flex items-center gap-1.5` cell in the same grid row.
- **KPI tiles.** `grid grid-cols-2 gap-3 sm:grid-cols-4` of
  `rounded-xs border border-ink-200 bg-white p-3`: label
  `text-[11px] font-medium uppercase text-ink-500`, value
  `mt-1 font-mono text-lg font-bold` (color-coded).
- **Tables.** Wrapper `overflow-x-auto rounded-xs border border-ink-100`;
  `table className="w-full text-left text-xs"`; `thead className="bg-ink-50
  text-ink-700"` with `th className="px-2.5 py-1.5 font-semibold"`;
  `tbody className="divide-y divide-ink-100 bg-white"` with
  `td className="px-2.5 py-1"` and `tr className="hover:bg-ink-50"`.
  Numbers/money: `text-right font-mono`. Grand totals: `tfoot` with
  `border-t-2 border-ink-300 bg-ink-100 font-semibold`. Empty state: single
  `td colSpan={N} className="py-6 text-center text-ink-400"`.
- **Status badges.** `rounded-xs px-1.5 py-0.5 text-[10px] font-semibold`
  with `bg-{emerald,sky,amber,rose,slate}-100` + matching `-800` text
  (e.g. APPROVED = emerald, VERIFIED = sky, DRAFT = slate, REVERSED = rose).
- **Modals.** Overlay `fixed inset-0 z-50 flex items-center justify-center
  bg-navy-900/50 p-4` closing on backdrop click; card
  `max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xs bg-white p-5`;
  footer `mt-5 flex justify-end gap-2` with the modal button standard.
- **Print.** Printable region gets `id="printable-*-area"`; print-only school
  header uses `hidden print:block`; statutory signature blocks use
  `hidden print:block mt-16`. Trigger via `printElement` / `PrintMenu` from
  `@/lib/print` — never raw `window.print()`. Server PDFs come from
  `/api/documents/…` (see `docs/print-pdf-plan.md`).
- **Money & errors.** Amounts render with `font-mono` via shared `fmtMoney`
  helpers with a `BDT` suffix on totals; API failures surface through
  `toast(message, "error")` from `@/lib/swal`.
