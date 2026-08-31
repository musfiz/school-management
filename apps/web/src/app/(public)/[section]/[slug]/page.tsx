import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { findNav, mainNav } from "@/lib/navigation";
import { getPage } from "@/lib/content/pages";
import { getCmsPage } from "@/lib/cms-pages";
import { getGoverningBody } from "@/lib/governing-body";
import { resolveImageUrl, isExternalImage } from "@/lib/media";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { Breadcrumbs, JsonLd, PageHeader, Section } from "@/components/ui";
import ContentRenderer from "@/components/ContentRenderer";

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
      return tNav(sectionKey === "result" ? "results" : sectionKey);
    } catch {
      return undefined;
    }
  }
  const home = tNav("home");

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
    const title = nav?.label || "Governing Body";
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
            <p className="text-ink-500">No governing body members published yet.</p>
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

  // Dashboard-managed content (bilingual + image) takes priority over the
  // hand-authored static blocks below, once an admin has saved this slug.
  const cms = await getCmsPage(slug);
  if (cms) {
    const locale = await getLocale();
    const title = (locale === "bn" && cms.titleBn) || cms.titleEn;
    const content = (locale === "bn" && cms.contentBn) || cms.contentEn;
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
          {/* Image floats left (newspaper-style) so the body text wraps
              around it on larger screens; stacks full-width on mobile. */}
          {cms.imageUrl && (
            <Image
              src={resolveImageUrl(cms.imageUrl)}
              alt={title}
              width={400}
              height={400}
              unoptimized={isExternalImage(cms.imageUrl)}
              className="mb-4 h-auto w-full max-w-[400px] rounded-md object-cover sm:float-left sm:mr-8"
            />
          )}
          {content && (
            <div className="prose max-w-none break-words">
              {content.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="mb-4 text-justify leading-relaxed text-ink-700">
                  {para}
                </p>
              ))}
            </div>
          )}
          <div className="clear-both" />
        </Section>
      </>
    );
  }

  const doc = getPage(section, slug);
  const parentLabel = translateSection(section) || parent?.label;
  const crumbs = [
    { name: home, href: "/" },
    ...(parent ? [{ name: parentLabel!, href: `/${section}` }] : []),
    { name: doc.title, href: `/${section}/${slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <PageHeader eyebrow={parent?.label} title={doc.title} description={doc.description} />
      <Breadcrumbs items={crumbs} />
      <Section>
        <ContentRenderer blocks={doc.blocks} />
      </Section>
    </>
  );
}

