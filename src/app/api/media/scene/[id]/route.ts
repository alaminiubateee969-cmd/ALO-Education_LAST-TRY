import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
const ASSET_DIR = path.join(process.cwd(), "storage", "scene-assets");

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!/^cine_(?:[0-9a-f-]{36}|\d{10,16})_scene\d+\.png$/i.test(id)) {
    return NextResponse.json({ error: "scene_not_found" }, { status: 404 });
  }
  try {
    const image = await readFile(path.join(ASSET_DIR, id));
    return new NextResponse(new Uint8Array(image), {
      headers: { "Content-Type": "image/png", "Content-Length": String(image.byteLength), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ error: "scene_not_found" }, { status: 404 });
  }
}
