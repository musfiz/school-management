import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function forward(req: Request, method: string, path: string[]) {
  const url = new URL(req.url);
  const target = `${API_BASE}/accounting/${path.join("/")}${url.search}`;
  const init: RequestInit = {
    method,
    headers: await authHeaders(),
    cache: "no-store",
  };
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    init.headers = { "Content-Type": "application/json", ...init.headers };
    init.body = await req.text();
  }
  const res = await fetch(target, init);
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, { params }: Ctx) {
  const { path } = await params;
  return forward(req, "GET", path ?? []);
}

export async function POST(req: Request, { params }: Ctx) {
  const { path } = await params;
  return forward(req, "POST", path ?? []);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { path } = await params;
  return forward(req, "PATCH", path ?? []);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { path } = await params;
  return forward(req, "DELETE", path ?? []);
}
