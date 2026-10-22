import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

/**
 * Forwards a managed-key file deletion (`?key=schools/.../uuid.webp`) to the
 * NestJS storage driver. NestJS rejects anything outside the managed
 * `schools/` namespace, so legacy URLs can never be deleted through here.
 * Used by GlobalImageUploader when the user removes a freshly-uploaded
 * (not yet persisted) image.
 */
export async function DELETE(req: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const key = new URL(req.url).searchParams.get("key") ?? "";

  const res = await fetch(
    `${API_BASE}/uploads?key=${encodeURIComponent(key)}`,
    {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
