const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

export interface StaffMember {
  id: number;
  name: string;
  nameBn: string | null;
  designation: string;
  designationBn: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

/** Server-side fetch of the public staff roster, talking to the NestJS API
 *  directly (no auth needed, mirrors `getGoverningBody`). */
export async function getStaffMembers(): Promise<StaffMember[]> {
  try {
    const res = await fetch(`${API_BASE}/staff`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as StaffMember[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
