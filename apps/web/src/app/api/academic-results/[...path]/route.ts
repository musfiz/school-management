import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Same-origin proxy for the Academic Results (Result Engine) API. Preserves the
 * caller's content-type and raw body so both JSON calls and the multipart
 * marks-import upload (`/academic-results/marks-entry/import`) pass through.
 */
async function forward(req: Request, method: string, path: string[]) {
  const url = new URL(req.url);
  const target = `${API_BASE}/academic-results/${path.join("/")}${url.search}`;

  const headers: Record<string, string> = { ...(await authHeaders()) };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const init: RequestInit = { method, headers, cache: "no-store" };
  if (method !== "GET" && method !== "HEAD") {
    const buffer = await req.arrayBuffer();
    if (buffer.byteLength) init.body = buffer;
  }

  try {
    let res: Response;
    try {
      res = await fetch(target, init);
    } catch (fetchErr) {
      if (target.includes("localhost")) {
        const ipv4Target = target.replace("localhost", "127.0.0.1");
        res = await fetch(ipv4Target, init);
      } else {
        throw fetchErr;
      }
    }
    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[academic-results proxy] fetch error for ${target}:`, detail);
    return NextResponse.json(
      { message: "Backend API is unavailable or starting up", detail },
      { status: 503 },
    );
  }
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

export async function PUT(req: Request, { params }: Ctx) {
  const { path } = await params;
  return forward(req, "PUT", path ?? []);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { path } = await params;
  return forward(req, "DELETE", path ?? []);
}
