import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

/**
 * Forwards a cropped/optimize-ready image (multipart/form-data, field "file")
 * to the NestJS AVATAR preset endpoint. The NestJS pipeline re-validates the
 * binary (magic bytes, 1:1 ratio ±15%, EXIF strip, WebP encode) and returns
 * `{ key, url }` where `key` is the driver-independent storage key.
 */
export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  const formData = await req.formData();
  const res = await fetch(`${API_BASE}/uploads/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
