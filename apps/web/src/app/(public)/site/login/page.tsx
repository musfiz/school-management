import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { getSession, safeReturnTo } from "@/lib/auth";
import { site } from "@/lib/site";

export const metadata = {
  title: `Student & parent sign in — ${site.name}`,
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ returnTo?: string | string[] }>;

export default async function SiteLoginPage({
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
    <div className="relative isolate overflow-hidden bg-gradient-to-br from-navy-50 via-white to-gold-100 px-4 py-12 sm:py-20">
      {/* Decorative background — soft dot grid + amber glow. */}
      <div aria-hidden className="bg-grid absolute inset-0 opacity-40" />
      <div
        aria-hidden
        className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
      />

      <div className="relative z-10 flex w-full items-center justify-center">
        <LoginForm variant="public" returnTo={safeTo} />
      </div>
    </div>
  );
}
