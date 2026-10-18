import { NextResponse } from "next/server";
import { humanizeText } from "@/lib/humanizer";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }
  if (text.length > 12_000) {
    return NextResponse.json({ error: "Text must be 12,000 characters or fewer." }, { status: 400 });
  }
  const result = humanizeText(text);
  return NextResponse.json(result);
}
