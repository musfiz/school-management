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
  const target = `${API_BASE}/admissions/${path.join("/")}${url.search}`;
  const init: RequestInit = {
    method,
    headers: await authHeaders(),
    cache: "no-store",
  };
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    init.headers = { "Content-Type": "application/json", ...init.headers };
    init.body = await req.text();
  }

  // The NestJS API restarts on file saves (ts-node --watch) and may be
  // briefly unreachable. A thrown fetch would otherwise surface to the
  // browser as a generic 500; report it honestly as a 503 instead.
  let res: Response;
  try {
    res = await fetch(target, init);
  } catch {
    return NextResponse.json(
      { error: "Cannot reach the API server. Please try again." },
      { status: 503 },
    );
  }

  // Preserve non-JSON/empty bodies (e.g. a proxy/gateway error page) instead
  // of assuming JSON, and skip NextResponse.json for bodyless statuses.
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (res.status === 204 || res.status === 304) {
    return new NextResponse(null, { status: res.status });
  }
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
