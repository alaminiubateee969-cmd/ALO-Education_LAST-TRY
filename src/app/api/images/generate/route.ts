import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { executeAsAgent, recordAgentPipelineStages } from "@/lib/agent-runtime";
import type { QualityAgentPass } from "@/lib/ai";
import { generateImageFile } from "@/lib/ai";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 240;

type ImageGenData = {
  url: string;
  provider: string;
  usedFallback: boolean;
  error?: string;
  qualityPipeline?: QualityAgentPass[];
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { prompt?: unknown; filename?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 2_000) {
    return NextResponse.json({ error: "prompt must contain 1–2,000 characters" }, { status: 400 });
  }
  const requestedName = typeof body.filename === "string" ? body.filename : "";
  const basename = requestedName.replace(/\.png$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  const filename = `${basename || `alo_${randomUUID()}`}.png`;
  const dir = path.join(process.cwd(), "public", "generated");
  await mkdir(dir, { recursive: true });
  const outPath = path.join(dir, filename);

  const agentResult = await executeAsAgent<ImageGenData>(
    {
      agentId: "image_generator",
      task: `Generate local illustration: ${prompt.slice(0, 60)}`,
      tools: ["comfyui.local"],
    },
    async () => {
      const result = await generateImageFile(prompt, outPath, "1024x1024");
      if (result.usedFallback) {
        const svgName = filename.replace(/\.png$/, ".svg");
        const svgPath = path.join(dir, svgName);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#fff7ed"/><stop offset="1" stop-color="#fde68a"/></linearGradient></defs><rect width="1024" height="1024" rx="72" fill="url(#bg)"/><circle cx="512" cy="405" r="170" fill="#fbbf24" opacity=".34"/><path d="M280 670c85-120 170-120 232 0s147 120 232 0" fill="none" stroke="#d97706" stroke-width="18" stroke-linecap="round"/><text x="512" y="790" font-size="56" text-anchor="middle" fill="#78350f" font-family="sans-serif">আলো লার্নিং জার্নি</text><text x="512" y="860" font-size="26" text-anchor="middle" fill="#92400e" font-family="sans-serif">LOCAL PLACEHOLDER — image model not configured</text></svg>`;
        await writeFile(svgPath, svg, "utf8");
        await unlink(outPath).catch(() => undefined);
        const data: ImageGenData = { url: `/generated/${svgName}`, provider: "image-fallback", usedFallback: true, error: result.error ?? "Local image model is unavailable", qualityPipeline: result.qualityPipeline };
        return { data, provider: "image-fallback" };
      }
      const data: ImageGenData = { url: `/generated/${filename}`, provider: result.provider, usedFallback: false, qualityPipeline: result.qualityPipeline };
      return { data, provider: result.provider };
    }
  );

  await recordAgentPipelineStages("image prompt refinement", agentResult.result.qualityPipeline ?? []);
  return NextResponse.json({
    ...agentResult.result,
    agentRunId: agentResult.runId,
    agentId: agentResult.agentId,
    agentStatus: agentResult.status,
    auditId: agentResult.auditId,
  });
}
