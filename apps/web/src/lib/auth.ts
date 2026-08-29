import { cookies } from "next/headers";
import { findUser, findUserByCredentials } from "./mock-users";
import type { Role } from "./dashboard-nav";

/**
 * Server-side auth helpers for the mock dashboard gate.
 *
 * The session cookie stores the *username* only — the role is looked up from
 * the seeded user list on every read. That keeps a single source of truth and
 * makes role changes take effect immediately (no stale role in the cookie).
 *
 * When the real backend lands, swap `getSession()` for a JWT/session lookup
 * and `signIn()`/`signOut()` for calls into the auth service. The rest of the
 * dashboard code only depends on `getSession()` so the swap is local.
 *
 * Trade-off: the cookie is intentionally not `httpOnly` so client components
 * can read the username for display ("Signed in as …"). When real auth lands,
 * move to an `httpOnly` cookie and remove the client-side reads.
 */

export const SESSION_COOKIE = "mhs_user";
const ONE_WEEK = 60 * 60 * 24 * 7;

export interface Session {
  username: string;
  name: string;
  email: string;
  role: Role;
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const value = c.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const user = findUser(value);
  if (!user) return null;
  return { username: user.username, name: user.name, email: user.email, role: user.role };
}

export async function signIn(
  username: string,
  password: string,
): Promise<Session | null> {
  const user = findUserByCredentials(username, password);
  if (!user) return null;
  const c = await cookies();
  c.set(SESSION_COOKIE, user.username, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: ONE_WEEK,
  });
  return { username: user.username, name: user.name, email: user.email, role: user.role };
}

export async function signOut(): Promise<void> {
  const c = await cookies();
  c.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

/** True if the supplied path is safe to use as a `returnTo` (same-origin, absolute). */
export function safeReturnTo(value: string | undefined | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard"; // protocol-relative URLs are unsafe
  return value;
}
