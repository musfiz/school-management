import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Body: { username: string, password: string }
 *
 * On success: 200 + sets the session cookie + returns { session }.
 * On failure: 401 + { error }.
 *
 * The client uses the cookie on the next request; the server components
 * read it via getSession() in lib/auth.ts.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { username, password } = (body ?? {}) as {
    username?: unknown;
    password?: unknown;
  };

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const session = await signIn(username, password);
  if (!session) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  return NextResponse.json({ session });
}
