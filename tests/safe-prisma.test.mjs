// safe-prisma guard tests — the production-database destructive-command block.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const REPO = path.join(import.meta.dirname, "..");
const script = path.join(REPO, "scripts", "safe-prisma.mjs");

function decide(env, ...args) {
  const merged = { ...process.env, ...env };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete merged[key];
  return execFileSync("node", [script, "--dry-run", ...args], {
    encoding: "utf8",
    env: merged,
    timeout: 30_000,
  }).trim();
}

test("migrate dev against db_learn is BLOCKED", () => {
  const out = decide({ DATABASE_URL: "mysql://alo:pw@127.0.0.1:3306/db_learn" }, "migrate", "dev");
  assert.match(out, /^block \(.*PRODUCTION database "db_learn"/);
});

test("migrate reset against db_learn is BLOCKED", () => {
  const out = decide({ DATABASE_URL: "mysql://alo:pw@localhost:3306/db_learn" }, "migrate", "reset");
  assert.match(out, /^block /);
});

test("db push against db_learn is BLOCKED", () => {
  const out = decide({ DATABASE_URL: "mysql://alo:pw@127.0.0.1:3306/db_learn" }, "db", "push");
  assert.match(out, /^block /);
});

test("destructive command against a REMOTE host is BLOCKED (even for unknown db names)", () => {
  const out = decide({ DATABASE_URL: "mysql://alo:pw@10.20.30.40:3306/devdb" }, "migrate", "dev");
  assert.match(out, /^block \(.*not loopback/);
});

test("explicit override is required and honoured", () => {
  const out = decide(
    { DATABASE_URL: "mysql://alo:pw@127.0.0.1:3306/db_learn", ALO_ALLOW_DESTRUCTIVE_DB: "1" },
    "migrate", "dev",
  );
  assert.match(out, /^allow \(explicit override\)/);
});

test("a local dev database is allowed through", () => {
  const out = decide({ DATABASE_URL: "mysql://alo:pw@127.0.0.1:3306/alo_dev" }, "migrate", "dev");
  assert.match(out, /^allow \(local, non-production database\)/);
});

test("non-destructive commands (deploy/status/generate) are never blocked", () => {
  for (const cmd of [["migrate", "deploy"], ["migrate", "status"], ["generate"], ["validate"]]) {
    const out = decide({ DATABASE_URL: "mysql://alo:pw@127.0.0.1:3306/db_learn" }, ...cmd);
    assert.match(out, /^allow \(non-destructive command\)/, `prisma ${cmd.join(" ")}`);
  }
});

test("custom production db names are honoured via ALO_PROD_DB_NAMES", () => {
  const out = decide(
    { DATABASE_URL: "mysql://alo:pw@127.0.0.1:3306/other_prod", ALO_PROD_DB_NAMES: "db_learn,other_prod" },
    "db", "push",
  );
  assert.match(out, /^block /);
});

test("real (non-dry-run) invocation exits 78 when blocked", () => {
  let exitCode = 0;
  try {
    execFileSync("node", [script, "migrate", "dev"], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "mysql://alo:pw@127.0.0.1:3306/db_learn" },
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 30_000,
    });
  } catch (err) {
    exitCode = err.status ?? -1;
  }
  assert.equal(exitCode, 78, "blocked commands must exit 78 (EX_CONFIG)");
});
