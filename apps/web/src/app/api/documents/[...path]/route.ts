import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

/**
 * Binary-safe proxy for server-generated PDFs (`GET /documents/...`,
 * `POST /documents/report/pdf`). Unlike the JSON accounting proxy, this
 * forwards raw bytes and preserves Content-Type / Content-Disposition so
 * downloads and iframe printing work on every OS.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function forward(req: Request, method: string, path: string[]) {
  const url = new URL(req.url);
  const target = `${API_BASE}/documents/${path.join("/")}${url.search}`;
  const init: RequestInit = { method, headers: await authHeaders(), cache: "no-store" };
  if (method === "POST") {
    init.headers = { "Content-Type": "application/json", ...init.headers };
    init.body = await req.text();
  }
  const res = await fetch(target, init);
  const buf = await res.arrayBuffer();
  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  const disposition = res.headers.get("content-disposition");
  if (contentType) headers.set("Content-Type", contentType);
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(buf, { status: res.status, headers });
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
