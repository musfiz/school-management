const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

/** Raw bilingual shape — matches the API/DB exactly. The dashboard editor
 *  needs to read and write both languages at once, so it uses this. */
export interface HomepageSection {
  id: number;
  sectionKey: string;
  labelEn: string;
  labelBn: string | null;
  eyebrowEn: string | null;
  eyebrowBn: string | null;
  titleEn: string | null;
  titleBn: string | null;
  bodyEn: string | null;
  bodyBn: string | null;
  imageUrl: string | null;
  ctaTextEn: string | null;
  ctaTextBn: string | null;
  ctaHref: string | null;
  background: HomepageBackground;
  sortOrder: number;
  isVisible: boolean;
}

export interface HomepageItem {
  id: number;
  sectionId: number;
  itemKey: HomepageItemKey;
  titleEn: string | null;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  bodyEn: string | null;
  bodyBn: string | null;
  icon: string | null;
  imageUrl: string | null;
  href: string | null;
  metaEn: string | null;
  metaBn: string | null;
  sortOrder: number;
  isVisible: boolean;
}

/** A section as the public homepage receives it: visible items already
 *  filtered and ordered by the API. */
export interface HomepageSectionWithItems extends HomepageSection {
  items: HomepageItem[];
}

export type HomepageBackground = "white" | "muted" | "navy";

/** Semantic slot an item fills inside its section. Renderers switch on this. */
export type HomepageItemKey = "value" | "bullet" | "stat" | "card" | "image";

/**
 * Server-side fetch of the dashboard-managed homepage sections, talking to the
 * NestJS API directly (no auth needed, mirrors `getSliders`). Returns an empty
 * array when the API is unreachable or no section is visible, so the homepage
 * falls back to its built-in sections rather than rendering nothing.
 */
export async function getHomepageSections(): Promise<HomepageSectionWithItems[]> {
  try {
    const res = await fetch(`${API_BASE}/homepage/sections`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as HomepageSectionWithItems[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}