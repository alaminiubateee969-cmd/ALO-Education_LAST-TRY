import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { executeAsAgent } from "@/lib/agent-runtime";
import { synthesizeLocalSpeech } from "@/lib/local-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_DIR = path.join(process.cwd(), "storage", "audio");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 5_000) {
    return NextResponse.json({ error: "text must contain 1–5,000 characters" }, { status: 400 });
  }
  const requestedVoice = typeof body.voice === "string" ? body.voice : "bn";
  const id = `voice_${randomUUID()}`;
  const outputPath = path.join(AUDIO_DIR, `${id}.wav`);

  const agent = await executeAsAgent<{
    id: string;
    audioUrl: string;
    engine: string;
    durationSeconds: number;
    format: "wav";
  }>(
    {
      agentId: "voice",
      task: `Synthesize local narration (${text.length} characters)`,
      input: { characterCount: text.length, voice: requestedVoice.slice(0, 24) },
      tools: ["piper.local", "espeak.local"],
      requiresApproval: false,
    },
    async () => {
      const speech = await synthesizeLocalSpeech(text, outputPath, requestedVoice);
      return {
        data: { id, audioUrl: `/api/media/audio/${id}`, engine: speech.engine, durationSeconds: speech.durationSeconds, format: "wav" },
        provider: speech.engine,
      };
    }
  );

  if (agent.status !== "success") {
    return NextResponse.json({ error: agent.error || "Local speech synthesis failed", agentRunId: agent.runId }, { status: 503 });
  }
  return NextResponse.json({ ...agent.result, agentRunId: agent.runId, auditId: agent.auditId }, { headers: { "Cache-Control": "no-store" } });
}
