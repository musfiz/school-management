# Dynamic Menu Builder Plan

> Status: **planning** — no implementation has started. Review and confirm
> before work begins.

## Current State

- **All navigation is hardcoded** in `apps/web/src/lib/navigation.ts` — a
  static TypeScript file defining ~50 nav items in a nested tree.
- **Header.tsx** imports and renders this static tree directly (desktop
  dropdowns + mobile accordion).
- **Dashboard sidebar** (`dashboard-nav.ts`) is also hardcoded but has a
  separate role-based filtering system.
- **Adding, removing, reordering, or hiding a menu item** requires a code
  change, a build, and a deploy.
- **Page routing** (`[section]/[slug]`) depends on `generateStaticParams()`
  reading the static nav tree — pages only exist if they're registered in
  `navigation.ts`.

### Current NavItem Type

```ts
interface NavItem {
  label: string;
  href: string;
  section: string;
  slug?: string;
  description?: string;
  children?: NavItem[];
}
```

No `visible`, `order`, `icon`, `target`, `page_id`, or `parent_id`
fields — zero backend control.

---

## Goal

An admin can fully control the public website's header menu from the
dashboard — no code changes, no redeployment:

- Add / edit / remove menu items.
- Reorder items and their children via drag-and-drop.
- Show / hide items without deleting them (toggle visibility).
- Nest items up to 2 levels (parent → children, matching the current
  dropdown depth).
- Link a menu item to an **internal page**, an **external URL**, or a
  **section anchor**.
- Each menu item has Bangla + English labels (ties into the i18n plan).
- Changes go live immediately (or with a "Publish menu" confirmation).

---

## Data Model

### Entity: `MenuItem`

| Column            | Type                      | Description                                                                                               |
| ----------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`              | int (PK)                  | Auto-increment                                                                                            |
| `menu_location`   | enum                      | `header`, `footer`, `dashboard_sidebar` (extensible to other menu zones)                                  |
| `parent_id`       | int (FK → self, nullable) | Null = top-level item; set = child of another item                                                        |
| `label_en`        | varchar(100)              | English label                                                                                             |
| `label_bn`        | varchar(100)              | Bangla label                                                                                              |
| `type`            | enum                      | `internal_page`, `external_url`, `section_anchor`, `placeholder`                                          |
| `href`            | varchar(500, nullable)    | URL or path. Null for `placeholder` type (non-clickable parent that only opens a dropdown)                |
| `section`         | varchar(50, nullable)     | Route segment for internal pages (e.g. `about`) — used by `[section]` dynamic route                       |
| `slug`            | varchar(50, nullable)     | Sub-page segment for internal pages (e.g. `about-us`) — used by `[section]/[slug]` dynamic route          |
| `page_id`         | int (FK → Page, nullable) | Links to a CMS Page entity (future Phase 8). Null if linking to a hardcoded route or external URL         |
| `target`          | enum                      | `_self` (default), `_blank` (new tab — for external links)                                                |
| `icon`            | varchar(50, nullable)     | Icon identifier (e.g. `home`, `book`, `users`) for dashboard sidebar items                                |
| `description`     | varchar(255, nullable)    | Short description shown in dropdown cards or tooltips                                                     |
| `is_visible`      | boolean                   | `true` = shown, `false` = hidden (soft toggle, not deleted)                                               |
| `sort_order`      | int                       | Position among siblings (0-indexed). Lower = higher in the menu                                           |
| `open_by_default` | boolean                   | For dashboard groups: whether the group starts expanded                                                   |
| `roles`           | json (nullable)           | For dashboard sidebar only: `["admin", "teacher"]`. Null = visible to all. Public menus ignore this field |
| `created_at`      | timestamp                 |                                                                                                           |
| `updated_at`      | timestamp                 |                                                                                                           |

**Self-referential tree** via `parent_id` — same pattern used by
WordPress, Drupal, Laravel Nova, and most CMS menu builders. Simple,
proven, supports unlimited nesting (though the UI will enforce a 2-level
max for the header menu).

### Why Not a Separate `Menu` + `MenuItem` Two-Table Design?

A school website has a small, fixed set of menu locations (header, footer,
maybe one or two more). A `menu_location` enum on the item itself is
simpler than a separate `Menu` table with only 2–3 rows. If the system
ever needs dynamic menu zones (unlikely for a school site), a `Menu`
entity can be added later without breaking `MenuItem`.

---

## API Design

### Module: `apps/api/src/menus/`

**Endpoints:**

| Method   | Path                         | Access     | Description                                                                                                        |
| -------- | ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/menus/:location`           | **public** | Returns the full menu tree for a location (`header`, `footer`). Only `is_visible: true` items. Cached aggressively |
| `GET`    | `/menus/:location/all`       | admin      | Returns all items including hidden ones (for the menu builder UI)                                                  |
| `PUT`    | `/menus/:location`           | admin      | **Bulk save** — receives the entire menu tree and replaces all items for that location in one transaction          |
| `POST`   | `/menus/:location/items`     | admin      | Create a single item                                                                                               |
| `PATCH`  | `/menus/:location/items/:id` | admin      | Update a single item                                                                                               |
| `DELETE` | `/menus/:location/items/:id` | admin      | Delete an item (and cascade-delete its children)                                                                   |
| `PATCH`  | `/menus/:location/reorder`   | admin      | Batch reorder — receives `[{id, sort_order, parent_id}, ...]`                                                      |

**Why a bulk `PUT` endpoint?**

The menu builder UI sends the entire tree structure on save (after
drag-and-drop reordering, nesting changes, etc.). A single transactional
write is safer than N individual PATCH calls — no partial state if
something fails mid-update. This is how WordPress Customizer, Strapi, and
Directus handle menu saves.

**Public response format** (`GET /menus/header`):

```jsonc
{
  "location": "header",
  "items": [
    {
      "id": 1,
      "label": { "en": "Home", "bn": "হোম" },
      "type": "internal_page",
      "href": "/",
      "target": "_self",
      "children": [],
    },
    {
      "id": 2,
      "label": { "en": "About", "bn": "পরিচিতি" },
      "type": "placeholder",
      "href": "/about",
      "target": "_self",
      "description": {
        "en": "Learn about our school",
        "bn": "আমাদের বিদ্যালয় সম্পর্কে জানুন",
      },
      "children": [
        {
          "id": 3,
          "label": { "en": "About Us", "bn": "আমাদের সম্পর্কে" },
          "type": "internal_page",
          "href": "/about/about-us",
          "target": "_self",
          "description": { "en": "Who we are", "bn": "আমরা কারা" },
          "children": [],
        },
        // ... more children
      ],
    },
    // ... more top-level items
  ],
}
```

Labels and descriptions are returned as `{ en, bn }` objects. The frontend
picks the right locale key based on the current language.

**Caching:**

- Public `GET /menus/:location` is cached (in-memory or Redis) with a
  short TTL (e.g. 60 seconds) or invalidated on any write to that
  location.
- Frontend can also cache via Next.js `fetch()` revalidation or ISR.
- A menu change by the admin is visible site-wide within seconds, not
  requiring a rebuild.

---

## Frontend — How the Menu Flows

### Current Flow (static)

```
navigation.ts (hardcoded) → Header.tsx renders tree
```

### New Flow (dynamic)

```
Admin saves menu in dashboard
    ↓
API stores in `menu_items` table
    ↓
GET /menus/header (cached, public)
    ↓
Header.tsx fetches + renders tree     (public site)
Sidebar.tsx fetches + renders tree    (dashboard, role-filtered)
```

### Header.tsx Changes

1. Replace `import { mainNav } from '@/lib/navigation'` with a server-side
   `fetch('/menus/header')` call (Next.js Server Component data fetching,
   cached).
2. The response shape is already a nested tree — same structure the
   component currently renders, just sourced from the API instead of a
   static file.
3. For each item, pick `label[locale]` based on the current locale from
   `next-intl`.
4. **Fallback:** If the API is unreachable (downtime), fall back to the
   existing static `navigation.ts` as a safety net. This prevents a blank
   menu during API outages.

### Dashboard Sidebar Changes

1. `GET /menus/dashboard_sidebar` returns the full tree with `roles` on
   each item.
2. `filterTreeForRole()` still runs client-side (same logic, different
   data source).
3. Icons are returned as string identifiers and mapped to Lucide React
   icons (same as current).

### `[section]/[slug]` Routing Changes

Currently `generateStaticParams()` reads the static nav tree to decide
which pages exist. With a dynamic menu:

**Option A — Keep static generation, rebuild on menu change:**

- A webhook or revalidation trigger from the API calls
  `revalidatePath('/')` when the menu is saved, causing Next.js to
  regenerate static pages.
- Pages listed in the menu get pre-rendered; unlisted pages return 404.

**Option B — Switch to dynamic rendering for `[section]/[slug]`:**

- Remove `generateStaticParams()`, let these routes render on-demand.
- The route handler fetches the menu to validate the section/slug exists,
  then loads content.
- Slightly slower first-load (no pre-rendered HTML), but fully dynamic.

**Recommendation:** Option A — keep the performance benefit of static
generation. Menu changes are infrequent (maybe once a month); a quick ISR
revalidation on save is sufficient.

---

## Frontend — Menu Builder UI

### Dashboard Page: `/dashboard/settings/menus`

**Layout:** Two-panel view.

**Left panel — Menu Tree (drag-and-drop):**

- Renders the full menu tree for the selected location (header / footer /
  dashboard sidebar — tabs or dropdown at the top).
- Each item shows: label, type badge (internal/external/placeholder),
  visibility toggle (eye icon), edit button, delete button.
- **Drag-and-drop** reordering and nesting via a library like
  `@dnd-kit/core` (best React DnD library, accessible, touch-friendly).
- Drag an item onto another to make it a child (nest). Drag it out to
  un-nest. Drag up/down to reorder among siblings.
- Visual depth indicators (indent lines) up to 2 levels.
- **"Add menu item"** button at the bottom opens the right panel.

**Right panel — Item Editor (form):**

- Opens when clicking "Add" or "Edit" on an item.

| Field                  | Input type          | Notes                                                                              |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| Label (English)        | Text input          | Required                                                                           |
| Label (Bangla)         | Text input          | Required (ties into i18n plan)                                                     |
| Type                   | Radio/select        | Internal page, External URL, Section anchor, Placeholder                           |
| Internal page          | Searchable dropdown | Lists all pages from the content/page system. Auto-fills `href`, `section`, `slug` |
| External URL           | URL input           | Only shown when type = External URL. Validates format                              |
| Open in new tab        | Checkbox            | Default off for internal, on for external                                          |
| Description (EN)       | Text input          | Optional — shown in dropdown cards                                                 |
| Description (BN)       | Text input          | Optional                                                                           |
| Icon                   | Icon picker         | Optional — grid of available Lucide icons                                          |
| Visible                | Toggle              | On/off — hidden items shown as grayed/strikethrough in the builder                 |
| Roles (dashboard only) | Multi-select        | Only shown for `dashboard_sidebar` location                                        |

**Save behavior:**

- "Save menu" button sends the entire tree via `PUT /menus/:location`.
- Success toast: "Menu updated — changes are live."
- Error: roll back to previous state, show error message.

**Optional — Preview:**

- A "Preview" button shows a read-only rendering of the header as it will
  appear on the public site, without leaving the menu builder page.

---

## Migration Strategy (static → dynamic)

The existing `navigation.ts` has ~50 items that need to become the initial
database content. Migration steps:

### Step 1 — Seed Script

A one-time migration seed script reads `navigation.ts` and inserts all
items into the `menu_items` table with correct `parent_id`, `sort_order`,
`section`, `slug`, and English labels. Bangla labels can be filled in
later via the builder UI.

### Step 2 — Dual-Source Phase

During development, `Header.tsx` tries the API first, falls back to the
static file. This lets the menu builder be developed and tested without
breaking the existing site.

### Step 3 — Cut Over

Once the builder is tested and seed data verified:

- `Header.tsx` reads from API only (static fallback kept for emergencies).
- `navigation.ts` is kept as a readonly fallback/reference but no longer
  the source of truth.
- `generateStaticParams()` reads from the API instead of the static file.

---

## Menu Locations

| Location            | Where it renders                                          | Nesting depth                | Role-filtered | Notes                                      |
| ------------------- | --------------------------------------------------------- | ---------------------------- | ------------- | ------------------------------------------ |
| `header`            | Public site header (desktop dropdowns + mobile accordion) | 2 levels (parent → children) | No            | Main website navigation                    |
| `footer`            | Public site footer quick links                            | 1 level (flat list)          | No            | Simpler than header — just a list of links |
| `dashboard_sidebar` | Dashboard left sidebar                                    | 2 levels (groups → leaves)   | Yes           | Role-based visibility per item             |

All three locations are managed from the same builder UI — just switch the
location tab.

---

## Handling Page Lifecycle

When an admin creates/deletes a **page** (future CMS, Phase 8 of feature
roadmap), the menu should respond:

| Event                         | Menu behavior                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Page created**              | Page appears in the "Internal page" dropdown in the menu item editor. Not auto-added to the menu — admin explicitly adds it                 |
| **Page unpublished / hidden** | Menu item linking to it automatically gets `is_visible: false` (with a warning badge in the builder: "linked page is unpublished")          |
| **Page deleted**              | Menu item stays but shows a "broken link" warning in the builder. Admin must fix or delete the item manually                                |
| **Page slug changed**         | If linked via `page_id` (FK), the menu item's `href`/`section`/`slug` auto-updates. If linked by raw URL, it breaks (builder shows warning) |

This is why `page_id` (FK to a future Page entity) exists alongside
`href` — linking by ID is resilient to slug changes, while `href` is a
manual override for routes that aren't CMS pages (e.g. `/login`,
`/result`, external URLs).

---

## Relationship to Other Plans

| Plan                                             | Integration                                                                                                                                                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **i18n plan**                                    | Menu items store `label_en` + `label_bn`. The API returns both; the frontend picks the right one per locale. Adding a third language means adding a `label_ar` column (or switching to a JSON `labels` column for unlimited languages) |
| **Feature roadmap Phase 8** (Public Website)     | The menu builder is a prerequisite — content pages created in Phase 8 are linked to the menu via `page_id`                                                                                                                             |
| **Feature roadmap Phase 1** (Academic Structure) | Dashboard sidebar items for new modules (Academic Setup) are added via the menu builder instead of hardcoding in `dashboard-nav.ts`                                                                                                    |
| **Media plan**                                   | Menu items can optionally have icons (already in the data model). Image-based menu items (e.g. mega-menu with thumbnails) are a possible future extension but not in scope now                                                         |

---

## Implementation Order

| Step | What                                                              | Effort | Depends on         |
| ---- | ----------------------------------------------------------------- | ------ | ------------------ |
| 1    | Create `MenuItem` entity + migration                              | Small  | Nothing            |
| 2    | Build `GET /menus/:location` public endpoint (tree builder query) | Small  | Step 1             |
| 3    | Build admin CRUD + bulk PUT endpoints                             | Medium | Step 1             |
| 4    | Write seed script to migrate `navigation.ts` → database           | Small  | Steps 1–2          |
| 5    | Update `Header.tsx` to fetch from API (with static fallback)      | Medium | Steps 2, 4         |
| 6    | Update `Footer.tsx` to fetch from API                             | Small  | Steps 2, 4         |
| 7    | Build menu builder UI (`/dashboard/settings/menus`)               | Large  | Steps 3, 5         |
| 8    | Add drag-and-drop reordering + nesting                            | Medium | Step 7             |
| 9    | Update `generateStaticParams()` to read from API                  | Small  | Step 2             |
| 10   | Update dashboard sidebar to fetch from API                        | Medium | Steps 2–3          |
| 11   | Add i18n labels (Bangla) to seed data                             | Small  | Step 4 + i18n plan |

Steps 1–4 (backend + seed) can be done first. Steps 5–6 (frontend
consumption) follow. Step 7–8 (builder UI) is the largest piece. Steps
9–11 are independent polish items.

---

## Open Questions

1. **Footer menu** — should the footer's "Quick Links" also be managed
   from the same builder, or is a simpler hardcoded list sufficient for
   now?
2. **Mega-menu** — any interest in a mega-menu layout (full-width dropdown
   with images/descriptions in columns, like university websites), or is
   the current simple dropdown sufficient?
3. **Menu versioning / draft** — should the admin be able to save a "draft"
   menu and preview it before publishing, or is instant publish on save
   acceptable?
4. **Multi-language label storage** — two columns (`label_en`, `label_bn`)
   is simple and fast for 2 languages. If you anticipate 4+ languages,
   switching to a JSON column (`labels: { en, bn, ar, hi }`) is more
   scalable. Which approach do you prefer?
