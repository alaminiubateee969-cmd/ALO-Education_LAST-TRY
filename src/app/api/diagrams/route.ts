import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  DIAGRAM_PRESETS,
  DIAGRAM_SKINS,
  DIAGRAM_TYPES_45,
  parseMermaidToEditorialPreset,
  renderEditorialDiagramSvg,
  renderSelfContainedDiagramHtml,
  verifyDiagramDoctor,
  type DiagramSkinId,
} from "@/lib/diagram-design";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const presetId = searchParams.get("preset") ?? DIAGRAM_PRESETS[0].id;
  const skinId = (searchParams.get("skin") ?? "editorial-light") as DiagramSkinId;
  const dotted = searchParams.get("dotted") === "1";

  const preset = DIAGRAM_PRESETS.find((p) => p.id === presetId) ?? DIAGRAM_PRESETS[0];
  const validSkin: DiagramSkinId = skinId in DIAGRAM_SKINS ? skinId : "editorial-light";
  const svg = renderEditorialDiagramSvg(preset, validSkin, dotted);
  const doctor = verifyDiagramDoctor(validSkin, preset);

  return NextResponse.json({
    preset,
    skin: DIAGRAM_SKINS[validSkin],
    svg,
    doctor,
    presets: DIAGRAM_PRESETS,
    skins: Object.values(DIAGRAM_SKINS),
    diagramTypesCount: DIAGRAM_TYPES_45.length,
    diagramTypes: DIAGRAM_TYPES_45,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    presetId?: string;
    skinId?: DiagramSkinId;
    dottedPaper?: boolean;
    mermaidSource?: string;
    title?: string;
    format?: "json" | "png";
  };

  const skinId: DiagramSkinId = body.skinId && body.skinId in DIAGRAM_SKINS ? body.skinId : "editorial-light";
  const dotted = Boolean(body.dottedPaper);

  const preset =
    body.action === "import_mermaid" && typeof body.mermaidSource === "string" && body.mermaidSource.trim()
      ? parseMermaidToEditorialPreset(body.mermaidSource, body.title || "Redrawn Editorial Diagram")
      : DIAGRAM_PRESETS.find((p) => p.id === body.presetId) ?? DIAGRAM_PRESETS[0];

  const svg = renderEditorialDiagramSvg(preset, skinId, dotted);
  const html = renderSelfContainedDiagramHtml(preset, skinId, dotted);
  const doctor = verifyDiagramDoctor(skinId, preset);

  if (body.format === "png") {
    const pngBuffer = await sharp(Buffer.from(svg, "utf8")).png().toBuffer();
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${preset.id}-${skinId}.png"`,
      },
    });
  }

  return NextResponse.json({
    preset,
    skin: DIAGRAM_SKINS[skinId],
    svg,
    html,
    doctor,
  });
}
