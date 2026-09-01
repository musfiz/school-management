const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

export interface Slider {
  id: number;
  imageUrl: string;
  titleEn: string | null;
  titleBn: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Server-side fetch of the active home-page slides, talking to the NestJS
 *  API directly (no auth needed, mirrors `getGoverningBody`). Returns an
 *  empty array when nothing is active or the API is unreachable, so callers
 *  fall back to their static hero images. */
export async function getSliders(): Promise<Slider[]> {
  try {
    const res = await fetch(`${API_BASE}/sliders`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as Slider[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
