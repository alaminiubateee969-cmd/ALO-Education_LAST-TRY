import { NextResponse } from "next/server";
import { getLocalAiStatus } from "@/lib/local-models";
import { localMediaBinaries } from "@/lib/local-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [ai, binaries] = await Promise.all([
    getLocalAiStatus(),
    Promise.resolve(localMediaBinaries()),
  ]);
  return NextResponse.json({
    ...ai,
    media: {
      ffmpeg: binaries.ffmpeg,
      ffprobe: binaries.ffprobe,
      speech: {
        piperAvailable: binaries.piper,
        espeakAvailable: binaries.espeak,
        usable: binaries.piper || binaries.espeak,
      },
    },
    notes: {
      noPaidApis: true,
      localTextNeededForModelGeneratedLyrics: true,
      imageGenerationNeedsComfyUiAndCheckpoint: true,
      songAudio: "procedural instrumental; it is not a sung vocal track",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
