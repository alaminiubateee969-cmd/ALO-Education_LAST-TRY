import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { executeAsAgent, recordAgentPipelineStages } from "@/lib/agent-runtime";
import { generateImageFile, generateNarrationScript, type QualityAgentPass } from "@/lib/ai";
import { generateProceduralInstrumental, synthesizeLocalSpeech, type MusicMood } from "@/lib/local-audio";
import { ensureSeeded } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIDEO_DIR = path.join(process.cwd(), "storage", "videos");
const ASSET_DIR = path.join(process.cwd(), "storage", "scene-assets");
const MOODS = new Set<MusicMood>(["calm", "hopeful", "playful", "reflective"]);

type Segment = { text: string; start: number; end: number };
type SceneGroup = { segments: Segment[]; start: number; end: number; duration: number; visualPrompt: string; assetPath: string; imageGenerated: boolean };

function runTool(binary: string, args: string[], timeoutMs = 300_000): string {
  try {
    return execFileSync(binary, args, { timeout: timeoutMs, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 }).trim();
  } catch (error) {
    const issue = error as NodeJS.ErrnoException & { stderr?: Buffer | string };
    throw new Error(`${binary} failed: ${String(issue.stderr || issue.message || "unknown error").slice(0, 300)}`);
  }
}

function probeDuration(filePath: string): number {
  const duration = Number.parseFloat(runTool("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath], 20_000));
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("ffprobe could not read the local audio duration");
  return duration;
}

function probeVideo(filePath: string) {
  const data = JSON.parse(runTool("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath], 20_000));
  const video = data.streams.find((stream: { codec_type: string }) => stream.codec_type === "video");
  const audio = data.streams.find((stream: { codec_type: string }) => stream.codec_type === "audio");
  if (!video) throw new Error("Rendered file contains no video stream");
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
  };
}

function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function srtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const whole = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(whole).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function groupSegments(segments: Segment[], maxGroups = 3): SceneGroup[] {
  const chunkSize = Math.ceil(segments.length / maxGroups);
  const groups: SceneGroup[] = [];
  for (let index = 0; index < segments.length; index += chunkSize) {
    const batch = segments.slice(index, index + chunkSize);
    groups.push({
      segments: batch,
      start: batch[0].start,
      end: batch[batch.length - 1].end,
      duration: batch[batch.length - 1].end - batch[0].start,
      visualPrompt: "",
      assetPath: "",
      imageGenerated: false,
    });
  }
  return groups;
}

async function createFallbackIllustration(outputPath: string, index: number) {
  const palettes = [
    ["#fff7ed", "#fed7aa", "#f59e0b"],
    ["#fdf2f8", "#fbcfe8", "#e879f9"],
    ["#ecfdf5", "#a7f3d0", "#10b981"],
  ];
  const [base, soft, accent] = palettes[index % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1344" viewBox="0 0 768 1344"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="${soft}"/></linearGradient><radialGradient id="glow"><stop stop-color="${accent}" stop-opacity=".42"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="768" height="1344" fill="url(#bg)"/><circle cx="385" cy="475" r="350" fill="url(#glow)"/><circle cx="150" cy="220" r="76" fill="${accent}" opacity=".15"/><circle cx="650" cy="880" r="128" fill="${accent}" opacity=".14"/><path d="M100 1040c115-100 195-100 290 0s180 100 278 0" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" opacity=".5"/><path d="M170 1120c95-72 168-72 252 0s154 72 230 0" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity=".32"/><g fill="${accent}" opacity=".65"><path d="M580 256l12 30 30 12-30 12-12 30-12-30-30-12 30-12z"/><path d="M206 690l8 20 20 8-20 8-8 20-8-20-20-8 20-8z"/></g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

async function synthesizeNarration(
  lines: string[],
  voice: string,
  requestedDuration: number,
  audioPath: string,
  jobDir: string
): Promise<{ duration: number; segments: Segment[]; voiceEngine: string }> {
  const padding = [
    "প্রতিটি শিশুর শেখার গতি আলাদা—তাই তুলনা নয়, পাশে থাকুন।",
    "প্রতিদিন অল্প সময় গল্প, খেলা আর কথোপকথনে দিন।",
    "শিশুর ছোট ছোট চেষ্টাকে স্বীকৃতি দিন এবং উৎসাহ দিন।",
    "কঠিন লাগলে ধৈর্য ধরুন; ভালোবাসা দিয়ে শেখার সুযোগ তৈরি হয়।",
    "আজকের একটি সহজ অভ্যাস বেছে নিয়ে একসাথে চেষ্টা করুন।",
    "আপনার অভিজ্ঞতা আলো লার্নিং জার্নির সাথে শেয়ার করুন।",
    "আলো লার্নিং জার্নি—ভালোবাসা দিয়ে শেখার পথ।",
  ];
  const parts: string[] = [];
  const segments: Segment[] = [];
  let elapsed = 0;
  let index = 0;
  let paddingIndex = 0;
  let voiceEngine = "espeak-local";
  while (elapsed < requestedDuration && index < 500) {
    const text = (index < lines.length ? lines[index] : padding[paddingIndex++ % padding.length]).trim();
    const output = path.join(jobDir, `voice-${index}.wav`);
    const synthesized = await synthesizeLocalSpeech(text, output, voice);
    voiceEngine = synthesized.engine;
    const duration = probeDuration(output);
    segments.push({ text, start: elapsed, end: elapsed + duration });
    parts.push(output);
    elapsed += duration;
    index++;
  }
  if (elapsed < requestedDuration || !parts.length) throw new Error("Local narration could not reach the requested length");

  const listPath = path.join(jobDir, "voice-concat.txt");
  await fs.writeFile(listPath, parts.map((file) => `file '${file.replace(/\\/g, "\\\\").replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
  runTool("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:a", "pcm_s16le", audioPath]);
  return { duration: probeDuration(audioPath), segments, voiceEngine };
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
  if (typeof body.audioPath === "string" && body.audioPath.trim()) {
    return NextResponse.json({ error: "Audio upload transcription is not enabled. Provide text input; no external STT service is used." }, { status: 422 });
  }
  const providedText = typeof body.script === "string" ? body.script.trim() : typeof body.text === "string" ? body.text.trim() : typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (providedText.length > 8_000) return NextResponse.json({ error: "text must be 8,000 characters or fewer" }, { status: 400 });
  const suppliedVisualPrompts = Array.isArray(body.visualPrompts)
    ? body.visualPrompts.filter((value): value is string => typeof value === "string").slice(0, 3).map((value) => value.trim().slice(0, 300))
    : [];
  const voice = typeof body.voice === "string" ? body.voice.slice(0, 24) : "bn";
  const visualStyle = typeof body.visualStyle === "string" ? body.visualStyle.trim().slice(0, 100) : "warm Bengali editorial illustration";
  const mood = typeof body.mood === "string" && MOODS.has(body.mood as MusicMood) ? body.mood as MusicMood : "hopeful";
  const jobId = `cine_${randomUUID()}`;
  const jobDir = path.join(VIDEO_DIR, jobId);
  const videoPath = path.join(VIDEO_DIR, `${jobId}.mp4`);
  const subtitlePath = path.join(VIDEO_DIR, `${jobId}.srt`);
  const audioPath = path.join(jobDir, "narration.wav");
  const musicPath = path.join(jobDir, "instrumental.wav");
  const generatedAssets: string[] = [];

  const scriptResult = providedText
    ? { data: { title: topic, lines: providedText.split(/\n+/).map((line) => line.trim()).filter(Boolean) }, provider: "provided-by-user", usedFallback: false, qualityPipeline: [] as QualityAgentPass[] }
    : await generateNarrationScript(topic, typeof body.audience === "string" ? body.audience.slice(0, 160) : undefined);
  if (!scriptResult.data.lines.length) return NextResponse.json({ error: "No narration lines were provided or generated" }, { status: 400 });
  const scriptQualityPipeline = scriptResult.qualityPipeline ?? [];
  await recordAgentPipelineStages("cinematic narration script", scriptQualityPipeline);
  const visualQualityPipeline: QualityAgentPass[] = [];

  const agent = await executeAsAgent<Record<string, unknown>>(
    {
      agentId: "video_generator",
      task: `Create local cinematic motion-graphics video: ${topic.slice(0, 100)}`,
      input: { topic, duration: requestedDuration, mood, visualStyle, scriptProvider: scriptResult.provider },
      tools: ["ollama.local", "comfyui.local", "piper.local", "espeak.local", "ffmpeg.local", "procedural-music.local"],
      requiresApproval: false,
    },
    async () => {
      await fs.mkdir(jobDir, { recursive: true });
      await fs.mkdir(ASSET_DIR, { recursive: true });
      try {
        const narration = await synthesizeNarration(scriptResult.data.lines, voice, requestedDuration, audioPath, jobDir);
        const music = await generateProceduralInstrumental(musicPath, {
          durationSeconds: Math.min(90, Math.max(10, Math.ceil(narration.duration))),
          mood,
          bpm: 84,
          seed: `${topic}|${mood}|cinematic`,
        });
        const groups = groupSegments(narration.segments);
        for (const [index, group] of groups.entries()) {
          const firstLine = group.segments[0]?.text.slice(0, 110) ?? topic;
          const lastLine = group.segments[group.segments.length - 1]?.text.slice(0, 70) ?? "";
          group.visualPrompt = suppliedVisualPrompts[index] || `${visualStyle}, child-safe and hopeful editorial illustration, Bengali family learning together, warm cinematic light, topic: ${topic}, scene: ${firstLine} ${lastLine}, no text, no logos`;
          group.assetPath = path.join(ASSET_DIR, `${jobId}_scene${index}.png`);
          const imageResult = await generateImageFile(group.visualPrompt, group.assetPath, "768x1344");
          const imagePromptPasses = imageResult.qualityPipeline ?? [];
          await recordAgentPipelineStages(`cinematic scene ${index + 1} image prompt`, imagePromptPasses);
          visualQualityPipeline.push(...imagePromptPasses.map((pass) => ({ ...pass, role: `Scene ${index + 1} · ${pass.role}` })));
          if (imageResult.usedFallback) {
            await createFallbackIllustration(group.assetPath, index);
          } else {
            group.imageGenerated = true;
          }
          generatedAssets.push(group.assetPath);
        }

        const srt = narration.segments.map((segment, index) => `${index + 1}\n${srtTime(segment.start)} --> ${srtTime(segment.end)}\n${segment.text}\n`).join("\n");
        await fs.writeFile(path.join(jobDir, "subtitles.srt"), srt, "utf8");

        const args = ["-y"];
        for (const group of groups) args.push("-loop", "1", "-framerate", "30", "-t", group.duration.toFixed(3), "-i", group.assetPath);
        const voiceInputIndex = groups.length;
        const musicInputIndex = groups.length + 1;
        args.push("-i", audioPath, "-stream_loop", "-1", "-i", musicPath);

        const fontFile = process.env.VIDEO_FONT_PATH?.trim() || path.join(process.cwd(), "public", "fonts", "HindSiliguri-Bold.ttf");
        const fontArg = await fs.access(fontFile).then(() => `:fontfile='${escapeFilterPath(fontFile)}'`).catch(() => "");
        const filterParts: string[] = [];
        groups.forEach((group, index) => {
          const duration = group.duration.toFixed(3);
          filterParts.push(`[${index}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.00018,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1,fade=t=in:st=0:d=0.30,fade=t=out:st=${Math.max(0, group.duration - 0.30).toFixed(3)}:d=0.30[scene${index}]`);
        });
        const concatInputs = groups.map((_, index) => `[scene${index}]`).join("");
        filterParts.push(`${concatInputs}concat=n=${groups.length}:v=1:a=0[base]`);

        const titlePath = path.join(jobDir, "title.txt");
        await fs.writeFile(titlePath, topic.slice(0, 100), "utf8");
        let currentVideo = "base";
        filterParts.push(`[${currentVideo}]drawtext=textfile='${escapeFilterPath(titlePath)}'${fontArg}:fontcolor=white:fontsize=58:box=1:boxcolor=0x171427@0.54:boxborderw=28:x=(w-text_w)/2:y=h*0.12:enable='between(t,0,4)'[titled]`);
        currentVideo = "titled";
        for (const [index, segment] of narration.segments.entries()) {
          const captionPath = path.join(jobDir, `subtitle-${index}.txt`);
          await fs.writeFile(captionPath, segment.text.slice(0, 180), "utf8");
          const outputLabel = index === narration.segments.length - 1 ? "videoout" : `caption${index}`;
          filterParts.push(`[${currentVideo}]drawtext=textfile='${escapeFilterPath(captionPath)}'${fontArg}:fontcolor=white:fontsize=42:box=1:boxcolor=0x171427@0.62:boxborderw=22:x=(w-text_w)/2:y=h*0.68:enable='between(t,${segment.start.toFixed(2)},${segment.end.toFixed(2)})'[${outputLabel}]`);
          currentVideo = outputLabel;
        }
        filterParts.push(`[${voiceInputIndex}:a]volume=1.0[voice];[${musicInputIndex}:a]volume=0.13[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[audio]`);
        args.push(
          "-filter_complex", filterParts.join(";"),
          "-map", "[videoout]", "-map", "[audio]",
          "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "160k", "-shortest", videoPath,
        );
        runTool("ffmpeg", args, 900_000);
        const metadata = probeVideo(videoPath);
        if (metadata.duration + 0.25 < requestedDuration) throw new Error(`Duration QA failed (${metadata.duration.toFixed(1)}s rendered, ${requestedDuration}s requested)`);
        await fs.copyFile(path.join(jobDir, "subtitles.srt"), subtitlePath);

        const sceneData = groups.map((group, index) => ({
          sceneId: index + 1,
          start: Math.round(group.start * 10) / 10,
          end: Math.round(group.end * 10) / 10,
          duration: Math.round(group.duration * 10) / 10,
          visualPrompt: group.visualPrompt,
          shotType: ["wide", "medium", "close-up"][index % 3],
          cameraMovement: index % 2 ? "slow-pan" : "gentle-ken-burns-zoom",
          transition: index < groups.length - 1 ? "fade-through-black" : "fade-out",
          assetPath: `/api/media/scene/${jobId}_scene${index}.png`,
          imageGenerated: group.imageGenerated,
          narration: group.segments.map((segment) => segment.text).join(" "),
        }));

        return {
          data: {
            status: "COMPLETED",
            jobId,
            topic,
            transcript: providedText || scriptResult.data.lines.join("\n"),
            scriptProvider: scriptResult.provider,
            scriptUsedFallback: scriptResult.usedFallback,
            scriptQualityPipeline,
            imagePromptQualityPipeline: visualQualityPipeline,
            qualityPipeline: [...scriptQualityPipeline, ...visualQualityPipeline],
            voiceMode: "LOCAL_SYNTHETIC_SPEECH",
            voiceEngine: narration.voiceEngine,
            video: {
              filePath: `/storage/videos/${jobId}.mp4`,
              fileUrl: `/api/media/video/${jobId}`,
              duration: Math.round(metadata.duration * 10) / 10,
              requestedDuration,
              actualDuration: Math.round(metadata.duration * 10) / 10,
              durationQaPassed: true,
              width: metadata.width,
              height: metadata.height,
              fps: metadata.fps,
              videoCodec: metadata.videoCodec,
              audioCodec: metadata.audioCodec,
              audioSampleRate: metadata.audioSampleRate,
              audioChannels: metadata.audioChannels,
              fileSize: metadata.fileSize,
              fileSizeMb: Math.round((metadata.fileSize / 1024 / 1024) * 100) / 100,
              mimeType: metadata.mimeType,
            },
            scenes: sceneData,
            scenesGenerated: sceneData.length,
            visualAssetsGenerated: groups.filter((group) => group.imageGenerated).length,
            visualAssetStatus: groups.some((group) => group.imageGenerated) ? "COMFYUI_LOCAL" : "BRANDED_LOCAL_PLACEHOLDERS",
            musicMode: "LOCAL_PROCEDURAL_INSTRUMENTAL",
            music,
            subtitleStatus: "BURNED_IN_AND_SRT",
            srtUrl: `/api/media/subtitle/${jobId}`,
            sceneTimeline: sceneData.map(({ sceneId, start, end, duration, imageGenerated }) => ({ sceneId, start, end, duration, imageGenerated })),
            note: "Cinematic-style local slideshow: ComfyUI-generated stills when configured, gentle Ken Burns motion, local synthetic narration and procedural instrumental. It is not frame-by-frame AI video or sung vocals.",
          },
          provider: `local-${narration.voiceEngine}+ffmpeg+procedural-synth`,
        };
      } catch (error) {
        await fs.unlink(videoPath).catch(() => undefined);
        await fs.unlink(subtitlePath).catch(() => undefined);
        await Promise.all(generatedAssets.map((asset) => fs.unlink(asset).catch(() => undefined)));
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
