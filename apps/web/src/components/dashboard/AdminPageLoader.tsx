"use client";

interface AdminPageLoaderProps {
  /** Short status text under the spinner. */
  label?: string;
  /**
   * `page` — centers the spinner in the content viewport for route changes
   * and full-view refreshes (renders inside `<main>`, sidebar/topbar stay
   * untouched). `inline` — shorter block for in-card / tab-content refreshes
   * so the surrounding layout doesn't jump.
   */
  variant?: "page" | "inline";
  className?: string;
}

/**
 * The single loading pattern for the whole app (route `loading.tsx`
 * suspense boundaries, full-view fetches, and in-card refreshes).
 * Brand palette, `rounded-full` rings, accessible `role="status"`.
 */
export default function AdminPageLoader({
  label = "Loading...",
  variant = "page",
  className = "",
}: AdminPageLoaderProps) {
  const height = variant === "page" ? "min-h-[60vh]" : "min-h-60";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`flex ${height} flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-ink-200 border-t-brand-600" />
        <div
          className="absolute inset-2 animate-spin rounded-full border-4 border-transparent border-t-navy-400"
          style={{ animationDirection: "reverse", animationDuration: "1.2s" }}
        />
      </div>
      <p className="text-xs font-medium text-ink-500">{label}</p>
    </div>
  );
}
