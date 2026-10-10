import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { executeAsAgent, recordAgentPipelineStages } from "@/lib/agent-runtime";
import { generateNarrationScript, type QualityAgentPass } from "@/lib/ai";
import { generateProceduralInstrumental, synthesizeLocalSpeech, type MusicMood } from "@/lib/local-audio";
import { ensureSeeded } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIDEO_DIR = path.join(process.cwd(), "storage", "videos");
const MOODS = new Set<MusicMood>(["calm", "hopeful", "playful", "reflective"]);

function runTool(binary: string, args: string[], timeoutMs = 300_000): string {
  try {
    return execFileSync(binary, args, {
      timeout: timeoutMs,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
    }).trim();
  } catch (error) {
    const issue = error as NodeJS.ErrnoException & { stderr?: Buffer | string };
    const details = issue.stderr ? String(issue.stderr) : issue.message || "unknown error";
    throw new Error(`${binary} failed: ${details.slice(0, 300)}`);
  }
}

function probeDuration(filePath: string): number {
  const value = runTool("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath], 20_000);
  const duration = Number.parseFloat(value);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("ffprobe could not read the generated audio duration");
  return duration;
}

function probeVideo(filePath: string) {
  const data = JSON.parse(runTool("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath], 20_000));
  const video = data.streams.find((stream: { codec_type: string }) => stream.codec_type === "video");
  const audio = data.streams.find((stream: { codec_type: string }) => stream.codec_type === "audio");
  if (!video) throw new Error("ffprobe found no video stream in the rendered file");
  return {
    duration: Number.parseFloat(data.format.duration),
    width: Number(video.width ?? 0),
    height: Number(video.height ?? 0),
    fps: String(video.r_frame_rate ?? "0/1"),
    videoCodec: String(video.codec_name ?? "unknown"),
    audioCodec: String(audio?.codec_name ?? "none"),
    audioSampleRate: Number(audio?.sample_rate ?? 0),
    audioChannels: Number(audio?.channels ?? 0),
    fileSize: Number(data.format.size ?? 0),
    mimeType: "video/mp4",
    formatName: String(data.format.format_name ?? "unknown"),
  };
}

function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function escapeConcatPath(filePath: string): string {
  return filePath.replace(/\\/g, "\\\\").replace(/'/g, "'\\''");
}

async function generateSpeechToDuration(
  scriptLines: string[],
  voice: string,
  targetDuration: number,
  audioPath: string,
  jobDir: string,
  jobId: string
): Promise<{ duration: number; segments: Array<{ text: string; start: number; end: number }>; voiceEngine: string }> {
  const padding = [
    "প্রতিটি শিশুর শেখার গতি আলাদা—তাই তুলনা নয়, পাশে থাকুন।",
    "প্রতিদিন অল্প সময় গল্প, খেলা আর কথোপকথনে দিন।",
    "শিশুর ছোট ছোট চেষ্টাকে স্বীকৃতি দিন এবং উৎসাহ দিন।",
    "কঠিন লাগলে ধৈর্য ধরুন; ভালোবাসা দিয়ে শেখার সুযোগ তৈরি হয়।",
    "আজকের একটি সহজ অভ্যাস বেছে নিয়ে একসাথে চেষ্টা করুন।",
    "আপনার অভিজ্ঞতা আলো লার্নিং জার্নির সাথে শেয়ার করুন।",
    "আলো লার্নিং জার্নি—ভালোবাসা দিয়ে শেখার পথ।",
  ];
  const segments: Array<{ text: string; start: number; end: number }> = [];
  const audioParts: string[] = [];
  let duration = 0;
  let index = 0;
  let paddingIndex = 0;
  let voiceEngine = "espeak-local";

  while (duration < targetDuration && index < 500) {
    const text = (index < scriptLines.length ? scriptLines[index] : padding[paddingIndex++ % padding.length]).trim();
    const partPath = path.join(jobDir, `speech-${index}.wav`);
    const synthesis = await synthesizeLocalSpeech(text, partPath, voice);
    voiceEngine = synthesis.engine;
    const partDuration = probeDuration(partPath);
    segments.push({ text, start: duration, end: duration + partDuration });
    audioParts.push(partPath);
    duration += partDuration;
    index++;
  }
  if (duration < targetDuration || audioParts.length === 0) throw new Error("Local voice could not reach the requested duration");

  const concatList = path.join(jobDir, `${jobId}-audio-concat.txt`);
  await fs.writeFile(concatList, audioParts.map((file) => `file '${escapeConcatPath(file)}'`).join("\n"), "utf8");
  runTool("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-c:a", "pcm_s16le", audioPath]);
  const finalDuration = probeDuration(audioPath);
  return { duration: finalDuration, segments, voiceEngine };
}

export async function POST(request: Request) {
  await ensureSeeded();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic || topic.length > 240) return NextResponse.json({ error: "topic must contain 1–240 characters" }, { status: 400 });

  const requestedDuration = Number(body.duration ?? 50);
  if (!Number.isInteger(requestedDuration) || requestedDuration < 10 || requestedDuration > 600) {
    return NextResponse.json({ error: "duration must be an integer from 10 to 600 seconds" }, { status: 400 });
  }
  const voice = typeof body.voice === "string" ? body.voice.slice(0, 24) : "bn";
  const suppliedScript = typeof body.script === "string" ? body.script.trim() : typeof body.text === "string" ? body.text.trim() : typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (suppliedScript.length > 8_000) return NextResponse.json({ error: "script must be 8,000 characters or fewer" }, { status: 400 });
  const mood = typeof body.mood === "string" && MOODS.has(body.mood as MusicMood) ? body.mood as MusicMood : "hopeful";
  const jobId = `video_${randomUUID()}`;
  const jobDir = path.join(VIDEO_DIR, jobId);
  const audioPath = path.join(jobDir, "narration.wav");
  const musicPath = path.join(jobDir, "instrumental.wav");
  const videoPath = path.join(VIDEO_DIR, `${jobId}.mp4`);

  const scriptResult = suppliedScript
    ? { data: { title: topic, lines: suppliedScript.split(/\n+/).map((line) => line.trim()).filter(Boolean) }, provider: "provided-by-user", usedFallback: false, qualityPipeline: [] as QualityAgentPass[] }
    : await generateNarrationScript(topic);
  if (!scriptResult.data.lines.length) return NextResponse.json({ error: "The script contains no narration lines" }, { status: 400 });
  const scriptQualityPipeline = scriptResult.qualityPipeline ?? [];
  await recordAgentPipelineStages("motion graphics narration script", scriptQualityPipeline);

  const agent = await executeAsAgent<Record<string, unknown>>(
    {
      agentId: "video_generator",
      task: `Generate ${requestedDuration}s local motion-graphic video: ${topic.slice(0, 100)}`,
      input: { topic, voice, duration: requestedDuration, mood, scriptProvider: scriptResult.provider },
      tools: ["piper.local", "espeak.local", "ffmpeg.local", "procedural-music.local"],
      requiresApproval: false,
    },
    async () => {
      await fs.mkdir(jobDir, { recursive: true });
      try {
        const narration = await generateSpeechToDuration(scriptResult.data.lines, voice, requestedDuration, audioPath, jobDir, jobId);
        const music = await generateProceduralInstrumental(musicPath, {
          durationSeconds: Math.min(90, Math.max(10, Math.ceil(narration.duration))),
          mood,
          bpm: 88,
          seed: `${topic}|${mood}`,
        });

        const captionFiles = await Promise.all(narration.segments.map(async (segment, index) => {
          const filePath = path.join(jobDir, `caption-${index}.txt`);
          await fs.writeFile(filePath, segment.text.slice(0, 180), "utf8");
          const fontFile = process.env.VIDEO_FONT_PATH?.trim() || path.join(process.cwd(), "public", "fonts", "HindSiliguri-Bold.ttf");
          const fontArg = await fs.access(fontFile).then(() => `:fontfile='${escapeFilterPath(fontFile)}'`).catch(() => "");
          return `drawtext=textfile='${escapeFilterPath(filePath)}'${fontArg}:fontcolor=white:fontsize=50:box=1:boxcolor=0x161324@0.62:boxborderw=28:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${segment.start.toFixed(2)},${segment.end.toFixed(2)})'`;
        }));
        const filter = `drawbox=x=0:y=0:w=iw:h=ih:color=0x161324@0.22:t=fill,${captionFiles.join(",")}`;
        const colorInput = `color=c=0x241b35:s=1080x1920:d=${narration.duration.toFixed(2)}:r=30`;
        runTool("ffmpeg", [
          "-y", "-f", "lavfi", "-i", colorInput,
          "-i", audioPath,
          "-stream_loop", "-1", "-i", musicPath,
          "-filter_complex", "[1:a]volume=1.0[voice];[2:a]volume=0.13[bed];[voice][bed]amix=inputs=2:duration=first:dropout_transition=2[mix]",
          "-vf", filter,
          "-map", "0:v:0", "-map", "[mix]",
          "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "160k", "-shortest", videoPath,
        ], 600_000);
        const metadata = probeVideo(videoPath);
        if (metadata.duration + 0.25 < requestedDuration) throw new Error(`Duration QA failed (${metadata.duration.toFixed(1)}s rendered, ${requestedDuration}s requested)`);

        return {
          data: {
            status: "COMPLETED",
            jobId,
            topic,
            script: scriptResult.data,
            scriptProvider: scriptResult.provider,
            scriptUsedFallback: scriptResult.usedFallback,
            scriptQualityPipeline,
            qualityPipeline: scriptQualityPipeline,
            voiceMode: "LOCAL_SYNTHETIC_SPEECH",
            voiceEngine: narration.voiceEngine,
            musicMode: "LOCAL_PROCEDURAL_INSTRUMENTAL",
            music,
            video: {
              filePath: `/storage/videos/${jobId}.mp4`,
              fileUrl: `/api/media/video/${jobId}`,
              duration: Math.round(metadata.duration * 10) / 10,
              requestedDuration,
              durationQaPassed: true,
              width: metadata.width,
              height: metadata.height,
              fps: metadata.fps,
              videoCodec: metadata.videoCodec,
              audioCodec: metadata.audioCodec,
              audioSampleRate: metadata.audioSampleRate,
              audioChannels: metadata.audioChannels,
              fileSize: metadata.fileSize,
              mimeType: metadata.mimeType,
            },
            scenesGenerated: narration.segments.length,
            sceneTimeline: narration.segments.map((segment, index) => ({ scene: index + 1, start: Math.round(segment.start * 10) / 10, end: Math.round(segment.end * 10) / 10, text: segment.text.slice(0, 100) })),
            visualMode: "LOCAL_MOTION_GRAPHIC",
            note: "This is a locally rendered motion-graphics video with synthetic narration and a procedural instrumental, not AI-generated live-action footage.",
          },
          provider: "local-ffmpeg+piper-or-espeak+procedural-synth",
        };
      } catch (error) {
        await fs.unlink(videoPath).catch(() => undefined);
        throw error;
      } finally {
        await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  );

  if (agent.status !== "success") {
    return NextResponse.json({ status: "FAILED", errorCode: "GENERATION_ERROR", jobId, topic, error: agent.error, agentRunId: agent.runId }, { status: 503 });
  }
  return NextResponse.json({ ...agent.result, agentRunId: agent.runId, agentId: agent.agentId, agentStatus: agent.status, auditId: agent.auditId }, { headers: { "Cache-Control": "no-store" } });
}
