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
    <main className="flex min-h-screen flex-col bg-white px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
            {site.name}
          </p>
        </div>
        <LoginForm variant="staff" returnTo={safeTo} />
      </div>
    </main>
  );
}
