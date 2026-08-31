const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

export interface GoverningBodyMember {
  id: number;
  name: string;
  nameBn: string | null;
  designation: string;
  designationBn: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

/** Server-side fetch of the public governing body roster, talking to the
 *  NestJS API directly (no auth needed, mirrors `getHeaderNav`). */
export async function getGoverningBody(): Promise<GoverningBodyMember[]> {
  try {
    const res = await fetch(`${API_BASE}/governing-body`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as GoverningBodyMember[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
