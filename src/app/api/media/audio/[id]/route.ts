import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const AUDIO_DIR = path.join(process.cwd(), "storage", "audio");

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!/^(?:song|voice)_[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "audio_not_found" }, { status: 404 });
  }
  try {
    const audio = await readFile(path.join(AUDIO_DIR, `${id}.wav`));
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audio.byteLength),
        "Content-Disposition": `inline; filename="${id}.wav"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "audio_not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
