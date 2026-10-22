import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

/**
 * Forwards a cropped ultra-wide header banner (multipart/form-data, field
 * "file") to the NestJS BANNER_19_6 preset endpoint. NestJS re-verifies the
 * binary (magic bytes, 19:6 ratio ±15%, EXIF strip, WebP encode at
 * 1900×600) and returns `{ key, url }` with the storage key.
 */
export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  const formData = await req.formData();
  const res = await fetch(`${API_BASE}/uploads/banner-19-6`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
