import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function forward(
  req: Request | null,
  userId: string,
  method: string,
  body?: unknown,
) {
  const init: RequestInit = {
    method,
    headers: { ...(await authHeaders()) },
    cache: "no-store",
  };
  if (body !== undefined && (method === "POST" || method === "PUT" || method === "PATCH")) {
    init.headers = { "Content-Type": "application/json", ...init.headers };
    init.body = JSON.stringify(body);
  } else if (req && (method === "POST" || method === "PUT" || method === "PATCH")) {
    init.headers = { "Content-Type": "application/json", ...init.headers };
    init.body = await req.text();
  }
  const res = await fetch(`${API_BASE}/permissions/user/${userId}`, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return NextResponse.json(data, { status: res.status });
}

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { userId } = await params;
  return forward(null, userId, "GET");
}

export async function PUT(req: Request, { params }: Ctx) {
  const { userId } = await params;
  return forward(req, userId, "PUT");
}
