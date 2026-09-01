const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

export interface ExPrincipal {
  id: number;
  name: string;
  nameBn: string | null;
  tenure: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

/** Server-side fetch of the public ex-principals roster, talking to the
 *  NestJS API directly (no auth needed, mirrors `getGoverningBody`). */
export async function getExPrincipals(): Promise<ExPrincipal[]> {
  try {
    const res = await fetch(`${API_BASE}/ex-principals`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as ExPrincipal[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
