import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Proxy for GET /api/menus/my-menus — hierarchical menu tree for the
 *  current user with action flags. */
export async function GET() {
  const res = await fetch(`${API_BASE}/menus/my-menus`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
