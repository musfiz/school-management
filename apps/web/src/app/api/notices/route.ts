import { NextResponse } from "next/server";
import { notices } from "@/lib/content/collections";

export async function GET() {
  const sorted = [...notices].sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({ notices: sorted });
}
