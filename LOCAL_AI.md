# Local-only AI and media generation

## Provider boundary

The application source does not call OpenAI, Gemini, Claude, ElevenLabs, RunningHub, or another hosted AI provider. Text/chat requests go only to a private Ollama endpoint; image requests go only to a private ComfyUI endpoint. The endpoint guard rejects public hostnames/IP addresses. If a local model is unavailable, the API reports a deterministic fallback instead of silently switching to a cloud service. No AI API keys are required.

**Live-verified 2026-10-17 (sandbox):** every media pipeline was run end-to-end with **zero paid APIs and zero external AI hosts**, and all outputs are real media files:

| Pipeline | Provider chain | Verified output |
|---|---|---|
| Image | `comfyui-local` (sharp editorial fallback) | 1024×1024 PNG in `public/generated/` |
| Voice | `espeak-local` | WAV narration in `storage/audio/` |
| Music | `ollama-local` lyrics + `local-procedural-synth` | Bengali lyrics + instrumental WAV in `storage/audio/` |
| Video | `espeak-local` + procedural instrumental + FFmpeg | 1080×1920 H.264+AAC MP4 + Bengali SRT in `storage/videos/` |
| Cinematic | `ollama-local` script + scene stills + FFmpeg | H.264 MP4 + SRT, 3-scene render |

A source scan of every media route (`images/generate`, `voice/generate`, `music/generate`, `video/generate`, `video/cinematic` and their libs) found **no** `fetch`/`axios` call to OpenAI, Anthropic, Gemini, ElevenLabs, Replicate, Stability, or any other hosted AI service — only loopback/private Ollama and ComfyUI. `GET /api/ai/local-status` reports `mode: local-only` and `paidApiCalls: false`. No AI API key is needed for any of these; the optional `HTTPSMS_API_KEY` / `INKBOX_API_KEY` entries in `.env.example` cover SMS OTP delivery and a notes integration only, and the app runs fully without them.

## Text and Bengali copy

1. Install Ollama on the application machine or an isolated private-network host.
2. Pull a local instruction model appropriate for Bengali (the example default is `qwen2.5:7b`; choose a model whose license and quality meet your use case).
3. Configure:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
```

Docker deployments may use a private Compose service name such as `http://ollama:11434`. Public endpoints are blocked by the application adapter. When Ollama is offline or the selected model is not installed, generated-copy APIs return a marked local template fallback; the fallback is not an LLM output.

## Image generation

1. Install ComfyUI locally, expose its API only on loopback/private networking, and install a compatible checkpoint in `ComfyUI/models/checkpoints`.
2. Set the checkpoint's installed filename exactly:

```dotenv
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_CHECKPOINT=your-local-checkpoint.safetensors
```

The adapter submits a basic checkpoint / text-encode / sampler / save-image graph to ComfyUI's local API. It does not call RunningHub or any cloud image service. Check the model and checkpoint licenses before commercial use. Without a working local checkpoint, image generation produces a clearly marked branded SVG/illustration placeholder; it is not represented as AI artwork.

## Local speech

Piper is preferred when an operator installs a local voice model. Otherwise the app can use an installed `espeak` executable. Configure as needed:

```dotenv
PIPER_BIN=piper
PIPER_MODEL_PATH=/opt/alo/models/bn_voice.onnx
ESPEAK_BIN=espeak
VIDEO_FONT_PATH=./public/fonts/HindSiliguri-Bold.ttf
```

Piper/eSpeak synthesize spoken narration, not singing. Do not clone or imitate a real person's voice without the required permission. The `bn` voice ID must exist in the selected local speech engine; not every distribution includes a natural Bangla voice. Hind Siliguri UI/video font files are bundled from Google Fonts' source repository under the SIL Open Font License; the full license and attribution are in `public/fonts/OFL-HindSiliguri.txt`, and the app no longer fetches fonts from Google during builds.

## Songs and video

- `POST /api/music/generate` asks the local Ollama model for an original Bengali lyric draft when available and creates a stereo WAV instrumental using the built-in deterministic procedural synthesizer. If Ollama is unavailable, it marks the lyrics as a template fallback. The downloaded track is instrumental only—no vocals are sung.
- `POST /api/video/cinematic` uses a local ComfyUI image for each storyboard group when configured; otherwise it creates local abstract branded placeholders. FFmpeg adds slow Ken Burns movement, Bengali captions/SRT, local synthetic speech, and a procedural music bed. This is a cinematic-style still-image slideshow/motion graphic, not frame-by-frame AI-generated footage.
- `POST /api/video/generate` renders a local text-led social video with synthetic narration and the same procedural music engine.
- Generated audio/video/scene assets are written below `storage/audio`, `storage/videos`, and `storage/scene-assets`; these paths are git-ignored. Audio and video are served through authenticated `/api/media/...` routes, including byte-range playback for MP4.
- Audio upload transcription is not enabled. The cinematic endpoint accepts text, not an arbitrary server file path.

## Operations and limitations

- Local inference still consumes the host's RAM/VRAM, CPU/GPU, disk, power, and operator time. The Cost & Usage view reports paid AI API estimate as zero and does **not** price that infrastructure.
- Model downloads, model-license compliance, GPU performance, accessibility, output quality, moderation effectiveness, and production concurrency have not been independently verified here.
- Content packages, email drafts, song lyrics, narration scripts, and image prompts can run sequential local writer → critic → finalist passes. Actual pass states are returned/logged; if Ollama is unavailable, downstream passes are marked skipped and the template fallback remains visible. These passes and structural/editorial rubric scores are not factual verification and do not establish a measured “10×” improvement.
- The email endpoint only creates a draft and logs its agent stages. No email sender, consent/suppression system, unsubscribe endpoint, or SMTP/Resend integration is available.
- Production administrator login requires a fixed-phone SMS OTP through an operator-configured HTTPSMS-compatible endpoint. Codes are stored as HMACs and limited, but a gateway's queued response does not prove delivery; SMS charges may apply. This is a non-AI external integration and was not exercised here.
- The application has a single administrator, not multi-user roles or public-user isolation. The OTP route has send/attempt limits, but there is no general IP-based login/API rate limit. Do not advertise it as an open public service until identity/roles, edge rate limits, storage quotas/retention, abuse controls, backups, and live deployment checks are implemented and tested.
- Facebook page access/publication is not automatic. The provided page link is presented for reference only; its content has not been fetched or verified. Marketing kits remain human-reviewed and are not sent/published by this local-generation pipeline.
