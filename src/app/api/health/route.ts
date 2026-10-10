import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const run = promisify(execFile);

type Check = {
  name: string;
  ok: boolean;
  critical: boolean;
  detail: string;
};

function record(
  results: Check[],
  name: string,
  critical: boolean,
  ok: boolean,
  detail: string
) {
  results.push({ name, ok, critical, detail });
}

async function checkDatabase(results: Check[]) {
  try {
    const { db } = await import("@/lib/db");
    const started = Date.now();
    await db.$queryRaw`SELECT 1`;
    const ms = Date.now() - started;

    try {
      const companies = String(await db.company.count());
      record(results, "Database", true, true, `query ok in ${ms}ms; Company rows=${companies}`);
    } catch (error) {
      record(
        results,
        "Database schema",
        true,
        false,
        `connection ok but Company.count() failed — schema likely not pushed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300)
      );
    }
  } catch (error) {
    record(
      results,
      "Database",
      true,
      false,
      `${error instanceof Error ? error.message : String(error)}`.slice(0, 300)
    );
  }
}

function checkEnv(results: Check[]) {
  // Only the authenticated diagnostics response includes connection-target shape.
  const url = process.env.DATABASE_URL;
  if (!url) {
    record(results, "DATABASE_URL", true, false, "not set — Prisma cannot connect");
    return;
  }
  const scheme = url.split(":")[0] || "unknown";
  const isFile = scheme === "file";
  const target = isFile
    ? `file path (${path.basename(url.replace(/^file:/, ""))})`
    : `${scheme}://<host redacted>`;
  record(results, "DATABASE_URL", true, true, `set; scheme=${scheme}; ${target}`);
}

async function checkStorage(results: Check[]) {
  const dirs = [
    path.join(process.cwd(), "storage", "videos"),
    path.join(process.cwd(), "storage", "audio"),
    path.join(process.cwd(), "storage", "backups"),
  ];
  for (const dir of dirs) {
    const probe = path.join(dir, `.health-${randomUUID()}.tmp`);
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(probe, "ok", { flag: "wx" });
      await fs.unlink(probe);
      record(results, `Storage ${path.basename(dir)}`, true, true, `writable at ${dir}`);
    } catch (error) {
      await fs.rm(probe, { force: true }).catch(() => undefined);
      record(
        results,
        `Storage ${path.basename(dir)}`,
        true,
        false,
        `not writable at ${dir}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200)
      );
    }
  }
  record(results, "Working directory", false, true, `cwd=${process.cwd()} (storage paths are cwd-relative)`);
}

async function checkBinary(results: Check[], name: string, args: string[], label: string) {
  try {
    await run(name, args, { timeout: 5000 });
    record(results, label, false, true, `${name} available`);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    record(
      results,
      label,
      false,
      false,
      err?.code === "ENOENT"
        ? `${name} not installed`
        : `${name} present but failed: ${err?.message ?? "unknown"}`.slice(0, 200)
    );
  }
}

async function checkLocalSpeech(results: Check[]) {
  const piperModel = process.env.PIPER_MODEL_PATH?.trim();
  if (piperModel) {
    const piper = process.env.PIPER_BIN?.trim() || "piper";
    try {
      await run(piper, ["--help"], { timeout: 5000 });
      record(results, "Local speech", false, true, `Piper executable and model path configured`);
      return;
    } catch {}
  }
  await checkBinary(results, process.env.ESPEAK_BIN?.trim() || "espeak", ["--version"], "Local speech (eSpeak)");
}

/**
 * The default public response is a low-detail readiness probe: it checks the
 * database connection and core schema, but never returns host paths or errors.
 * Add `?details=1` for diagnostics; middleware requires an admin session in
 * production before this query is served.
 */
export async function GET(request: Request) {
  const results: Check[] = [];
  const detailsRequested = new URL(request.url).searchParams.get("details") === "1";

  if (detailsRequested) {
    record(results, "Runtime", true, true, `node ${process.version}`);
    checkEnv(results);
    await Promise.all([
      checkDatabase(results),
      checkStorage(results),
      checkBinary(results, "ffmpeg", ["-version"], "FFmpeg"),
      checkBinary(results, "ffprobe", ["-version"], "FFprobe"),
      checkLocalSpeech(results),
    ]);
  } else {
    await checkDatabase(results);
  }

  const failedCritical = results.filter((check) => check.critical && !check.ok);
  const failedOptional = results.filter((check) => !check.critical && !check.ok);
  const status = failedCritical.length ? "unhealthy" : failedOptional.length ? "degraded" : "ok";
  const httpStatus = failedCritical.length ? 503 : 200;
  const checkedAt = new Date().toISOString();
  const summary = {
    total: results.length,
    failedCritical: failedCritical.map((check) => check.name),
    failedOptional: failedOptional.map((check) => check.name),
  };
  const legacyStatus = failedOptional.length || failedCritical.length ? "PARTIAL" : "COMPLETE";
  const baseResponse = { status, legacyStatus, httpStatus, checkedAt };

  return NextResponse.json(
    detailsRequested ? { ...baseResponse, checks: results, summary } : baseResponse,
    { status: httpStatus, headers: { "Cache-Control": "no-store" } }
  );
}
