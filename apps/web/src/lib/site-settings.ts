import { site } from "@/lib/site";
import type { Locale } from "@/i18n/config";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

export type HeaderDisplayMode = "logo" | "info" | "both";

/** Raw bilingual shape — matches the API/DB exactly. Used by the dashboard
 *  Site Settings editor, which needs to read/write both languages at once. */
export interface SiteSettings {
  siteName: string;
  siteNameBn: string;
  tagline: string;
  taglineBn: string;
  description: string;
  descriptionBn: string;
  logoUrl: string;
  headerDisplay: HeaderDisplayMode;
  phone: string;
  email: string;
  address: string;
  addressBn: string;
  established?: number;
  eiin?: string;
  facebookUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  copyrightText: string;
  copyrightTextBn: string;
}

/** Resolved for a single locale — what the public Header/Footer render. */
export interface PublicSiteSettings {
  siteName: string;
  tagline: string;
  description: string;
  logoUrl: string;
  headerDisplay: HeaderDisplayMode;
  phone: string;
  email: string;
  address: string;
  established?: number;
  eiin?: string;
  facebookUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  copyrightText: string;
}

interface ApiSiteSettings {
  siteName?: string | null;
  siteNameBn?: string | null;
  tagline?: string | null;
  taglineBn?: string | null;
  description?: string | null;
  descriptionBn?: string | null;
  logoUrl?: string | null;
  headerDisplay?: HeaderDisplayMode | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  addressBn?: string | null;
  established?: number | null;
  eiin?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  copyrightText?: string | null;
  copyrightTextBn?: string | null;
}

/** Falls back to the static `site` config for any field left blank in the
 *  CMS, so a fresh install still renders a sensible header/footer. */
const defaultSettings: PublicSiteSettings = {
  siteName: site.name,
  tagline: site.tagline,
  description: site.description,
  logoUrl: "/logo.png",
  headerDisplay: "both",
  phone: site.phone,
  email: site.email,
  address: site.address,
  established: site.established,
  eiin: site.eiin,
  facebookUrl: site.facebook,
  twitterUrl: site.twitter,
  linkedinUrl: site.linkedin,
  youtubeUrl: site.youtube,
  copyrightText: `© ${new Date().getFullYear()} ${site.name}. All rights reserved.`,
};

/** Picks the Bangla text when the locale is "bn" and one was saved,
 *  otherwise falls back to English, then to the static default. */
function localize(
  locale: Locale,
  en: string | null | undefined,
  bn: string | null | undefined,
  fallback: string,
): string {
  if (locale === "bn" && bn) return bn;
  return en || fallback;
}

function merge(data: ApiSiteSettings | null, locale: Locale): PublicSiteSettings {
  if (!data) return defaultSettings;
  return {
    siteName: localize(locale, data.siteName, data.siteNameBn, defaultSettings.siteName),
    tagline: localize(locale, data.tagline, data.taglineBn, defaultSettings.tagline),
    description: localize(locale, data.description, data.descriptionBn, defaultSettings.description),
    logoUrl: data.logoUrl || defaultSettings.logoUrl,
    headerDisplay: data.headerDisplay || defaultSettings.headerDisplay,
    phone: data.phone || defaultSettings.phone,
    email: data.email || defaultSettings.email,
    address: localize(locale, data.address, data.addressBn, defaultSettings.address),
    established: data.established ?? defaultSettings.established,
    eiin: data.eiin || defaultSettings.eiin,
    facebookUrl: data.facebookUrl || defaultSettings.facebookUrl,
    twitterUrl: data.twitterUrl || defaultSettings.twitterUrl,
    linkedinUrl: data.linkedinUrl || defaultSettings.linkedinUrl,
    youtubeUrl: data.youtubeUrl || defaultSettings.youtubeUrl,
    copyrightText: localize(
      locale,
      data.copyrightText,
      data.copyrightTextBn,
      defaultSettings.copyrightText,
    ),
  };
}

/**
 * Server-side fetch of the public site settings, talking to the NestJS API
 * directly (no auth needed, mirrors `getHeaderNav`). Falls back to the
 * static `site` config when the API is unreachable or nothing is saved yet,
 * and resolves bilingual fields down to the given locale.
 */
export async function getSiteSettings(locale: Locale): Promise<PublicSiteSettings> {
  try {
    const res = await fetch(`${API_BASE}/site-settings`, { next: { revalidate: 60 } });
    if (!res.ok) return defaultSettings;
    const data = (await res.json()) as ApiSiteSettings;
    return merge(data, locale);
  } catch {
    return defaultSettings;
  }
}

