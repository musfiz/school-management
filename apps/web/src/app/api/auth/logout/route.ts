import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

/**
 * POST /api/auth/logout
 * Clears the session cookie. The client then navigates to /login.
 */
export async function POST() {
  await signOut();
  return NextResponse.json({ ok: true });
}
