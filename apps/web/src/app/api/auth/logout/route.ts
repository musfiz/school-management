import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

/**
 * POST /api/auth/logout
 * Clears the session cookie and returns success.
 * The client then navigates to /login.
 */
export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
