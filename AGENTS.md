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
  per-page. Long placeholders/values stay on one line with `...` ellipsis
  and show the full text via native `title` tooltip (built into the shared
  component). Put your own `<label>` above it like other filter fields.
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
  `grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end`.
  Never use `md:`/`lg:`/`xl:grid-cols-6` — at a 1300px viewport the sidebar
  leaves ~1000px of content, so 6 columns squeeze each filter to ~160px and
  break long `SearchSelect` placeholders/values (e.g. Fund). Keep 2 columns
  from `sm` up to `2xl` (1536px); the 6-column single row only applies on
  very wide screens. Every field wrapper gets `min-w-0` so long labels
  (e.g. "Cost Center / Dept") and react-select text truncate instead of
  blowing out the grid. Normal fields span 1 col; wide fields (e.g. GL
  Account) use `sm:col-span-2 2xl:col-span-2`. Action buttons sit in a
  `flex flex-wrap items-center gap-1.5 sm:col-span-2 2xl:col-span-2` cell
  (`flex-wrap` so Run/CSV/Print/PDF never overflow a narrow cell). Every
  field has `<label className="mb-1 block text-xs font-medium
  text-ink-700">` above its control (`DatePickerField` renders its own label
  via the `label` prop instead).
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

## Global Image Upload Pipeline (backend — `apps/api`, frontend — `apps/web`)

The image upload/crop/optimization architecture is implemented and is the
standard for every image in the system. Full reference:
`docs/image-upload-architecture.md`.

**Preset constants — one source, one mirror.**
- Backend single source of truth:
  `apps/api/src/common/constants/image-presets.constant.ts` (`AVATAR`
  500×500 1:1, `PASSPORT` 450×600 3:4, `BANNER_16_9` 1920×1080, `BANNER_19_6`
  1900×600, `DOCUMENT` max 1800×1800 free-ratio `fit:'inside'`, `LOGO` max
  500×500 free-ratio `fit:'inside'`).
- Frontend mirror: `apps/web/src/constants/image-upload-presets.ts` — keep the
  two files in sync byte-for-byte whenever a preset changes. The server is the
  real enforcer; the mirror exists only for cropper geometry and size hints.

**Backend wiring — decorator + explicit pipe pairing.**
- Route decorator: `@UploadImage('<field>', ImagePreset.X, <maxSizeMB>)` from
  `common/decorators/upload-image.decorator.ts` — composes
  `FileInterceptor` with Multer `memoryStorage()` (validated uploads never
  touch disk) plus a hard `limits.fileSize` cap.
- Param pipe: `@UploadedFile(new ImageOptimizationPipe(ImagePreset.X, true))`
  next to the same field. Parameter pipes cannot read route metadata, so the
  preset is declared explicitly on both pairs; the enum is the source.
  The pipe replaces `file.buffer/mimetype/originalname` in place — downstream
  code only ever sees sanitized WebP.
- `common/pipes/image-optimization.pipe.ts` anti-bypass security (never trust
  the client): XML/SVG sniff before decode (stored-XSS vector), real binary
  magic-byte inspection via `sharp().metadata()` (mimetype/extension are
  ignored entirely — a renamed `.exe` or script is rejected), pixel-flood cap
  `limitInputPixels: 64_000_000`, EXIF-orientation-aware aspect gate
  (`orientation` 5–8 swap axes) with ±15% tolerance for strict presets, `.rotate()`
  auto-orient + full metadata strip, `.resize()` per preset fit, `.webp()`
  normalize. A failed/swallowed pipe result means no file and no residue.

**Storage contract — `modules/storage` strategy.**
- Inject with `@Inject(STORAGE_PROVIDER) storage: IStorageProvider`. Drivers:
  `LocalStorageDriver` (fs/promises under `UPLOADS_DIR`, served by the
  `/uploads` static mount in `main.ts`) and `S3StorageDriver` (AWS S3 /
  Cloudflare R2). Switch by `.env` `STORAGE_DRIVER=local|s3` — never branch on
  the driver in application code.
- Canonical key (identical for every driver):
  `schools/${tenantId}/${folder}/${uuidv4()}.webp` with `tenantId` defaulting
  to `'default_school'` (future JWT tenancy passes it server-side only —
  never from a request body). `upload()` returns `{ key, url }`; **only the
  relative `key` is persisted in the DB** — URLs are resolved at read time
  (local: `/uploads/${key}`; S3/R2: `S3_PUBLIC_URL`/virtual-host).
- Orphan cleanup after replacing/deleting an image: DB update first, then
  `storage.deleteFile(previousKey)` — but **only when
  `isManagedFileKey(previousKey)`** is true (legacy rows hold hand-written
  `/uploads/x.jpg` or `/logo.png` values; those must never be treated as
  deletable keys). Wrap in try/catch + `logger.warn`; deletion is idempotent.

**Frontend components — `components/common` + `lib`.**
- `GlobalImageUploader` is the intake widget for any image field. Ratio-locked
  presets (`AVATAR`/`PASSPORT`/`BANNER_*`) open `ImageCropModal`
  (react-easy-crop: zoom/pan/90° rotation, aspect locked to the preset);
  `DOCUMENT`/`LOGO` pass the raw file through (the server's `fit:'inside'`
  preserves every pixel of any ratio — never impose aspect on them).
  Two delivery modes: `{ preset, uploadEndpoint, value, onChange }` posts the
  ready file through a same-origin proxy and lands the URL in the form field
  (the Teachers page uses this), or `{ preset, onFileReady(file) }` hands the
  cropped `File` to the parent (custom multipart forms).
- `ImageCropModal` follows the shared modal standard (navy overlay, `rounded-xs`
  card, 38px footer buttons with `disabled:opacity-50`); small buttons use the
  30px recipe and all controls are flat `cursor-pointer` boxes.
- `lib/crop-image.ts` (`getCroppedImg`) does the canvas slice: rotated
  safe-area render → exact crop rectangle → dimension caps from the preset →
  `image/webp` encode with a PNG feature-fallback (Safari < 17 — the backend
  pipe normalizes to WebP either way). Uploaders own and revoke the ObjectURLs
  (on replace, modal close, and unmount) — never leak them.
- Same-origin proxies live under `apps/web/src/app/api/**/route.ts`
  (see `/api/uploads/avatar`, `/api/uploads/optimized`): forward `FormData`
  as-is so the browser writes the multipart boundary, attaching
  `Authorization: Bearer <session cookie>` from `lib/session-cookie.ts`.
- `resolveImageUrl` in `lib/media.ts` understands storage keys
  (`schools/…` → `/uploads/…` resolved against `NEXT_PUBLIC_API_BASE_URL`),
  legacy `/uploads/…` values, absolute URLs, and `/public` assets. Use it for
  every uploaded-image display; do not build URLs inline.

**Adding an image field elsewhere — checklist.**
1. Backend route: `@UploadImage('<field>', ImagePreset.X, <maxMB>)` + param
   `@UploadedFile(new ImageOptimizationPipe(ImagePreset.X, true))`.
2. `storage.upload({ buffer: file.buffer, folder: '<logical-folder>',
   tenantId? })` after the pipe; store `key` only.
3. Replace-cleanup: `isManagedFileKey(oldKey)` guard → `deleteFile` after a
   successful DB commit; log, never throw.
4. Frontend field: `<GlobalImageUploader preset={ImagePreset.X}
   uploadEndpoint="/api/<module>/<route>" value={form.imageUrl}
   onChange={…} />` and a thin proxy `route.ts` copying the avatar one.
5. DB column: `VarChar(255)` minimum (keys are ≈55 chars).
