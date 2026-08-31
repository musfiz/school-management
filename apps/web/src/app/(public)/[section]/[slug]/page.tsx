import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { findNav, mainNav } from "@/lib/navigation";
import { getPage } from "@/lib/content/pages";
import { getCmsPage } from "@/lib/cms-pages";
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

