import { getLocale } from "next-intl/server";
import HeroSlider, { type HeroSlide } from "@/components/HeroSlider";
import Hero from "@/components/Hero";
import { NoticeBoard } from "@/components/HomeSections";
import HomepageSections from "@/components/homepage/HomepageSections";
import { getHomepageSections } from "@/lib/homepage";
import { getSiteSettings } from "@/lib/site-settings";
import { getSliders } from "@/lib/sliders";
import { resolveImageUrl } from "@/lib/media";
import type { Locale } from "@/i18n/config";

export default async function Home() {
  const locale = (await getLocale()) as Locale;
  const settings = await getSiteSettings(locale);

  // Dashboard-managed home slides (image + bilingual title). Map the API
  // rows to the hero slide shape — the caption uses the active-locale title
  // so Bangla sessions see the Bangla title. When no active slides exist we
  // leave `heroSlides` empty and HeroSlider falls back to its static images.
  const apiSlides = await getSliders();
  const heroSlides: HeroSlide[] = apiSlides
    .filter((s) => s.imageUrl)
    .map((s) => ({
      src: resolveImageUrl(s.imageUrl),
      alt: (locale === "bn" && s.titleBn) || s.titleEn || "School slide",
      caption: (locale === "bn" && s.titleBn) || s.titleEn || "",
    }));

  // Dashboard-managed sections (values band, about school, …) in the order and
  // visibility the admin set. Returns [] when the API is down or nothing is
  // published, in which case the built-in sections below still render.
  const sections = await getHomepageSections();

  return (
    <>
      <HeroSlider slides={heroSlides} />
      <Hero settings={settings} />
      <HomepageSections sections={sections} locale={locale} settings={settings} />
      <NoticeBoard />
    </>
  );
}