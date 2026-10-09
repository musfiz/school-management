import { getLocale } from "next-intl/server";
import HeroSlider, { type HeroSlide } from "@/components/HeroSlider";
import Hero from "@/components/Hero";
import { AboutPreview, NoticeBoard } from "@/components/HomeSections";
import { getSiteSettings } from "@/lib/site-settings";
import { getHeroSection } from "@/lib/hero-section";
import { getCmsPage } from "@/lib/cms-pages";
import { getSliders } from "@/lib/sliders";
import type { NoticeItem } from "@/lib/notices";
import { resolveImageUrl } from "@/lib/media";
import type { Locale } from "@/i18n/config";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function getHomeNotices(): Promise<NoticeItem[]> {
  try {
    const res = await fetch(`${API_BASE}/notices`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const locale = (await getLocale()) as Locale;
  const [settings, hero, principalSpeech, aboutUs, notices] = await Promise.all([
    getSiteSettings(locale),
    getHeroSection(locale),
    getCmsPage("principal-speech"),
    getCmsPage("about-us"),
    getHomeNotices(),
  ]);

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

  return (
    <>
      <HeroSlider slides={heroSlides} />
      {hero.isVisible && <Hero hero={hero} />}
      <AboutPreview
        settings={settings}
        principalSpeech={principalSpeech}
        aboutUs={aboutUs}
        locale={locale}
      />
      <NoticeBoard notices={notices} locale={locale} />
    </>
  );
}
