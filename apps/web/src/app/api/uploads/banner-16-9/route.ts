import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

/**
 * Forwards a cropped 16:9 banner (multipart/form-data, field "file") to the
 * NestJS BANNER_16_9 preset endpoint. NestJS re-verifies the binary (magic
 * bytes, 16:9 ratio ±15%, EXIF strip, WebP encode at 1920×1080) and returns
 * `{ key, url }` with the driver-independent storage key.
 */
export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  const formData = await req.formData();
  const res = await fetch(`${API_BASE}/uploads/banner-16-9`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
