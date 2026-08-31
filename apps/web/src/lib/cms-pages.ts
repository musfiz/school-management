const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

export interface CmsPage {
  slug: string;
  titleEn: string;
  titleBn?: string | null;
  contentEn?: string | null;
  contentBn?: string | null;
  imageUrl?: string | null;
}

/**
 * Server-side fetch of a dashboard-managed CMS page (bilingual title/content
 * + image), keyed by slug. Returns `null` when nothing has been saved for
 * that slug yet — callers should fall back to static content in that case.
 */
export async function getCmsPage(slug: string): Promise<CmsPage | null> {
  try {
    const res = await fetch(`${API_BASE}/pages/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as CmsPage;
  } catch {
    return null;
  }
}
