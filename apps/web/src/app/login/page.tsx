import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { getSession, safeReturnTo } from "@/lib/auth";
import { site } from "@/lib/site";


/**
 * Staff sign-in page.
 *
 * Lives OUTSIDE the (public) route group on purpose: this page does not
 * inherit the public Header/Footer. It is a focused, chrome-less console
 * sign-in — appropriate for the dashboard portal. The student/parent
 * sign-in at /site/login keeps the public site chrome.
 */
export const metadata = {
  title: `Sign in — ${site.name}`,
  // Discourage search engines from indexing the sign-in.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ returnTo?: string | string[] }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { returnTo } = await searchParams;
  const raw = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const safeTo = safeReturnTo(raw);

  // If already signed in, send the user straight to their destination.
  const existing = await getSession();
  if (existing) {
    redirect(safeTo);
  }

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-navy-50 via-white to-gold-100 px-4 py-12 sm:py-16">
      {/* Decorative background — soft dot grid + amber glow. The two
          blobs are aria-hidden so screen readers skip them. */}
      <div
        aria-hidden
        className="bg-grid absolute inset-0 opacity-40"
      />
      <div
        aria-hidden
        className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
      />

      <div className="relative z-10 flex w-full items-center justify-center">
        <LoginForm variant="staff" returnTo={safeTo} />
      </div>
    </main>
  );
}
