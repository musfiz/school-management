import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Ctx = { params: Promise<{ userId: string }> };

export async function POST(
  req: Request,
  { params }: Ctx,
) {
  const { userId } = await params;
  const body = await req.text();
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    cache: "no-store",
    body,
  };
  const res = await fetch(`${API_BASE}/permissions/user/${userId}/reset`, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return NextResponse.json(data, { status: res.status });
}
