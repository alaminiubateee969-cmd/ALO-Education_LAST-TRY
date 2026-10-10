import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

export type LocalChatResult = { content: string; model: string };

const LOCAL_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".test"];

function isPrivateAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:1" ||
    LOCAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) return true;

  // Docker Compose service names and other single-label hostnames are local-only.
  if (!host.includes(".") && !host.includes(":")) return true;

  const octets = host.split(".").map(Number);
  if (octets.length === 4 && octets.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) {
    const [a, b] = octets;
    return a === 10 || a === 127 ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  // Unique-local and link-local IPv6 ranges; public IPv6 hosts are rejected.
  return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
}

/** Resolve a deployment-configured local service URL and reject public hosts. */
export function getPrivateLocalBaseUrl(envName: string, fallback: string): URL {
  const raw = process.env[envName]?.trim() || fallback;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${envName} must be a valid local HTTP(S) URL`);
  }
  if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password ||
      url.search || url.hash || !isPrivateAddress(url.hostname)) {
    throw new Error(`${envName} must point to a private/local host; public AI endpoints are blocked`);
  }
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url;
}

function endpoint(base: URL, path: string): URL {
  const root = new URL(base);
  root.pathname = `${root.pathname.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  return root;
}

export async function generateLocalChatJson(
  system: string,
  user: string,
  timeoutMs: number
): Promise<LocalChatResult> {
  const base = getPrivateLocalBaseUrl("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
  const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b";
  const response = await fetch(endpoint(base, "/api/chat"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      options: { temperature: 0.7 },
    }),
  });
  if (!response.ok) throw new Error(`Local Ollama returned HTTP ${response.status}`);
  const payload = await response.json() as { message?: { content?: string }; model?: string; error?: string };
  if (payload.error) throw new Error(`Local Ollama error: ${payload.error.slice(0, 180)}`);
  if (!payload.message?.content?.trim()) throw new Error("Local Ollama returned an empty response");
  return { content: payload.message.content, model: payload.model || model };
}

export async function generateComfyUiImage(
  prompt: string,
  outputPath: string,
  size: "1024x1024" | "768x1344" | "1344x768" | "1440x720",
  timeoutMs = 180_000
): Promise<void> {
  const base = getPrivateLocalBaseUrl("COMFYUI_BASE_URL", "http://127.0.0.1:8188");
  const checkpoint = process.env.COMFYUI_CHECKPOINT?.trim();
  if (!checkpoint) throw new Error("Set COMFYUI_CHECKPOINT to a locally installed checkpoint before generating images");

  const [width, height] = size.split("x").map(Number);
  const seed = Math.floor(Math.random() * 2_147_483_647);
  const graph = {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
    "2": { class_type: "CLIPTextEncode", inputs: { text: prompt.slice(0, 2000), clip: ["1", 1] } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: "low quality, text, watermark, distorted hands, unsafe child depiction", clip: ["1", 1] } },
    "4": { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { seed, steps: 22, cfg: 6.5, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0] } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { filename_prefix: `alo_${randomUUID()}`, images: ["6", 0] } },
  };

  const queueResponse = await fetch(endpoint(base, "/prompt"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ prompt: graph, client_id: randomUUID() }),
  });
  if (!queueResponse.ok) throw new Error(`Local ComfyUI returned HTTP ${queueResponse.status}`);
  const queued = await queueResponse.json() as { prompt_id?: string; error?: string };
  if (!queued.prompt_id) throw new Error(queued.error || "Local ComfyUI did not return a job id");

  const deadline = Date.now() + timeoutMs;
  let image: { filename: string; subfolder?: string; type?: string } | undefined;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const historyResponse = await fetch(endpoint(base, `/history/${encodeURIComponent(queued.prompt_id)}`), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!historyResponse.ok) continue;
    const history = await historyResponse.json() as Record<string, { outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }>; status?: { status_str?: string; messages?: unknown[] } }>;
    const job = history[queued.prompt_id];
    if (!job) continue;
    if (job.status?.status_str === "error") throw new Error("Local ComfyUI image workflow failed");
    image = Object.values(job.outputs ?? {}).flatMap((output) => output.images ?? [])[0];
    if (image) break;
  }
  if (!image) throw new Error("Local ComfyUI image generation timed out");

  const viewUrl = endpoint(base, "/view");
  viewUrl.searchParams.set("filename", image.filename);
  viewUrl.searchParams.set("subfolder", image.subfolder || "");
  viewUrl.searchParams.set("type", image.type || "output");
  const imageResponse = await fetch(viewUrl, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!imageResponse.ok) throw new Error(`Could not download local ComfyUI output (${imageResponse.status})`);
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (bytes.byteLength < 128 || bytes.byteLength > 30 * 1024 * 1024) throw new Error("Local ComfyUI output size is invalid");
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    throw new Error("Local ComfyUI output is not a PNG image");
  }
  await writeFile(outputPath, bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
    await writeFile(outputPath, bytes);
  });
}

async function probeService(url: URL, timeoutMs = 1_800): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 140) : "connection failed" };
  }
}

export async function getLocalAiStatus() {
  const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b";
  const checkpoint = process.env.COMFYUI_CHECKPOINT?.trim() || null;
  let ollama: { ok: boolean; data?: unknown; error?: string };
  let comfyui: { ok: boolean; error?: string };
  try {
    ollama = await probeService(endpoint(getPrivateLocalBaseUrl("OLLAMA_BASE_URL", "http://127.0.0.1:11434"), "/api/tags"));
  } catch (error) {
    ollama = { ok: false, error: error instanceof Error ? error.message : "invalid local endpoint" };
  }
  try {
    comfyui = await probeService(endpoint(getPrivateLocalBaseUrl("COMFYUI_BASE_URL", "http://127.0.0.1:8188"), "/system_stats"));
  } catch (error) {
    comfyui = { ok: false, error: error instanceof Error ? error.message : "invalid local endpoint" };
  }

  const availableModels = (ollama.data as { models?: Array<{ name?: string }> } | undefined)?.models ?? [];
  const installedModels = availableModels.map((item) => item.name).filter((name): name is string => Boolean(name));
  const modelInstalled = installedModels.some((name) => name === model || name.startsWith(`${model}-`));
  return {
    mode: "local-only" as const,
    paidApiCalls: false as const,
    text: { available: ollama.ok && modelInstalled, serviceAvailable: ollama.ok, model, installedModels, error: !ollama.ok ? ollama.error : modelInstalled ? undefined : `Configured Ollama model ${model} is not installed` },
    images: { available: comfyui.ok && Boolean(checkpoint), checkpoint, error: !checkpoint ? "COMFYUI_CHECKPOINT is not configured" : comfyui.error },
  };
}
