import type { HomepageSectionWithItems } from "@/lib/homepage";
import type { Locale } from "@/i18n/config";
import type { PublicSiteSettings } from "@/lib/site-settings";
import { AboutSchool, ValuesBand } from "./Sections";

/**
 * Maps a section's `sectionKey` to its renderer.
 *
 * A key with no entry here is skipped rather than rendered raw — an unmapped
 * key means either the section is still being built or someone changed its key
 * in the database, and dumping unstyled content onto the public homepage would
 * be worse than omitting it. The dashboard flags unmapped keys as "needs a
 * renderer" so the gap is visible instead of silent.
 *
 * Adding a new section type = add a component here + create rows with that key.
 * No migration, no new API endpoint.
 */
const RENDERERS: Record<string, (props: RendererProps) => React.ReactNode> = {
  values: ({ section, locale }) => <ValuesBand section={section} locale={locale} />,
  about: ({ section, locale, settings }) => (
    <AboutSchool section={section} locale={locale} settings={settings} />
  ),
};

interface RendererProps {
  section: HomepageSectionWithItems;
  locale: Locale;
  settings: PublicSiteSettings;
}

/** True when a renderer exists for this section key. */
export function hasRenderer(sectionKey: string): boolean {
  return sectionKey in RENDERERS;
}

/** Section keys the public frontend knows how to render, for the dashboard's
 *  "needs a renderer" hint. */
export function knownSectionKeys(): string[] {
  return Object.keys(RENDERERS);
}

/**
 * Renders dashboard-managed homepage sections in the order and visibility the
 * admin set. Sections the frontend has no renderer for are skipped.
 */
export default function HomepageSections({
  sections,
  locale,
  settings,
}: {
  sections: HomepageSectionWithItems[];
  locale: Locale;
  settings: PublicSiteSettings;
}) {
  return (
    <>
      {sections.map((section) => {
        const render = RENDERERS[section.sectionKey];
        if (!render) return null;
        return <div key={section.id}>{render({ section, locale, settings })}</div>;
      })}
    </>
  );
}