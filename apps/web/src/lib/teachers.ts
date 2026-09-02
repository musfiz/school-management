const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

export interface Teacher {
  id: number;
  name: string;
  nameBn: string | null;
  designation: string;
  designationBn: string | null;
  department: string | null;
  departmentBn: string | null;
  imageUrl: string | null;
  jointDate: string | null;
  sortOrder: number;
}

/** Server-side fetch of the public teachers roster, talking to the NestJS API
 *  directly (no auth needed, mirrors `getStaffMembers`). */
export async function getTeachers(): Promise<Teacher[]> {
  try {
    const res = await fetch(`${API_BASE}/teachers`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as Teacher[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
