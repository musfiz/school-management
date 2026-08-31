const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

/**
 * Resolves a stored image path to a displayable URL. Only the relative path
 * (e.g. "/uploads/xyz.jpg") is ever persisted in the database — resolving
 * the host here means changing NEXT_PUBLIC_API_BASE_URL (moving domains)
 * doesn't strand previously-uploaded images.
 */
export function resolveImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path; // already absolute (external URL)
  if (path.startsWith("/uploads/")) return `${API_BASE}${path}`; // API-hosted upload
  return path; // Next.js /public asset (e.g. /logo.png)
}

/** True once resolved to an absolute URL — next/image needs `unoptimized`
 *  for those instead of failing on an unconfigured remote domain. */
export function isExternalImage(path: string | null | undefined): boolean {
  return /^https?:\/\//i.test(resolveImageUrl(path));
}
