import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { findNav, mainNav } from "@/lib/navigation";
import { getPage } from "@/lib/content/pages";
import { getCmsPage } from "@/lib/cms-pages";
import { getGoverningBody } from "@/lib/governing-body";
import { getExPrincipals } from "@/lib/ex-principals";
import { getStaffMembers } from "@/lib/staff";
import { getTeachers } from "@/lib/teachers";
import { resolveImageUrl, isExternalImage } from "@/lib/media";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { Breadcrumbs, JsonLd, PageHeader, Section } from "@/components/ui";
import { ContentNotFound } from "@/components/ContentNotFound";

export function generateStaticParams() {
  // Pre-render every registered second-level page.
  return mainNav.flatMap((i) =>
    (i.children ?? []).map((c) => ({ section: c.section, slug: c.slug! })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string; slug: string }>;
}): Promise<Metadata> {
  const { section, slug } = await params;
  const nav = findNav(section, slug);
  if (!nav) return {};
  const cms = await getCmsPage(slug);
  if (cms) return { title: cms.titleEn };
  const doc = getPage(section, slug);
  return { title: doc.title, description: doc.description };
}

export default async function SubPage({
  params,
}: {
  params: Promise<{ section: string; slug: string }>;
}) {
  const { section, slug } = await params;
  const nav = findNav(section, slug);
  const parent = mainNav.find((i) => i.section === section);

  // Unknown route segment → 404. Known nav entry (or registered pattern) → render.
  if (!nav && !parent) notFound();

  // `nav.json` keys the results section as "results" (plural) while
  // `mainNav` uses "result" — translate defensively, falling back to the
  // static English label for any section without a message key.
  const tNav = await getTranslations("nav");
  function translateSection(sectionKey: string): string | undefined {
    try {
      const key = sectionKey === "result" ? "results" : sectionKey;
      return tNav(key as Parameters<typeof tNav>[0]);
    } catch {
      return undefined;
    }
  }
  /** Translate a leaf (sub-page) label by mapping its kebab-case slug to a
   *  camelCase `nav` message key (e.g. "about-us" → nav.aboutUs). Returns
   *  undefined when no key exists for this slug so callers fall back to the
   *  static label. */
  function translateLeaf(slug: string): string | undefined {
    try {
      const key = slug
        .split("-")
        .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join("");
      return tNav(key as Parameters<typeof tNav>[0]);
    } catch {
      return undefined;
    }
  }
  const home = tNav("home");
  const tContent = await getTranslations("content");

  // Governing body roster is dashboard-managed (name/designation/photo list)
  // rather than a single bilingual document, so it gets its own branch.
  if (slug === "governing-body") {
    const members = await getGoverningBody();
    const locale = await getLocale();
    // Each row picks the Bangla text when the locale is bn and a translation
    // was provided; otherwise falls back to the English value so untranslated
    // rows still render correctly under a Bangla session.
    const localized = members.map((m) => ({
      ...m,
      displayName: (locale === "bn" && m.nameBn) || m.name,
      displayDesignation: (locale === "bn" && m.designationBn) || m.designation,
    }));
    const parentLabel = (parent && translateSection(parent.section)) || parent?.label;
    const title =
      translateLeaf(slug) ||
      (locale === "bn" && nav?.labelBn) ||
      nav?.label ||
      "Governing Body";
    const crumbs = [
      { name: home, href: "/" },
      ...(parent ? [{ name: parentLabel!, href: `/${section}` }] : []),
      { name: title, href: `/${section}/${slug}` },
    ];

    return (
      <>
        <JsonLd data={breadcrumbJsonLd(crumbs)} />
        <PageHeader eyebrow={parentLabel} title={title} />
        <Breadcrumbs items={crumbs} />
        <Section>
          {localized.length === 0 ? (
            <ContentNotFound
              tNotFound={tContent("notFound")}
              tNotFoundDescription={tContent("notFoundDescription")}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {localized.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col items-center rounded-md border border-ink-200 bg-white p-6 text-center shadow-soft"
                >
                  {m.imageUrl ? (
                    <Image
                      src={resolveImageUrl(m.imageUrl)}
                      alt={m.displayName}
                      width={112}
                      height={112}
                      unoptimized={isExternalImage(m.imageUrl)}
                      className="h-28 w-28 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-28 w-28 items-center justify-center rounded-full bg-ink-100 text-2xl font-semibold text-ink-400">
                      {m.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <p className="mt-4 font-display text-lg font-bold text-navy-900">{m.displayName}</p>
                  <p className="mt-1 text-sm text-ink-500">{m.displayDesignation}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </>
    );
  }

  // Former principals roster is dashboard-managed (name/photo/tenure list)
  // rather than a single bilingual document, so it gets its own branch —
  // mirroring the governing-body branch but without a designation column.
  if (slug === "ex-principals") {
    const principals = await getExPrincipals();
    const locale = await getLocale();
    // Each row picks the Bangla text when the locale is bn and a translation
    // was provided; otherwise falls back to the English value so untranslated
    // rows still render correctly under a Bangla session.
    const localized = principals.map((p) => ({
      ...p,
      displayName: (locale === "bn" && p.nameBn) || p.name,
    }));
    const parentLabel = (parent && translateSection(parent.section)) || parent?.label;
    const title =
      translateLeaf(slug) ||
      (locale === "bn" && nav?.labelBn) ||
      nav?.label ||
      "Ex-Principals";
    const crumbs = [
      { name: home, href: "/" },
      ...(parent ? [{ name: parentLabel!, href: `/${section}` }] : []),
      { name: title, href: `/${section}/${slug}` },
    ];

    return (
      <>
        <JsonLd data={breadcrumbJsonLd(crumbs)} />
        <PageHeader eyebrow={parentLabel} title={title} />
        <Breadcrumbs items={crumbs} />
        <Section>
          {localized.length === 0 ? (
            <ContentNotFound
              tNotFound={tContent("notFound")}
              tNotFoundDescription={tContent("notFoundDescription")}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {localized.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col items-center rounded-md border border-ink-200 bg-white p-6 text-center shadow-soft"
                >
                  {p.imageUrl ? (
                    <Image
                      src={resolveImageUrl(p.imageUrl)}
                      alt={p.displayName}
                      width={112}
                      height={112}
                      unoptimized={isExternalImage(p.imageUrl)}
                      className="h-28 w-28 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-28 w-28 items-center justify-center rounded-full bg-ink-100 text-2xl font-semibold text-ink-400">
                      {p.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <p className="mt-4 font-display text-lg font-bold text-navy-900">{p.displayName}</p>
                  {p.tenure && <p className="mt-1 text-sm text-ink-500">{p.tenure}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>
      </>
    );
  }

  // Teachers roster is dashboard-managed (name/designation/department/photo/
  // join-date list) rather than a single bilingual document, so it gets its
  // own branch — the same card-grid pattern as the governing-body branch.
  if (slug === "teachers") {
    const teachers = await getTeachers();
    const locale = await getLocale();
    // Each row picks the Bangla text when the locale is bn and a translation
    // was provided; otherwise falls back to the English value.
    const localized = teachers.map((t) => ({
      ...t,
      displayName: (locale === "bn" && t.nameBn) || t.name,
      displayDesignation: (locale === "bn" && t.designationBn) || t.designation,
      displayDepartment: (locale === "bn" && t.departmentBn) || t.department,
    }));
    const parentLabel = (parent && translateSection(parent.section)) || parent?.label;
    const title =
      translateLeaf(slug) ||
      (locale === "bn" && nav?.labelBn) ||
      nav?.label ||
      "Teachers";
    const crumbs = [
      { name: home, href: "/" },
      ...(parent ? [{ name: parentLabel!, href: `/${section}` }] : []),
      { name: title, href: `/${section}/${slug}` },
    ];

    return (
      <>
        <JsonLd data={breadcrumbJsonLd(crumbs)} />
        <PageHeader eyebrow={parentLabel} title={title} />
        <Breadcrumbs items={crumbs} />
        <Section>
          {localized.length === 0 ? (
            <ContentNotFound
              tNotFound={tContent("notFound")}
              tNotFoundDescription={tContent("notFoundDescription")}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {localized.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col items-center rounded-md border border-ink-200 bg-white p-6 text-center shadow-soft"
                >
                  {t.imageUrl ? (
                    <Image
                      src={resolveImageUrl(t.imageUrl)}
                      alt={t.displayName}
                      width={112}
                      height={112}
                      unoptimized={isExternalImage(t.imageUrl)}
                      className="h-28 w-28 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-28 w-28 items-center justify-center rounded-full bg-ink-100 text-2xl font-semibold text-ink-400">
                      {t.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <p className="mt-4 font-display text-lg font-bold text-navy-900">{t.displayName}</p>
                  <p className="mt-1 text-sm text-ink-500">{t.displayDesignation}</p>
                  {t.displayDepartment && (
                    <p className="mt-0.5 text-sm text-brand-600">{t.displayDepartment}</p>
                  )}
                  {t.jointDate && (
                    <p className="mt-1 text-xs text-ink-400">
                      Joined: {new Date(t.jointDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </>
    );
  }

  // Staff roster is dashboard-managed (name/designation/photo list) rather
  // than a single bilingual document, so it gets its own branch — the same
  // card-grid pattern as the governing-body branch.
  if (slug === "staff-information") {
    const staff = await getStaffMembers();
    const locale = await getLocale();
    // Each row picks the Bangla text when the locale is bn and a translation
    // was provided; otherwise falls back to the English value.
    const localized = staff.map((s) => ({
      ...s,
      displayName: (locale === "bn" && s.nameBn) || s.name,
      displayDesignation: (locale === "bn" && s.designationBn) || s.designation,
    }));
    const parentLabel = (parent && translateSection(parent.section)) || parent?.label;
    const title =
      translateLeaf(slug) ||
      (locale === "bn" && nav?.labelBn) ||
      nav?.label ||
      "Staff Information";
    const crumbs = [
      { name: home, href: "/" },
      ...(parent ? [{ name: parentLabel!, href: `/${section}` }] : []),
      { name: title, href: `/${section}/${slug}` },
    ];

    return (
      <>
        <JsonLd data={breadcrumbJsonLd(crumbs)} />
        <PageHeader eyebrow={parentLabel} title={title} />
        <Breadcrumbs items={crumbs} />
        <Section>
          {localized.length === 0 ? (
            <ContentNotFound
              tNotFound={tContent("notFound")}
              tNotFoundDescription={tContent("notFoundDescription")}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {localized.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col items-center rounded-md border border-ink-200 bg-white p-6 text-center shadow-soft"
                >
                  {s.imageUrl ? (
                    <Image
                      src={resolveImageUrl(s.imageUrl)}
                      alt={s.displayName}
                      width={112}
                      height={112}
                      unoptimized={isExternalImage(s.imageUrl)}
                      className="h-28 w-28 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-28 w-28 items-center justify-center rounded-full bg-ink-100 text-2xl font-semibold text-ink-400">
                      {s.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <p className="mt-4 font-display text-lg font-bold text-navy-900">{s.displayName}</p>
                  <p className="mt-1 text-sm text-ink-500">{s.displayDesignation}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </>
    );
  }

  // Dashboard-managed content (bilingual + image) takes priority over the
  // hand-authored static blocks below, once an admin has saved this slug.
  const cms = await getCmsPage(slug);
  if (cms) {
    const locale = await getLocale();
    const title = (locale === "bn" && cms.titleBn) || cms.titleEn;
    const content = (locale === "bn" && cms.contentBn) || cms.contentEn;
    const hasContent = !!(content && content.trim());
    const parentLabel =
      (locale === "bn" && parent && translateSection(parent.section)) || parent?.label;
    const crumbs = [
      { name: home, href: "/" },
      ...(parent ? [{ name: parentLabel!, href: `/${section}` }] : []),
      { name: title, href: `/${section}/${slug}` },
    ];

    return (
      <>
        <JsonLd data={breadcrumbJsonLd(crumbs)} />
        <PageHeader eyebrow={parentLabel} title={title} />
        <Breadcrumbs items={crumbs} />
        <Section>
          {/* Newspaper-style: the image is a fixed left column and the text
              flows to its right; once the text runs past the image's height it
              continues full-width below the image. Stacks full-width on mobile.
              Uses flexbox (not float) so the text reliably wraps beside the
              image regardless of the `prose` block wrapper. */}
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:gap-8">
            {cms.imageUrl && (
              <Image
                src={resolveImageUrl(cms.imageUrl)}
                alt={title}
                width={400}
                height={400}
                unoptimized={isExternalImage(cms.imageUrl)}
                className="aspect-square w-full shrink-0 rounded-md object-cover sm:h-100 sm:w-100"
              />
            )}
            {hasContent ? (
              <div
                // Render the admin-authored rich text (headings, lists, links,
                // etc.) as HTML. sanitizeHtml strips anything outside a strict
                // allowlist, so no <script>/event handlers survive.
                className="cms-rich min-w-0 flex-1 wrap-break-word"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
              />
            ) : (
              <div className="min-w-0 flex-1">
                <ContentNotFound
                  tNotFound={tContent("notFound")}
                  tNotFoundDescription={tContent("notFoundDescription")}
                />
              </div>
            )}
          </div>
        </Section>
      </>
    );
  }

  // No CMS-managed page saved for this slug — show the friendly "content not
  // found" empty state instead of sample/placeholder text, so admins know to
  // publish real content from the dashboard. The page title and parent label
  // are localized (active locale) so the empty-state message and surrounding
  // chrome read consistently in either language.
  const locale = await getLocale();
  const title =
    translateLeaf(slug) ||
    (locale === "bn" && nav?.labelBn) ||
    nav?.label ||
    slug ||
    section;
  const parentLabel = translateSection(section) || parent?.label;
  const crumbs = [
    { name: home, href: "/" },
    ...(parent ? [{ name: parentLabel!, href: `/${section}` }] : []),
    { name: title, href: `/${section}/${slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <PageHeader eyebrow={parentLabel} title={title} />
      <Breadcrumbs items={crumbs} />
      <Section>
        <ContentNotFound
          tNotFound={tContent("notFound")}
          tNotFoundDescription={tContent("notFoundDescription")}
        />
      </Section>
    </>
  );
}