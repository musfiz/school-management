import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import type { Role } from "./dashboard-nav";
import { SESSION_COOKIE } from "./session-cookie";

export { SESSION_COOKIE };

/** Legacy mock-gate roles the dashboard chrome is keyed on. */
const LEGACY_ROLE_KEYS: Role[] = [
  "admin",
  "management",
  "accountant",
  "teacher",
  "student",
  "guardian",
];

/**
 * The JWT `role` claim carries the backend `UsersRole` value (`superadmin`,
 * `exam_controller`, …) while the dashboard chrome (overview stats, sidebar
 * labels, command palette) is keyed on the legacy mock-session roles. Map
 * backend roles onto the closest legacy key once, at the session boundary,
 * so no consumer has to handle both vocabularies. Unrecognized values fall
 * back to `admin` (the widest legacy view) instead of crashing a role-keyed
 * Record lookup.
 */
function toLegacyRole(raw: string): Role {
  if ((LEGACY_ROLE_KEYS as string[]).includes(raw)) return raw as Role;
  if (raw === "superadmin") return "admin";
  if (raw === "exam_controller") return "management";
  return "guardian";
}

/**
 * Server-side JWT session helpers.
 *
 * The session cookie stores the raw JWT access token (httpOnly, sameSite=lax).
 * `getSession()` verifies the HS256 signature against `process.env.JWT_SECRET`
 * (which must match `apps/api/.env JWT_SECRET`) before trusting any claims.
 *
 * When the token is absent, tampered, expired, or signed with a different
 * secret, the user is treated as unauthenticated and the protected layout
 * will redirect to /login. NestJS still validates every API request
 * independently on the server side, so the UI gate is defense-in-depth —
 * not the source of truth.
 *
 * NOTE: This file uses Node's `crypto` and must NOT be imported from
 * `middleware.ts` (which runs on the Edge Runtime). Import `SESSION_COOKIE`
 * from `./session-cookie` instead.
 */

const ONE_WEEK = 60 * 60 * 24 * 7;

export interface Session {
  id: string;
  name: string;
  email: string;
  /** Legacy mock-gate role (normalized from the JWT claim — see toLegacyRole). */
  role: Role;
  isSuperAdmin: boolean;
}

/** Decode a base64url string (no external deps). */
function base64urlDecode(str: string): string {
  // Replace URL-safe chars and add padding
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

interface JwtClaims {
  sub: string;
  email: string;
  role: string;
  name?: string;
  isSuperAdmin?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Verify an HS256 JWT and return its claims, or null on any failure.
 * Rejects tokens signed with a different algorithm (e.g. "none") before
 * touching the signature comparison.
 */
function verifyJwt(token: string, secret: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  // Pin the algorithm. NestJS signs with HS256 (the @nestjs/jwt default
  // for symmetric secrets), so anything else is hostile or misconfigured.
  let headerAlg: string | undefined;
  try {
    headerAlg = (JSON.parse(base64urlDecode(header)) as { alg?: string }).alg;
  } catch {
    return null;
  }
  if (headerAlg !== "HS256") return null;

  // Recompute the signature and compare in constant time.
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest();
  const givenB64 = signature.replace(/-/g, "+").replace(/_/g, "/");
  // Re-pad before decoding base64.
  const givenPadded = givenB64 + "=".repeat((4 - (givenB64.length % 4)) % 4);
  const given = Buffer.from(givenPadded, "base64");
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  // Signature is good — now sanity-check the claims.
  let parsed: JwtClaims;
  try {
    parsed = JSON.parse(base64urlDecode(payload)) as JwtClaims;
  } catch {
    return null;
  }
  if (typeof parsed.exp === "number" && Date.now() / 1000 >= parsed.exp) {
    return null;
  }
  if (!parsed.sub || !parsed.email || !parsed.role) return null;
  return parsed;
}

/**
 * Read the session cookie, verify the JWT, and return the user.
 * Returns null if the cookie is absent, the signature doesn't match,
 * the token is expired, the algorithm isn't HS256, or `JWT_SECRET` is
 * not configured. All failure modes are deliberately indistinguishable
 * to avoid leaking which one triggered the rejection.
 */
async function decodeToken(): Promise<Session | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null; // fail closed when misconfigured
  // `cookies()` is async in Next 15+/16 — must be awaited before .get().
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = verifyJwt(token, secret);
  if (!claims) return null;
  return {
    id: claims.sub,
    email: claims.email,
    role: toLegacyRole(claims.role),
    isSuperAdmin: claims.isSuperAdmin === true,
    name: claims.name ?? claims.email.split("@")[0] ?? "User",
  };
}

export async function getSession(): Promise<Session | null> {
  return decodeToken();
}

/** Store the raw JWT in an httpOnly cookie. */
export async function setSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: ONE_WEEK,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Remove the session cookie. */
export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

/** True if the supplied path is safe to use as a `returnTo`. */
export function safeReturnTo(value: string | undefined | null): string {
  if (!value) return "/admin";
  if (!value.startsWith("/")) return "/admin";
  if (value.startsWith("//")) return "/admin";
  return value;
}
