import { NextResponse } from "next/server";
import { z } from "zod";
import { loginSchema } from "@/lib/validations";
import { setSessionCookie } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3032";

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 *
 * Validates with Zod, calls NestJS /auth/login, and sets the session cookie.
 * On success: 200 + { user, access_token }.
 * On failure: 401 + { error }.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { error: Object.values(errors).flat()[0] ?? "Validation failed" },
      { status: 422 },
    );
  }

  const { email, password } = parsed.data;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return NextResponse.json(
      { error: "Cannot reach the auth server. Please try again later." },
      { status: 503 },
    );
  }

  if (!res.ok) {
    let error = "Invalid email or password";
    try {
      const data = await res.json() as { message?: string | string[] };
      const msg = data?.message;
      error = Array.isArray(msg) ? msg[0] : (typeof msg === "string" ? msg : error);
    } catch { /* ignore */ }
    return NextResponse.json({ error }, { status: 401 });
  }

  const data = await res.json() as {
    access_token: string;
    user: { id: number; name: string; email: string; role: string };
  };

  await setSessionCookie(data.access_token);

  return NextResponse.json({ user: data.user });
}
