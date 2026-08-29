import { NextResponse } from "next/server";
import { findResult } from "@/lib/content/collections";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cls = searchParams.get("class");
  const roll = searchParams.get("roll");

  if (!cls || !roll) {
    return NextResponse.json(
      { error: "Class and roll number are required." },
      { status: 400 },
    );
  }

  const rollNum = Number(roll);
  if (!Number.isFinite(rollNum)) {
    return NextResponse.json({ error: "Invalid roll number." }, { status: 400 });
  }

  const result = findResult(cls, rollNum);
  if (!result) {
    return NextResponse.json(
      { error: "No result found for the given class and roll." },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}
