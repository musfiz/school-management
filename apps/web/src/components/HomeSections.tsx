import Link from "next/link";
import Image from "next/image";
import { notices as staticNotices } from "@/lib/content/collections";
import type { PublicSiteSettings } from "@/lib/site-settings";
import type { CmsPage } from "@/lib/cms-pages";
import type { NoticeItem } from "@/lib/notices";
import { resolveImageUrl, isExternalImage } from "@/lib/media";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { Section } from "./ui";
import { ArrowRightIcon } from "./icons";

export function AboutPreview({
  settings,
  principalSpeech,
  aboutUs,
  locale = "en",
}: {
  settings: PublicSiteSettings;
  principalSpeech?: CmsPage | null;
  aboutUs?: CmsPage | null;
  locale?: string;
}) {
  const isSpeechVisible =
    principalSpeech &&
    (principalSpeech.showInHomepage === true || principalSpeech.showInHomepage === undefined);

  const isAboutUsVisible =
    aboutUs && (aboutUs.showInHomepage === true || aboutUs.showInHomepage === undefined);

  // If neither is visible or configured, fallback to default static About Us section
  if (!isSpeechVisible && !isAboutUsVisible) {
    return (
      <Section className="bg-white">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-gold-600">About us</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold text-navy-900 sm:text-4xl">
              A half-century of shaping bright futures
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-600">
              {settings.established && `Since ${settings.established}, `}
              {settings.siteName} has been a cornerstone of the community — combining academic
              excellence with the values of discipline, curiosity and service.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Caring, experienced faculty for every subject",
                "Modern labs, library and a safe campus",
                "Free tuition with support for those who need it",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-ink-700">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-gold-500 text-navy-900">
                    <ArrowRightIcon className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/about/about-us"
              className="mt-8 inline-flex items-center gap-2 rounded-sm bg-navy-800 px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-900"
            >
              Learn our story
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

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
        </div>
      </Section>
    );
  }

  return (
    <div className="space-y-10 bg-white py-12 lg:py-16">
      {/* 1. Principal Speech Section (Image Left, Content Right) */}
      {isSpeechVisible && (
        <Section className="py-0!">
          {(() => {
            const speechTitle =
              (locale === "bn" && principalSpeech.titleBn) || principalSpeech.titleEn;
            const speechContent =
              (locale === "bn" && principalSpeech.contentBn) || principalSpeech.contentEn || "";

            return (
              <div className="relative overflow-hidden rounded-xl border border-navy-100 bg-linear-to-br from-white via-navy-50/20 to-gold-50/20 p-6 shadow-card transition-all hover:shadow-lg sm:p-8 lg:p-10">
                <div className="absolute top-0 left-0 h-1 w-full bg-linear-to-r from-navy-800 via-brand-600 to-gold-500" />
                <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
                  {/* Left: Principal Image */}
                  <div className="flex justify-center lg:col-span-4">
                    {principalSpeech.imageUrl ? (
                      <div className="group relative aspect-4/5 w-full max-w-72 overflow-hidden rounded-xl border-2 border-white shadow-card ring-1 ring-navy-100 sm:max-w-80">
                        <Image
                          src={resolveImageUrl(principalSpeech.imageUrl)}
                          alt={speechTitle}
                          fill
                          unoptimized={isExternalImage(principalSpeech.imageUrl)}
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-4/5 w-full max-w-72 items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-50 text-ink-400 sm:max-w-80">
                        <span className="text-sm font-medium">
                          {locale === "bn" ? "কোন ছবি নেই" : "No Principal Photo"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Principal Speech Content */}
                  <div className="lg:col-span-8">
                    {speechTitle && (
                      <span className="inline-flex items-center gap-2 rounded-md border border-gold-300 bg-gold-50/90 px-3.5 py-1.5 font-display text-sm font-bold tracking-wide text-gold-900 shadow-xs sm:text-base">
                        <span className="h-2 w-2 rounded-full bg-gold-500 ring-2 ring-gold-200" />
                        {speechTitle}
                      </span>
                    )}
                    {speechContent ? (
                      <div
                        className="cms-rich mt-4 line-clamp-6 text-base leading-relaxed text-ink-700 sm:text-lg"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(speechContent) }}
                      />
                    ) : (
                      <p className="mt-4 text-base leading-relaxed text-ink-600 sm:text-lg">
                        {settings.siteName} is committed to fostering academic excellence, moral
                        integrity, and holistic personal growth.
                      </p>
                    )}
                    <div className="mt-6">
                      <Link
                        href="/about/principal-speech"
                        className="inline-flex items-center gap-2 rounded-sm bg-navy-800 px-5 py-3 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-900"
                      >
                        {locale === "bn" ? "সম্পূর্ণ বক্তব্য পড়ুন" : "Read full speech"}
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Section>
      )}

      {/* 2. About Us Section (Text Left, 16:9 Image Right) */}
      {isAboutUsVisible && (
        <Section className="py-0!">
          {(() => {
            const aboutTitle = (locale === "bn" && aboutUs.titleBn) || aboutUs.titleEn;
            const aboutContent =
              (locale === "bn" && aboutUs.contentBn) || aboutUs.contentEn || "";

            return (
              <div className="relative overflow-hidden rounded-xl border border-navy-100 bg-linear-to-br from-white via-ink-50/30 to-brand-50/20 p-6 shadow-card transition-all hover:shadow-lg sm:p-8 lg:p-10">
                <div className="absolute top-0 left-0 h-1 w-full bg-linear-to-r from-gold-500 via-brand-600 to-navy-800" />
                <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
                  {/* Left Side: About Us Content */}
                  <div className="order-2 lg:order-1 lg:col-span-7">
                    {aboutTitle && (
                      <span className="inline-flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3.5 py-1.5 font-display text-sm font-bold tracking-wide text-brand-900 shadow-xs sm:text-base">
                        <span className="h-2 w-2 rounded-full bg-brand-600 ring-2 ring-brand-200" />
                        {aboutTitle}
                      </span>
                    )}
                    {aboutContent ? (
                      <div
                        className="cms-rich mt-4 line-clamp-6 text-base leading-relaxed text-ink-700 sm:text-lg"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(aboutContent) }}
                      />
                    ) : (
                      <p className="mt-4 text-base leading-relaxed text-ink-600 sm:text-lg">
                        {settings.siteName} has a rich heritage of nurturing future leaders and
                        championing educational values.
                      </p>
                    )}
                    <div className="mt-6">
                      <Link
                        href="/about/about-us"
                        className="inline-flex items-center gap-2 rounded-sm bg-navy-800 px-5 py-3 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-900"
                      >
                        {locale === "bn" ? "বিস্তারিত পড়ুন" : "Read more"}
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Right Side: 16:9 Image */}
                  <div className="order-1 flex justify-center lg:order-2 lg:col-span-5">
                    {aboutUs.imageUrl ? (
                      <div className="group relative aspect-video w-full overflow-hidden rounded-xl border-2 border-white shadow-card ring-1 ring-navy-100">
                        <Image
                          src={resolveImageUrl(aboutUs.imageUrl)}
                          alt={aboutTitle}
                          fill
                          unoptimized={isExternalImage(aboutUs.imageUrl)}
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-50 text-ink-400">
                        <span className="text-sm font-medium">
                          {locale === "bn" ? "কোন ছবি নেই" : "No Image"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </Section>
      )}
    </div>
  );
}

export function NoticeBoard({
  notices: dynamicNotices,
  locale = "en",
}: {
  notices?: NoticeItem[];
  locale?: string;
} = {}) {
  const items =
    dynamicNotices && dynamicNotices.length > 0
      ? dynamicNotices.slice(0, 4)
      : staticNotices.slice(0, 4);

  return (
    <Section className="bg-ink-50">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-gold-600">Notice board</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-navy-900 sm:text-4xl">
            Latest notices &amp; circulars
          </h2>
        </div>
        <Link
          href="/others/notice"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-brand-700"
        >
          All notices
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <ul className="mt-8 divide-y divide-ink-200 overflow-hidden rounded-sm border border-ink-200 bg-white shadow-soft">
        {items.map((n) => {
          const isDynamic = "createdAt" in n || "publishDate" in n;
          const rawDate = isDynamic
            ? (n as NoticeItem).publishDate || (n as NoticeItem).createdAt
            : (n as (typeof staticNotices)[0]).date;
          const title = isDynamic
            ? (locale === "bn" && (n as NoticeItem).titleBn) || (n as NoticeItem).title
            : (n as (typeof staticNotices)[0]).title;
          const isPinned = isDynamic
            ? (n as NoticeItem).isPinned
            : (n as (typeof staticNotices)[0]).pinned;

          return (
            <li
              key={n.id}
              className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="w-24 shrink-0 text-sm font-semibold text-brand-600">
                {rawDate
                  ? new Date(rawDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
              <span className="hidden shrink-0 rounded-sm bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700 sm:inline">
                {n.category}
              </span>
              <Link
                href="/others/notice"
                className="flex-1 text-ink-800 transition-colors hover:text-navy-700"
              >
                {title}
              </Link>
              {isPinned && <span className="shrink-0 text-xs font-bold text-gold-600">Pinned</span>}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
