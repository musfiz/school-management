# Model High School — Public School Website

A modern, responsive, SEO-optimized school website built with **Next.js 16 (App
Router)**, **Tailwind CSS v4.3** and **TypeScript** (strict).

## Features

- **Content-driven routing** — the whole menu (Home, About, Information,
  Academic, Admission, Student, Facilities, Result, Others, Contact) is rendered
  from a single navigation registry + typed content store, so ~50 pages are
  maintainable without 50 hand-written files.
- **Multi-level navigation** — desktop dropdown on hover/focus, mobile accordion,
  active-route highlighting (`Header.tsx`, a Client Component).
- **Design** — navy / blue / gold palette, hero, auto-scrolling **notice
  ticker**, quick-links, footer with contact details. Mobile-first.
- **Static content management** — pages described by typed `Block[]` docs in
  `src/lib/content/pages.ts`; collections (teachers, staff, notices, news,
  gallery, events, downloads, results) in `src/lib/content/collections.ts`.
- **Dynamic content API** — `GET /api/result` (result lookup), `GET /api/notices`.
- **SEO & Performance** — Server Components, SSG (`generateStaticParams`),
  `next/image`, per-page `generateMetadata`, JSON-LD (Organization,
  BreadcrumbList, Article), `sitemap.ts`, `robots.ts`.
- **Accessibility** — semantic landmarks, ARIA labels, keyboard-navigable menu,
  visible focus rings, a skip-to-content link, contrast-compliant palette.
- **Quality** — TypeScript strict, ESLint (`next/core-web-vitals`), Prettier.

## Getting started

```sh
# from the repo root (Turborepo)
pnpm install
pnpm dev --filter web

# or directly
cd apps/web
pnpm install
pnpm dev          # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`.

## Project structure

All UI is split into a **public** area (anonymous visitors) and a **protected
dashboard** area, each in its own **route group** so URLs stay identical while the
folders are fully isolated.

```
apps/web/src/
├─ app/
│  ├─ layout.tsx            # minimal <html>/<body> + fonts + org JSON-LD only
│  ├─ globals.css           # Tailwind v4 @theme tokens (navy/blue/gold)
│  ├─ sitemap.ts, robots.ts # public-only (ignore /dashboard by design)
│  ├─ api/result|notices/    # API routes (shared backend, not a page)
│  ├─ (public)/             # ← ALL frontend pages (route group, URLs unchanged)
│  │  ├─ layout.tsx          # Header + NoticeTicker + skip link + <main> + Footer
│  │  ├─ page.tsx            # Home (Hero + AboutPreview + NoticeBoard)
│  │  ├─ contact/page.tsx
│  │  ├─ [section]/page.tsx, [section]/[slug]/page.tsx
│  │  ├─ result/exam-result/ # Result lookup (ResultLookup client component)
│  │  ├─ academic/teachers|staffs/, others/{notice,news,gallery,event,routine,download}/
│  │  └─ not-found.tsx, loading.tsx
│  └─ (protected)/          # ← protected area (route group, URLs unchanged)
│     └─ dashboard/          # /dashboard — force-dynamic, not prerendered
│        ├─ layout.tsx       # DashboardShell (mock role gate)
│        ├─ page.tsx + students/teachers/results/notices/profile/settings/
│        └─ not-found.tsx
├─ components/
│  ├─ Header, Footer, NoticeTicker, Hero, HomeSections
│  ├─ ContentRenderer.tsx, ResultLookup.tsx, icons.tsx, ui/
│  └─ dashboard/             # RoleProvider, DashboardShell, Sidebar, Topbar, MockLogin, DashPage
└─ lib/
   ├─ navigation.ts          # menu registry (public)
   ├─ dashboard-nav.ts       # Role type + role-aware nav items
   ├─ content/{types,pages,collections}.ts
   ├─ jsonld.ts, site.ts
```

### Dashboard access & roles

`/dashboard` is a **protected** area (folder: `app/(protected)/dashboard`, URL
unchanged thanks to the route group). A **mock role gate** (`MockLogin`) simulates
login: pick a role and it's stored in a cookie (`mhs_role`). The shared shell shows a
**role-aware sidebar** filtered by `src/lib/dashboard-nav.ts`. Roles: `admin`,
`management`, `teacher`, `student`, `guardian`. To add real auth later, replace
`RoleProvider` with a session and keep `dashboard-nav.ts` unchanged.

> The dev server on :3000 hot-reloads; after this restructure the public URLs are
> identical (`/`, `/about/history`, `/contact`) and `/dashboard` still resolves to the
> protected area. Visit `/dashboard` to see the gate.

## Customizing content

- **Menu** — edit `src/lib/navigation.ts` (label, href, `section`, `slug`,
  descriptions). The Header and sitemap update automatically.
- **Page copy** — add/extend entries in `src/lib/content/pages.ts`. Any route not
  explicitly defined falls back to a generated page, so the site never 404s on a
  registered link.
- **Collections** — edit `src/lib/content/collections.ts` (typed sample data).
- **Brand** — `src/lib/site.ts` (name, address, contact) and the `@theme` block in
  `src/app/globals.css` (colors, fonts, shadows, radius).
- **Logo** — `public/logo.svg` (400×400 school crest) rendered in the header via
  `next/image`; swap it for your own 400×400 asset (PNG/SVG) and update `src` in
  `components/Header.tsx`.

## Deployment (Vercel)

1. Import the repo; set the **Root Directory** to `apps/web` (or build with
   Turborepo).
2. Framework preset: Next.js. Build command `next build`, output `.next`.
3. `next.config.ts` already sets AVIF/WebP and allows the image hosts used by the
   gallery — add your own host under `images.remotePatterns`.

> **Note on images:** the demo uses `picsum.photos` placeholders for the gallery.
> Swap to your own optimized assets and a real map/CMS as needed.

## Quality checklist

- [x] All registered routes prerender (64 static pages in `pnpm build`)
- [x] TypeScript strict passes
- [x] `generateMetadata` + JSON-LD + sitemap + robots
- [x] Keyboard & screen-reader accessibility
- [x] Mobile-first responsive layout
