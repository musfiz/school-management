import Link from "next/link";
import type { HomepageSectionWithItems } from "@/lib/homepage";
import type { Locale } from "@/i18n/config";
import type { PublicSiteSettings } from "@/lib/site-settings";
import { Section } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { homepageIcon } from "./icon-registry";

/** Picks the Bangla column when the locale is "bn" and one was saved,
 *  otherwise English, otherwise null so the caller can skip the block. */
function pick(
  locale: Locale,
  en: string | null | undefined,
  bn: string | null | undefined,
): string | null {
  if (locale === "bn" && bn) return bn;
  return en ?? null;
}

/**
 * Full-width band of value pillars ("Knowledge · Discipline · Excellence").
 * Renders one column per `value` item; with no items it collapses to just the
 * heading so a freshly created section still shows its title.
 */
export function ValuesBand({
  section,
  locale,
}: {
  section: HomepageSectionWithItems;
  locale: Locale;
}) {
  const title = pick(locale, section.titleEn, section.titleBn);
  const eyebrow = pick(locale, section.eyebrowEn, section.eyebrowBn);
  const items = section.items.filter((i) => i.itemKey === "value");

  return (
    <Section className="relative overflow-hidden bg-navy-900">
      <div className="absolute inset-0 -z-10 bg-grid opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="absolute -left-20 top-0 -z-10 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="absolute -right-16 bottom-0 -z-10 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl" />

      {title && (
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow && (
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold-400">{eyebrow}</p>
          )}
          <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {title}
          </h2>
          <span className="mx-auto mt-6 block h-1 w-16 rounded-full bg-gold-400" />
        </div>
      )}

      {items.length > 0 && (
        <ul className={`mt-14 grid gap-8 ${items.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
          {items.map((item) => {
            const Icon = homepageIcon(item.icon);
            const heading = pick(locale, item.titleEn, item.titleBn);
            const sub = pick(locale, item.subtitleEn, item.subtitleBn);
            return (
              <li key={item.id} className="group text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-gold-400 transition-colors group-hover:border-gold-400/40 group-hover:bg-white/10">
                  <Icon className="h-6 w-6" />
                </span>
                {heading && (
                  <h3 className="mt-5 font-display text-lg font-bold text-white">{heading}</h3>
                )}
                {sub && <p className="mt-2 text-sm leading-relaxed text-navy-100/70">{sub}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/**
 * Split "About school" block: narrative on the left, stat tiles on the right.
 * Falls back to the site name + establishment year when no prose is saved, so
 * a new install renders something sensible.
 */
export function AboutSchool({
  section,
  locale,
  settings,
}: {
  section: HomepageSectionWithItems;
  locale: Locale;
  settings: PublicSiteSettings;
}) {
  const eyebrow = pick(locale, section.eyebrowEn, section.eyebrowBn);
  const title = pick(locale, section.titleEn, section.titleBn);
  const body = pick(locale, section.bodyEn, section.bodyBn);
  const ctaText = pick(locale, section.ctaTextEn, section.ctaTextBn);

  const bullets = section.items.filter((i) => i.itemKey === "bullet");
  const stats = section.items.filter((i) => i.itemKey === "stat");

  // Fallback copy, mirroring the old hard-coded AboutPreview.
  const heading =
    title ?? `A half-century of shaping bright futures`;
  const paragraph =
    body ??
    `${settings.established ? `Since ${settings.established}, ` : ""}${settings.siteName} has been a cornerstone of the community — combining academic excellence with the values of discipline, curiosity and service.`;

  return (
    <Section className={section.background === "muted" ? "bg-ink-50" : "bg-white"}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-gold-600">
            {eyebrow ?? "About us"}
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-navy-900 sm:text-4xl">
            {heading}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">{paragraph}</p>

          {bullets.length > 0 && (
            <ul className="mt-6 space-y-3">
              {bullets.map((item) => {
                const text = pick(locale, item.titleEn, item.titleBn) ?? pick(locale, item.bodyEn, item.bodyBn);
                if (!text) return null;
                return (
                  <li key={item.id} className="flex items-start gap-3 text-ink-700">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-gold-500 text-navy-900">
                      <ArrowRightIcon className="h-3 w-3" />
                    </span>
                    {text}
                  </li>
                );
              })}
            </ul>
          )}

          {ctaText && section.ctaHref && (
            <Link
              href={section.ctaHref}
              className="mt-8 inline-flex items-center gap-2 rounded-sm bg-navy-800 px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-900"
            >
              {ctaText}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          )}
        </div>

        {stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {stats.map((item) => {
              const value = pick(locale, item.titleEn, item.titleBn);
              const label = pick(locale, item.subtitleEn, item.subtitleBn) ?? pick(locale, item.bodyEn, item.bodyBn);
              return (
                <div
                  key={item.id}
                  className="rounded-sm border border-ink-200 bg-ink-50 p-6 text-center shadow-soft"
                >
                  {value && (
                    <p className="font-display text-3xl font-extrabold text-brand-600">{value}</p>
                  )}
                  {label && <p className="mt-1 text-sm font-medium text-ink-500">{label}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[
              { v: "2,400+", l: "Students" },
              { v: "96", l: "Teachers" },
              { v: "12k+", l: "Library books" },
              { v: "98%", l: "Pass rate" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-sm border border-ink-200 bg-ink-50 p-6 text-center shadow-soft"
              >
                <p className="font-display text-3xl font-extrabold text-brand-600">{s.v}</p>
                <p className="mt-1 text-sm font-medium text-ink-500">{s.l}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

