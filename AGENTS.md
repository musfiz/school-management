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
- **Compact input height (xs).** Text inputs, selects, textareas, and date
  pickers use slim vertical padding (`py-1`, `py-1.5`) with `px-2.5`, giving
  ~30–34px control height. Never use `py-2`/`py-2.5`/`py-3` on form controls.
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
  `minHeight: 32`, pointer cursor on control + options; SweetAlert2
  buttons/popups/inputs in `lib/swal.ts` use `rounded-xs` classes.
