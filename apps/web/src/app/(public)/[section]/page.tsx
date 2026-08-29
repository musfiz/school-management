import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findNav, mainNav } from "@/lib/navigation";
import { getPage } from "@/lib/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { Breadcrumbs, Container, JsonLd, PageHeader, Section } from "@/components/ui";
import ContentRenderer from "@/components/ContentRenderer";

export function generateStaticParams() {
  // Pre-render index pages for each top-level section that has children.
  return mainNav
    .filter((i) => i.children)
    .map((i) => ({ section: i.section }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const nav = findNav(section);
  if (!nav) return {};
  const doc = getPage(section);
  return { title: doc.title, description: doc.description };
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const nav = findNav(section);
  if (!nav) notFound();

  const doc = getPage(section);
  const childLinks = nav.children ?? [];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", href: "/" }, { name: doc.title, href: `/${section}` }])} />
      <PageHeader eyebrow={nav.label} title={doc.title} description={doc.description} />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: nav.label, href: `/${section}` }]} />

      <Section>
        <ContentRenderer blocks={doc.blocks} />

        {childLinks.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-xl font-bold text-navy-900">Explore {nav.label}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {childLinks.map((c) => (
                <a
                  key={c.href}
                  href={c.href}
                  className="group flex items-center justify-between rounded-card border border-ink-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
                >
                  <span>
                    <span className="block font-display text-base font-bold text-navy-900">
                      {c.label}
                    </span>
                    {c.description && (
                      <span className="block text-sm text-ink-500">{c.description}</span>
                    )}
                  </span>
                  <span className="text-brand-600 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </Section>
    </>
  );
}
