"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  Loader2,
} from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations";

/**
 * Login form with Zod validation.
 * Submits { email, password } to /api/auth/login which forwards to NestJS.
 *
 * Visuals: centered card on a soft navy→brand→gold gradient with a
 * subtle dot grid for texture. Accessibility: each field has a stable
 * `id`, error text is linked via `aria-describedby`, and invalid fields
 * expose `aria-invalid` for screen readers.
 */
export default function LoginForm({
  variant,
  returnTo,
}: {
  variant: "staff" | "public";
  returnTo: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  // `useId` gives us a stable id per render for accessible labelling.
  const emailId = useId();
  const passwordId = useId();
  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  // Wrappers around `register()` that also clear the global server-error
  // banner the moment the user starts editing the field. Keeps the form
  // honest — a stale "Invalid credentials" must not linger after the user
  // has already started typing a fix.
  const emailReg = register("email");
  const passwordReg = register("password");
  const clearErrorOnEdit = () => {
    if (globalError) setGlobalError(null);
  };
  const emailOnChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    clearErrorOnEdit();
    void emailReg.onChange(e);
  };
  const passwordOnChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    clearErrorOnEdit();
    void passwordReg.onChange(e);
  };

  function onSubmit(data: LoginInput) {
    setGlobalError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          setGlobalError(payload.error ?? "Invalid email or password.");
          return;
        }
        window.location.href = returnTo;
      } catch {
        setGlobalError("Network error. Please try again.");
      }
    });
  }

  // Decorative Google SSO button — wiring is intentionally a no-op for
  // now. Replace `onGoogleClick` with a real OAuth redirect when the
  // backend supports it.
  function onGoogleClick() {
    setGlobalError("Google sign-in is not enabled yet. Please use your email and password.");
  }

  const isStaff = variant === "staff";

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg border border-ink-200/80 bg-white p-7 shadow-card sm:p-9">
        {/* Heading */}
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-navy-900 sm:text-[1.65rem]">
            Welcome to School Portal
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">Enter your email and password to sign in.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
          {/* Server / network error — rendered at the top so it's the first
              thing the eye lands on after a failed submit. */}
          {globalError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{globalError}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor={emailId} className="block text-sm font-semibold text-ink-700">
              Email address
            </label>
            <div
              className={`mt-1.5 flex items-center gap-2 rounded-md border bg-white px-3 py-2.5 transition-colors focus-within:border-navy-400 focus-within:ring-2 focus-within:ring-navy-100 ${
                errors.email
                  ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
                  : "border-ink-200"
              }`}
            >
              <Mail className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                inputMode="email"
                autoFocus
                spellCheck={false}
                placeholder="you@example.com"
                aria-invalid={errors.email ? "true" : "false"}
                aria-describedby={errors.email ? emailErrorId : undefined}
                {...emailReg}
                onChange={emailOnChange}
                onBlur={emailReg.onBlur}
                ref={emailReg.ref}
                name={emailReg.name}
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
              />
            </div>
            {errors.email && (
              <p
                id={emailErrorId}
                role="alert"
                className="mt-1.5 flex items-center gap-1 text-xs text-red-600"
              >
                <AlertCircle className="h-3 w-3" aria-hidden />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor={passwordId} className="block text-sm font-semibold text-ink-700">
              Password
            </label>
            <div
              className={`mt-1.5 flex items-center gap-2 rounded-md border bg-white px-3 py-2.5 transition-colors focus-within:border-navy-400 focus-within:ring-2 focus-within:ring-navy-100 ${
                errors.password
                  ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
                  : "border-ink-200"
              }`}
            >
              <KeyRound className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? "true" : "false"}
                aria-describedby={errors.password ? passwordErrorId : undefined}
                {...passwordReg}
                onChange={passwordOnChange}
                onBlur={passwordReg.onBlur}
                ref={passwordReg.ref}
                name={passwordReg.name}
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 rounded p-0.5 text-ink-400 transition-colors hover:text-ink-700"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            {errors.password && (
              <p
                id={passwordErrorId}
                role="alert"
                className="mt-1.5 flex items-center gap-1 text-xs text-red-600"
              >
                <AlertCircle className="h-3 w-3" aria-hidden />
                {errors.password.message}
              </p>
            )}

            <div className="mt-2 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-navy-700 transition-colors hover:text-navy-900"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {/* Global error (server / network) — moved to the top of the form */}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-navy-900 focus-visible:ring-2 focus-visible:ring-navy-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3" aria-hidden>
          <div className="h-px flex-1 bg-ink-200" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            or
          </span>
          <div className="h-px flex-1 bg-ink-200" />
        </div>

        {/* Decorative Google button — wire to OAuth when ready. */}
        <button
          type="button"
          onClick={onGoogleClick}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-md border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 shadow-sm transition-colors hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-navy-300 focus-visible:ring-offset-2"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>

      {/* Cross-link to the other portal */}
      <p className="mt-6 text-center text-sm text-ink-600">
        {isStaff ? (
          <>
            Looking for the{" "}
            <Link
              href="/site/login"
              className="font-semibold text-navy-700 transition-colors hover:text-navy-900"
            >
              student / parent portal
            </Link>
            ?
          </>
        ) : (
          <>
            School staff?{" "}
            <Link
              href="/login"
              className="font-semibold text-navy-700 transition-colors hover:text-navy-900"
            >
              Sign in here
            </Link>
            .
          </>
        )}
      </p>

      <p className="mt-3 text-center text-xs text-ink-500">
        <Link href="/" className="hover:text-navy-700">
          ← Back to site
        </Link>
      </p>
    </div>
  );
}

/** Inline Google "G" mark so we don't pull in a full icon set. */
function GoogleIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.72.12-1.42.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.83Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
