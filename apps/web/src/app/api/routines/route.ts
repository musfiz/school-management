import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isManager = url.searchParams.get("all") === "true";

  // Clone searchParams so we can forward them
  const forwardParams = new URLSearchParams(url.searchParams);
  forwardParams.delete("all");

  const endpoint = isManager
    ? `${API_BASE}/routines/all?${forwardParams.toString()}`
    : `${API_BASE}/routines?${forwardParams.toString()}`;

  const res = await fetch(endpoint, {
    headers: isManager ? await authHeaders() : {},
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request) {
  const body = await req.text();
  const res = await fetch(`${API_BASE}/routines`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body,
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
