#!/usr/bin/env node
/**
 * safe-prisma.mjs — destructive-command guard for the ALO Learning Journey
 * production database.
 *
 * Wraps `prisma migrate dev`, `prisma migrate reset`, and `prisma db push`.
 * Those commands can rewrite or DESTROY schema and data. They must never run
 * against the production database (`db_learn` on the VPS) by accident — the
 * documented recovery path is `prisma migrate deploy` (additive only), which
 * scripts/deploy-production.sh runs after a verified backup.
 *
 * Behaviour:
 *   - Refuses when DATABASE_URL points at the production database name
 *     (default `db_learn`, extend via ALO_PROD_DB_NAMES, comma-separated)
 *     unless ALO_ALLOW_DESTRUCTIVE_DB=1 is set explicitly in the environment.
 *   - Refuses when the URL host is not loopback (catches staging-vs-prod mixups
 *     where the production DB is reached over the network).
 *   - Otherwise execs the requested prisma command unchanged.
 *
 * Exit codes: 0 = prisma's own exit code; 78 (EX_CONFIG) = blocked.
 */
import { spawnSync } from "node:child_process";

const FORBIDDEN_SUBCOMMANDS = new Set([
  "migrate dev",
  "migrate reset",
  "db push",
  "migrate diff --shadow-database-url", // never point this at prod either
]);

function parseDatabaseUrl(raw) {
  const value = (raw || "").trim().replace(/^["']|["']$/g, "");
  if (!value) return { ok: false, reason: "DATABASE_URL is empty (local fallback mode — nothing to guard)" };
  if (!value.startsWith("mysql://")) return { ok: false, reason: "DATABASE_URL is not mysql://" };
  try {
    const url = new URL(value);
    return {
      ok: true,
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
      host: url.hostname,
    };
  } catch {
    return { ok: false, reason: "DATABASE_URL is not a parsable URL" };
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const prismaArgs = args.filter((a) => a !== "--dry-run");
  const command = prismaArgs.join(" ");

  if (prismaArgs.length === 0 || prismaArgs[0] === "--help" || prismaArgs[0] === "-h") {
    console.log("usage: node scripts/safe-prisma.mjs [--dry-run] <prisma args...>");
    console.log("  wraps destructive prisma commands (migrate dev / migrate reset /");
    console.log("  db push) and refuses to run them against the production database.");
    console.log("  --dry-run prints the decision without invoking prisma.");
    process.exit(prismaArgs.length === 0 ? 78 : 0);
  }

  const isDestructive = [...FORBIDDEN_SUBCOMMANDS].some((sub) => command.startsWith(sub) || command.includes(` ${sub} `));
  if (!isDestructive) {
    if (dryRun) {
      console.log("allow (non-destructive command)");
      process.exit(0);
    }
    const run = spawnSync("npx", ["prisma", ...prismaArgs], { stdio: "inherit" });
    process.exit(run.status ?? 1);
  }

  const url = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!url.ok) {
    // No usable DATABASE_URL → prisma itself will fail; pass through untouched.
    if (dryRun) {
      console.log(`allow (${url.reason})`);
      process.exit(0);
    }
    const run = spawnSync("npx", ["prisma", ...prismaArgs], { stdio: "inherit" });
    process.exit(run.status ?? 1);
  }

  const prodNames = new Set(
    (process.env.ALO_PROD_DB_NAMES || "db_learn")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const reasons = [];
  if (prodNames.has(url.database)) {
    reasons.push(
      `DATABASE_URL targets the PRODUCTION database "${url.database}"${url.host ? ` on ${url.host}` : ""}`,
    );
  }
  const isLoopback = url.host === "127.0.0.1" || url.host === "localhost" || url.host === "::1" || url.host === "";
  if (!isLoopback) {
    reasons.push(`DATABASE_URL host "${url.host}" is not loopback — refusing destructive commands against remote databases`);
  }

  if (reasons.length > 0 && process.env.ALO_ALLOW_DESTRUCTIVE_DB !== "1") {
    if (dryRun) {
      console.log(`block (${reasons.join("; ")})`);
      process.exit(0);
    }
    console.error("╔══════════════════════════════════════════════════════════════════╗");
    console.error("║  BLOCKED: destructive prisma command refused                     ║");
    console.error("╚══════════════════════════════════════════════════════════════════╝");
    console.error(`command : prisma ${command}`);
    for (const r of reasons) console.error(`reason  : ${r}`);
    console.error("");
    console.error("The supported production path is ADDITIVE ONLY:");
    console.error("  npx prisma migrate deploy        # applies pending migrations");
    console.error("  npx prisma migrate status        # read-only inspection");
    console.error("");
    console.error("If you REALLY intend to run this against this database (e.g. you are");
    console.error("deliberately re-initialising a disposable local copy), set:");
    console.error("  ALO_ALLOW_DESTRUCTIVE_DB=1");
    console.error("Never set that variable on the production VPS.");
    process.exit(78);
  }

  if (reasons.length > 0) {
    console.warn(`[safe-prisma] WARNING: proceeding despite ${reasons.join("; ")} (ALO_ALLOW_DESTRUCTIVE_DB=1)`);
    if (dryRun) {
      console.log("allow (explicit override)");
      process.exit(0);
    }
  } else if (dryRun) {
    console.log("allow (local, non-production database)");
    process.exit(0);
  }
  const run = spawnSync("npx", ["prisma", ...prismaArgs], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

main();
