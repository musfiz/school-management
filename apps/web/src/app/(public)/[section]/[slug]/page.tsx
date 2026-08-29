import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findNav, mainNav } from "@/lib/navigation";
import { getPage } from "@/lib/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { Breadcrumbs, Container, JsonLd, PageHeader, Section } from "@/components/ui";
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

  const doc = getPage(section, slug);
  const crumbs = [
    { name: "Home", href: "/" },
    ...(parent ? [{ name: parent.label, href: `/${section}` }] : []),
    { name: doc.title, href: `/${section}/${slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <PageHeader
        eyebrow={parent?.label}
        title={doc.title}
        description={doc.description}
      />
      <Breadcrumbs items={crumbs} />
      <Section>
        <ContentRenderer blocks={doc.blocks} />
      </Section>
    </>
  );
}
