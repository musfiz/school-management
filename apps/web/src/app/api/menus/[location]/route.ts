import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

/** Forwards requests to the NestJS `/menus/:location` endpoints with the
 * session's JWT attached, so the browser never needs to know about port 3031. */
async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(_req: Request, { params }: { params: Promise<{ location: string }> }) {
  const { location } = await params;
  const res = await fetch(`${API_BASE}/menus/${location}/all`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(req: Request, { params }: { params: Promise<{ location: string }> }) {
  const { location } = await params;
  const body = await req.text();
  const res = await fetch(`${API_BASE}/menus/${location}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body,
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
