import type { Locale } from "@/i18n/config";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

/** Raw bilingual shape from DB/API used in dashboard management */
export interface HeroSectionSettings {
  isVisible: boolean;
  admissionYear: string;
  tagline1: string;
  tagline1Bn: string;
  tagline2: string;
  tagline2Bn: string;
  tagline3: string;
  tagline3Bn: string;
  shortDescription: string;
  shortDescriptionBn: string;
  showApplyButton: boolean;
  instituteOpenInfo: string;
  instituteOpenInfoBn: string;
  phone: string;
}

/** Resolved shape for public site */
export interface PublicHeroSection {
  isVisible: boolean;
  admissionYear: string;
  tagline1: string;
  tagline2: string;
  tagline3: string;
  shortDescription: string;
  showApplyButton: boolean;
  instituteOpenInfo: string;
  phone: string;
}

export const defaultHeroSettings: PublicHeroSection = {
  isVisible: true,
  admissionYear: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
  tagline1: "Building Tomorrow’s Leaders",
  tagline2: "Inspiring Excellence in Every Student",
  tagline3: "Through Knowledge & Values",
  shortDescription:
    "Empowering students to achieve their full potential through rigorous academics, holistic development, and a vibrant learning community.",
  showApplyButton: true,
  instituteOpenInfo: "Open house: Sep 19 · 10am",
  phone: "+880 1700-000000",
};

function localize(
  locale: Locale,
  en: string | null | undefined,
  bn: string | null | undefined,
  fallback: string,
): string {
  if (locale === "bn" && bn) return bn;
  return en || fallback;
}

function merge(data: Partial<HeroSectionSettings> | null, locale: Locale): PublicHeroSection {
  if (!data) return defaultHeroSettings;
  return {
    isVisible: data.isVisible !== false,
    admissionYear: data.admissionYear || defaultHeroSettings.admissionYear,
    tagline1: localize(locale, data.tagline1, data.tagline1Bn, defaultHeroSettings.tagline1),
    tagline2: localize(locale, data.tagline2, data.tagline2Bn, defaultHeroSettings.tagline2),
    tagline3: localize(locale, data.tagline3, data.tagline3Bn, defaultHeroSettings.tagline3),
    shortDescription: localize(
      locale,
      data.shortDescription,
      data.shortDescriptionBn,
      defaultHeroSettings.shortDescription,
    ),
    showApplyButton: data.showApplyButton !== false,
    instituteOpenInfo: localize(
      locale,
      data.instituteOpenInfo,
      data.instituteOpenInfoBn,
      defaultHeroSettings.instituteOpenInfo,
    ),
    phone: data.phone || defaultHeroSettings.phone,
  };
}

export async function getHeroSection(locale: Locale): Promise<PublicHeroSection> {
  try {
    const res = await fetch(`${API_BASE}/hero-section`, { next: { revalidate: 60 } });
    if (!res.ok) return defaultHeroSettings;
    const data = (await res.json()) as Partial<HeroSectionSettings>;
    return merge(data, locale);
  } catch {
    return defaultHeroSettings;
  }
}
