import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { site } from "@/lib/site";
import { getSession, safeReturnTo } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: `Forgot password — ${site.name}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Forgot-password page (placeholder).
 *
 * The real reset flow (token generation, email send, password update)
 * is not wired up yet — this is the UI affordance so the link from
 * the login form lands somewhere sensible. When the backend endpoint
 * is ready, swap the static "coming soon" copy for a real email form
 * and a confirmation state.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo } = await searchParams;
  const raw = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const safeTo = safeReturnTo(raw);

  // If the user is already signed in, the reset flow is irrelevant —
  // bounce them back to wherever they came from.
  const existing = await getSession();
  if (existing) {
    redirect(safeTo);
  }

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-navy-50 via-white to-gold-100 px-4 py-12 sm:py-16">
      <div aria-hidden className="bg-grid absolute inset-0 opacity-40" />
      <div
        aria-hidden
        className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-white shadow-card"
          >
            <MailCheck className="h-5 w-5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-600">
            {site.name}
          </p>
        </div>

        <div className="rounded-2xl border border-ink-200/80 bg-white p-7 shadow-card sm:p-9">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-navy-900">
            Forgot your password?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            Enter the email address associated with your account and we'll
            send you a link to reset your password. The reset email is sent
            by your school administrator.
          </p>

          {/* Static placeholder — swap for a real <form action="/api/auth/forgot"> once the endpoint exists. */}
          <div
            role="status"
            className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          >
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              The reset flow is not enabled yet. Please contact your school
              administrator to reset your password.
            </span>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link
              href={`/login?returnTo=${encodeURIComponent(safeTo)}`}
              className="inline-flex items-center gap-1.5 font-semibold text-navy-700 transition-colors hover:text-navy-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
