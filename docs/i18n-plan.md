# Internationalization (i18n) Plan — Bangla + English (extensible)

> Status: **planning** — no implementation has started. Review and confirm
> before work begins.

## Confirmed Decisions

- **Default locale**: to be set by you when implementation starts.
- **Bangla translations (`bn.json`)**: will be generated alongside `en.json`
  during string extraction.
- **Bangla numerals**: the public site and dashboard will display Bangla
  numerals (০, ১, ২, ৩…) and Bangla date format (১ সেপ্টেম্বর ২০২৬) when
  the locale is `bn`, handled automatically by `Intl.NumberFormat('bn-BD')`
  and `Intl.DateTimeFormat('bn-BD')` via `next-intl`'s `useFormatter()`.
- **Adding a new language later** (Arabic, Hindi, etc.) requires only a new
  `messages/<code>.json` file, a content file, and one config-line change —
  zero structural or routing changes.

## Current State (audit summary)

- **~200+ hardcoded English strings** across navigation, components, forms,
  dashboard labels, content pages, and API error messages.
- **Zero i18n infrastructure** — no library, no translation files, no locale
  routing, no middleware.
- A **fake language toggle** exists in `Header.tsx`
  (`useState<"en" | "bn">`) that does nothing — misleading to users.
- Content system (`lib/content/pages.ts`, `collections.ts`) has no `locale`
  field — all content is English-only.
- API returns hardcoded English error strings, not translatable error codes.

### String Inventory

| Source                    | ~Count        | Location                                                       |
| ------------------------- | ------------- | -------------------------------------------------------------- |
| Navigation menu           | 40            | `navigation.ts`                                                |
| Site metadata             | 15            | `site.ts`                                                      |
| Component UI text         | 50+           | Header, Footer, Hero, HomeSections, NoticeTicker, ResultLookup |
| Dashboard navigation      | 20            | `dashboard-nav.ts`                                             |
| Role labels               | 5             | `dashboard-nav.ts`                                             |
| Form labels & validation  | 15            | LoginForm, `validations.ts`                                    |
| Error messages (frontend) | 5             | LoginForm, API helpers                                         |
| Dashboard chrome          | 10            | UserMenu, Topbar, Sidebar                                      |
| Content pages (prose)     | variable      | `lib/content/pages.ts`, `collections.ts`                       |
| API error messages        | 6             | `auth.service.ts`, `users.service.ts`, `jwt.strategy.ts`       |
| **Total**                 | **~180–200+** |                                                                |

---

## Library Choice: `next-intl`

**Why `next-intl` over `i18next`/`react-i18next`:**

- Purpose-built for Next.js App Router (first-class RSC + Server Component
  support).
- Native `[locale]` segment routing pattern.
- Built-in middleware for locale detection + redirect.
- ICU MessageFormat for variables and plurals — handles Bangla number/date
  formatting via standard `Intl` APIs.
- Type-safe message keys via TypeScript plugin (catches missing translations
  at build time).
- Active maintenance, widely adopted in production Next.js apps.

---

## Step 1 — Routing Restructure (`[locale]` segment)

**Current structure:**

```
src/app/
  layout.tsx              ← <html lang="en"> hardcoded
  (public)/
  (protected)/
  login/
  forgot-password/
  api/                    ← Next.js API routes
```

**New structure:**

```
src/app/
  [locale]/               ← NEW dynamic locale segment
    layout.tsx            ← <html lang={locale}>
    (public)/
    (protected)/
    login/
    forgot-password/
  api/                    ← stays outside [locale] (API routes are locale-agnostic)
```

Every user-facing page moves under `[locale]/`. URLs become:

- `/en/` → English home
- `/bn/` → Bangla home
- `/en/academic/teachers` → English teachers page
- `/bn/academic/teachers` → Bangla teachers page
- `/en/login`, `/bn/login` → locale-aware login

The default locale can use **prefix-free** URLs (e.g. `/` routes to the
default, `/en/` only when switching) via `next-intl`'s
`localePrefix: 'as-needed'` config.

---

## Step 2 — Middleware (auto-detect + redirect)

A `middleware.ts` at `apps/web/src/middleware.ts`:

- Reads the browser's `Accept-Language` header.
- Checks for a `NEXT_LOCALE` cookie (remembers user's explicit choice).
- Redirects unprefixed paths to the resolved locale.
- Passes the resolved locale to all page components.

---

## Step 3 — Translation File Structure

```
apps/web/
  messages/
    en.json         ← English translations
    bn.json         ← Bangla translations
```

**Organized by namespace** (flat keys per namespace):

```jsonc
// messages/en.json (abbreviated)
{
  "common": {
    "signIn": "Sign in",
    "signOut": "Sign out",
    "search": "Search",
    "loading": "Loading…",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "viewAll": "View all",
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "academic": "Academic",
    "admission": "Admission",
    "student": "Student",
    "facilities": "Facilities",
    "result": "Result",
    "others": "Others",
    "contact": "Contact",
  },
  "hero": {
    "tagline": "Knowledge. Discipline. Excellence.",
    "admissionOpen": "Admission open for {startYear}–{endYear}",
    "applyNow": "Apply for admission",
    "checkResult": "Check result",
  },
  "result": {
    "title": "Exam Result",
    "class": "Class",
    "rollNumber": "Roll number",
    "searching": "Searching…",
    "viewResult": "View result",
    "gpa": "GPA",
    "grade": "Grade",
  },
  "auth": {
    "email": "Email",
    "password": "Password",
    "signInTitle": "Sign in to your account",
    "forgotPassword": "Forgot password?",
    "invalidCredentials": "Invalid email or password.",
    "networkError": "Network error. Please try again.",
  },
  "dashboard": {
    "overview": "Overview",
    "academics": "Academics",
    "students": "Students",
    "teachers": "Teachers",
    "results": "Results",
    "notices": "Notices",
    "profile": "Profile",
    "settings": "Settings",
  },
  "validation": {
    "emailRequired": "Email is required",
    "emailInvalid": "Please enter a valid email address",
    "passwordRequired": "Password is required",
    "passwordMinLength": "Password must be at least {min} characters",
  },
  "site": {
    "name": "School Management",
    "description": "A modern school management platform",
    "address": "123 School Road, Dhaka",
  },
  "footer": {
    "quickLinks": "Quick Links",
    "contact": "Contact",
    "copyright": "© {year} {schoolName}. All rights reserved.",
  },
}
```

```jsonc
// messages/bn.json (abbreviated)
{
  "common": {
    "signIn": "সাইন ইন",
    "signOut": "সাইন আউট",
    "search": "অনুসন্ধান",
    "loading": "লোড হচ্ছে…",
    "save": "সংরক্ষণ",
    "cancel": "বাতিল",
    "delete": "মুছুন",
    "edit": "সম্পাদনা",
    "viewAll": "সব দেখুন",
  },
  "nav": {
    "home": "হোম",
    "about": "পরিচিতি",
    "academic": "শিক্ষা কার্যক্রম",
    "admission": "ভর্তি",
    "student": "শিক্ষার্থী",
    "facilities": "সুবিধাসমূহ",
    "result": "ফলাফল",
    "others": "অন্যান্য",
    "contact": "যোগাযোগ",
  },
  // ... mirrors en.json structure exactly
}
```

**Why this structure:**

- Flat per namespace → easy for non-developer translators to edit.
- ICU MessageFormat for variables (`{startYear}`, `{min}`) — industry
  standard.
- Adding a new language = copy `en.json`, translate, save as `ar.json` /
  `hi.json` / etc.
- Type-safe: `next-intl`'s TypeScript plugin validates that every key in
  `bn.json` exists in `en.json` (catches missing translations at build
  time).

---

## Step 4 — Component Migration (string extraction)

**Before (current):**

```tsx
<h1>Knowledge. Discipline. Excellence.</h1>
<button>Apply for admission</button>
```

**After:**

```tsx
const t = useTranslations('hero');
<h1>{t('tagline')}</h1>
<button>{t('applyNow')}</button>
```

**Migration order** (by page traffic and impact):

1. `layout.tsx` — `<html lang={locale}>`, metadata (title/description).
2. `Header.tsx` — replace fake toggle with real locale switcher, translate
   nav labels.
3. `Footer.tsx` — quick links, contact, copyright.
4. `Hero.tsx`, `HomeSections.tsx` — homepage hero, about preview.
5. `NoticeTicker.tsx`, `ResultLookup.tsx` — public interactive components.
6. `LoginForm.tsx`, `ForgotPasswordPage` — auth forms.
7. `navigation.ts` — move all 40+ nav labels to translation keys.
8. `dashboard-nav.ts`, dashboard components — all dashboard labels.
9. `validations.ts` — Zod error messages via translation keys.
10. `site.ts` — site metadata per locale.
11. Content pages (`lib/content/pages.ts`) — see Step 6.

---

## Step 5 — Backend API i18n Strategy

**Principle:** the API does NOT return translated user-facing strings. It
returns **error codes**. The frontend translates error codes to the user's
locale.

**Current (bad):**

```ts
throw new UnauthorizedException('Invalid credentials');
```

**New:**

```ts
throw new UnauthorizedException({ code: 'auth.invalid_credentials' });
```

The frontend maps `auth.invalid_credentials` →
`t('auth.invalidCredentials')` → "Invalid email or password." (English) or
"ভুল ইমেইল বা পাসওয়ার্ড।" (Bangla).

**What changes in `apps/api`:**

- `auth.service.ts` — 3 error messages → error codes.
- `users.service.ts` — 2 error messages → error codes.
- `jwt.strategy.ts` — 1 error message → error code.
- Validation pipe (`class-validator`) — uses default English validation
  messages; frontend overrides with its own Zod validation before even
  hitting the API. API validation is a safety net, not user-facing copy.

**No i18n library needed in the backend** — the API is language-agnostic.
This keeps the backend simple and avoids coupling it to any locale.

---

## Step 6 — Content System Localization

The block-based CMS content (`lib/content/pages.ts`, `collections.ts`) is
long-form prose, not short UI labels — handled differently.

**Two strategies (phased):**

**Option A — Parallel content files (now):**

```
lib/content/
  pages.en.ts       ← English page content
  pages.bn.ts       ← Bangla page content
  collections.en.ts
  collections.bn.ts
  index.ts           ← exports getPageContent(slug, locale)
```

A `getPageContent(slug, locale)` function loads the right file. If Bangla
content doesn't exist for a page yet, fall back to English. Simple, works
with the existing `ContentRenderer`, no database needed.

**Option B — Database-driven CMS (Phase 8 of feature roadmap):**

When the feature roadmap reaches Phase 8 (Public Website Buildout), content
moves to database entities with a `locale` column. The `ContentRenderer`
stays the same — it just reads from the API instead of static files.

**Recommendation:** start with Option A now, migrate to Option B in
Phase 8.

---

## Step 7 — Bangla Typography & RTL Preparedness

**Bangla font:**

- Add `Noto Sans Bengali` (Google Fonts, free, excellent Bangla coverage)
  as the Bangla font family.
- Use CSS `font-family` switching per locale — when `locale === 'bn'`,
  apply the Bangla font stack.
- Tailwind 4 custom font setup in `globals.css`.

**Number and date formatting:**

- Bangla numerals (০১২৩৪৫৬৭৮৯) handled automatically by
  `Intl.NumberFormat('bn-BD')` via `next-intl`'s `useFormatter()`.
- Bangla dates (১ সেপ্টেম্বর ২০২৬) handled by
  `Intl.DateTimeFormat('bn-BD')`.
- No manual digit mapping needed — the browser's `Intl` API does this
  natively.

**RTL preparedness (for future Arabic/Urdu — costs nothing extra now):**

- Use logical CSS properties (`margin-inline-start` instead of
  `margin-left`) in new components going forward.
- Tailwind 4 supports `rtl:` variant natively — no extra config.
- Set `<html dir="rtl">` when locale is `ar`/`ur` (not needed for
  Bangla — Bangla is LTR).
- Saves a painful retrofit later if Arabic (for Qawmi madrasa) is added.

---

## Step 8 — Language Switcher UX

Replace the fake toggle in `Header.tsx` with a real locale switcher:

- Keeps the user on the **same page** but switches locale
  (e.g. `/bn/academic/teachers` ↔ `/en/academic/teachers`).
- Sets a `NEXT_LOCALE` cookie so the preference persists across visits.
- Shows: **বাং | EN** (each language name in its own script — standard
  practice).
- Dashboard topbar gets the same switcher.

---

## Step 9 — SEO & Metadata

- `<html lang="bn">` / `<html lang="en">` set dynamically per locale.
- `<link rel="alternate" hreflang="bn" href="…">` /
  `<link rel="alternate" hreflang="en" href="…">` on every page for
  Google's language indexing.
- `og:locale` meta tag per locale (`bn_BD`, `en_US`).
- `robots.ts` and `sitemap.ts` updated to generate entries for both
  locales.
- JSON-LD (`lib/jsonld.ts`) outputs `inLanguage` per locale.

---

## Step 10 — Adding a New Language Later

When you want to add a third language (e.g. Arabic, Hindi):

1. Create `messages/ar.json` — copy `en.json`, translate.
2. Create `lib/content/pages.ar.ts` (or add DB content rows with
   `locale: 'ar'`).
3. Add `'ar'` to the `locales` array in `next-intl` config (one line).
4. Add `dir="rtl"` handling in `layout.tsx` if the language is RTL.
5. Add font (`Noto Sans Arabic`) to the font stack.
6. Done — no structural or routing changes needed. Every component already
   uses `useTranslations()`.

**Time to add a new language:** translation effort only, zero code changes.

---

## Implementation Order

| Step | What                                                        | Effort | Depends on |
| ---- | ----------------------------------------------------------- | ------ | ---------- |
| 1    | Install `next-intl`, create `[locale]` segment, middleware  | Small  | Nothing    |
| 2    | Create `messages/en.json` with all extracted strings        | Medium | Step 1     |
| 3    | Migrate public site components to `useTranslations()`       | Medium | Step 2     |
| 4    | Migrate dashboard components to `useTranslations()`         | Medium | Step 2     |
| 5    | Replace fake Header toggle with real locale switcher        | Small  | Step 1     |
| 6    | Create `messages/bn.json` (Bangla translations)             | Medium | Step 2     |
| 7    | Bangla font + number/date formatting                        | Small  | Step 1     |
| 8    | Content system locale split (`pages.en.ts` / `pages.bn.ts`) | Medium | Step 3     |
| 9    | API error codes (replace English strings)                   | Small  | Nothing    |
| 10   | SEO metadata, hreflang, sitemap, JSON-LD                    | Small  | Step 1     |

Steps 1–5 and 9 can be done now (before any feature roadmap phase). Steps
6–8 (actual Bangla translation) can happen in parallel with feature
development — components are wired to translation keys and fall back to
English until Bangla translations are filled in.
