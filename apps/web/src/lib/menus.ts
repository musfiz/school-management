import { mainNav, type NavItem } from "@/lib/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

interface PublicMenuNode {
  id: number;
  labelEn: string;
  labelBn: string | null;
  href: string;
  children: PublicMenuNode[];
}

function toNavItems(nodes: PublicMenuNode[]): NavItem[] {
  return nodes.map((n) => ({
    label: n.labelEn,
    labelBn: n.labelBn ?? undefined,
    href: n.href,
    section: "",
    children: n.children.length ? toNavItems(n.children) : undefined,
  }));
}

/**
 * Server-side fetch of the public header menu, talking to the NestJS API
 * directly (no auth needed, so it bypasses the `/api/menus/*` proxy which
 * requires a session). Falls back to the static `mainNav` when the CMS
 * has nothing saved yet, or when the API is unreachable.
 */
export async function getHeaderNav(): Promise<NavItem[]> {
  try {
    const res = await fetch(`${API_BASE}/menus/header`, { next: { revalidate: 60 } });
    if (!res.ok) return mainNav;
    const data = (await res.json()) as PublicMenuNode[];
    if (!Array.isArray(data) || data.length === 0) return mainNav;
    return toNavItems(data);
  } catch {
    return mainNav;
  }
}
