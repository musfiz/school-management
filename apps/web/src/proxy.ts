import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// IMPORTANT: import only from session-cookie (Edge-safe). Do NOT import
// from "@/lib/auth" — that file uses Node's `crypto` and would break
// the Edge Runtime bundler.
import { SESSION_COOKIE } from "@/lib/session-cookie";

/** Paths that never require authentication. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/site/login",
  "/api/auth/login",
  "/api/auth/logout",
];

/** Add the JWT as a Bearer token in Authorization header when proxying to NestJS. */
function addBearerHeader(req: NextRequest): void {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    req.headers.set("Authorization", `Bearer ${token}`);
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Public paths — allow through immediately.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // 2. Protect all /admin routes.
  if (pathname.startsWith("/admin")) {
    const hasSession = req.cookies.has(SESSION_COOKIE);
    if (!hasSession) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Authenticated — inject Bearer header for any fetch calls made server-side.
    addBearerHeader(req);
    return NextResponse.next();
  }

  // 3. All other paths pass through.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\..*).*)"],
};
