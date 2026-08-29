"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  KeyRound,
  LogIn,
  UserRound,
} from "lucide-react";
import { MOCK_USERS } from "@/lib/mock-users";
import { roleLabels } from "@/lib/dashboard-nav";
import { loginVariants, type LoginVariant } from "@/lib/login-variant";
import { site } from "@/lib/site";

/**
 * Shared login form for both /login (staff) and /site/login (public).
 *
 * Soft split: any of the 5 seeded roles can sign in via either portal;
 * the variant only changes the visible branding/copy and the cross-link
 * to the other portal. The /api/auth/login endpoint and the mhs_user
 * cookie are shared, so a sign-in on one portal is valid on the other.
 */
export default function LoginForm({
  variant,
  returnTo,
}: {
  variant: LoginVariant;
  returnTo: string;
}) {
  const cfg = loginVariants[variant];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Invalid username or password.");
          return;
        }
        // Cookie is set by the server; navigate and refresh server state.
        router.replace(returnTo);
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-sm border border-ink-200 bg-white p-8 shadow-card">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-navy-800 text-white">
          <LogIn className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-extrabold text-navy-900">
            {cfg.title}
          </h1>
          <p className="text-sm text-ink-500">{cfg.subtitle}</p>
        </div>
      </div>

      <p className="mt-5 text-sm text-ink-600">{cfg.blurb}</p>

      {/* Form */}
      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        <label className="block">
          <span className="text-sm font-semibold text-ink-700">Username</span>
          <span className="mt-1 flex items-center gap-2 rounded-sm border border-ink-200 bg-white px-3 py-2.5 transition-colors focus-within:border-navy-400">
            <UserRound className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              type="text"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              placeholder="e.g. admin"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
            />
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-ink-700">Password</span>
          <span className="mt-1 flex items-center gap-2 rounded-sm border border-ink-200 bg-white px-3 py-2.5 transition-colors focus-within:border-navy-400">
            <KeyRound className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
            />
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
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

      {/* Demo accounts (mock only) */}
      <details className="mt-6 rounded-sm border border-ink-200 bg-ink-50 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-navy-800">
          Demo accounts
        </summary>
        <p className="mt-2 text-xs text-ink-500">
          {cfg.demoIntro}{" "}
          <span className="font-semibold text-ink-600">For demo only</span> — never
          commit real credentials.
        </p>
        <table className="mt-3 w-full text-xs">
          <thead className="text-ink-500">
            <tr>
              <th className="text-left font-semibold">Role</th>
              <th className="text-left font-semibold">Username</th>
              <th className="text-left font-semibold">Password</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_USERS.map((u) => (
              <tr
                key={u.username}
                className="cursor-pointer border-t border-ink-200 transition-colors hover:bg-white"
                onClick={() => {
                  setUsername(u.username);
                  setPassword(u.password);
                }}
              >
                <td className="py-1.5 pr-2 text-ink-700">{roleLabels[u.role]}</td>
                <td className="py-1.5 pr-2 font-mono text-navy-800">{u.username}</td>
                <td className="py-1.5 font-mono text-navy-800">{u.password}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {/* Cross-link to the other portal */}
      <p className="mt-5 text-center text-sm text-ink-600">
        <Link
          href={cfg.otherPath}
          className="font-semibold text-navy-700 transition-colors hover:text-navy-900"
        >
          {cfg.otherLabel}
        </Link>
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
