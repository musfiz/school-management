"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LogIn,
  Mail,
  KeyRound,
} from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { site } from "@/lib/site";

/**
 * Login form with Zod validation.
 * Submits { email, password } to /api/auth/login which forwards to NestJS.
 */
export default function LoginForm({
  variant,
  returnTo,
}: {
  variant: "staff" | "public";
  returnTo: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

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

  const isStaff = variant === "staff";

  return (
    <div className="rounded-sm border border-ink-200 bg-white p-8 shadow-card">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-navy-800 text-white">
          <LogIn className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-extrabold text-navy-900">
            {isStaff ? "Staff Portal" : "Student / Guardian Portal"}
          </h1>
          <p className="text-sm text-ink-500">
            {isStaff ? "Sign in to the dashboard" : "Sign in to your account"}
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm text-ink-600">
        {isStaff
          ? "Use your registered email and password to access the dashboard."
          : "Enter your credentials to access your student or guardian portal."}
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
        {/* Email */}
        <label className="block">
          <span className="text-sm font-semibold text-ink-700">Email address</span>
          <span
            className={`mt-1 flex items-center gap-2 rounded-sm border bg-white px-3 py-2.5 transition-colors focus-within:border-navy-400 ${
              errors.email ? "border-red-400" : "border-ink-200"
            }`}
          >
            <Mail className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              {...register("email")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
            />
          </span>
          {errors.email && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              {errors.email.message}
            </p>
          )}
        </label>

        {/* Password */}
        <label className="block">
          <span className="text-sm font-semibold text-ink-700">Password</span>
          <span
            className={`mt-1 flex items-center gap-2 rounded-sm border bg-white px-3 py-2.5 transition-colors focus-within:border-navy-400 ${
              errors.password ? "border-red-400" : "border-ink-200"
            }`}
          >
            <KeyRound className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="shrink-0 text-ink-400 hover:text-ink-600"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </span>
          {errors.password && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              {errors.password.message}
            </p>
          )}
        </label>

        {globalError && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {globalError}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Signing in…" : "Sign in"}
          {!isPending && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      {/* Cross-link to the other portal */}
      <p className="mt-5 text-center text-sm text-ink-600">
        {isStaff ? (
          <>
            Looking for the{" "}
            <Link
              href="/site/login"
              className="font-semibold text-navy-700 transition-colors hover:text-navy-900"
            >
              student / guardian portal
            </Link>
            ?
          </>
        ) : (
          <>
            Staff member?{" "}
            <Link
              href="/login"
              className="font-semibold text-navy-700 transition-colors hover:text-navy-900"
            >
              Sign in here
            </Link>
          </>
        )}
      </p>

      <p className="mt-3 text-center text-xs text-ink-500">
        <Link href="/" className="hover:text-navy-700">
          ← Back to site
        </Link>
        <span className="mx-2 text-ink-300">·</span>
        <span>{site.name}</span>
      </p>
    </div>
  );
}
