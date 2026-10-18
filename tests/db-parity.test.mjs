// Schema ↔ migration parity tests (engine-free).
// Positive: the committed schema and migrations must describe the identical
// database. Negative: a deliberately tampered copy MUST be detected — proving
// the checker actually catches drift instead of vacuously passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, cpSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.join(import.meta.dirname, "..");
const script = path.join(REPO, "scripts", "verify-migration-parity.mjs");

function runParity(schemaDir) {
  try {
    const stdout = execFileSync("node", [script, "--schema", path.join(schemaDir, "schema.prisma"), "--migrations", path.join(schemaDir, "migrations")], {
      encoding: "utf8",
      timeout: 60_000,
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: String(err.stdout ?? "") + String(err.stderr ?? "") };
  }
}

test("committed schema and migrations are in exact parity", () => {
  const { code, stdout } = runParity(path.join(REPO, "prisma"));
  assert.match(stdout, /schema models\s+: 32/);
  assert.match(stdout, /expected tables\s+: 33/);
  assert.match(stdout, /PARITY OK/);
  assert.equal(code, 0);
});

test("the schema covers all 32 models named in the production audit", () => {
  const { stdout } = runParity(path.join(REPO, "prisma"));
  for (const model of [
    "AdminOtpChallenge", "AgentMessage", "Campaign", "ContentOpportunityScore",
    "HookTest", "InkboxIntegration", "Lead", "LeadActivity", "Quotation", "QuotationItem",
  ]) {
    // these 10 were the reported-missing tables; their presence is now structural
    assert.ok(stdout.length > 0);
  }
  const schemaSrc = readSchema();
  for (const model of ["AdminOtpChallenge", "AgentMessage", "Campaign", "ContentOpportunityScore", "HookTest", "InkboxIntegration", "Lead", "LeadActivity", "Quotation", "QuotationItem"]) {
    assert.ok(new RegExp(`^model ${model} \\{`, "m").test(schemaSrc), `${model} must exist in schema`);
  }
});

function readSchema() {
  return execFileSync("cat", [path.join(REPO, "prisma", "schema.prisma")], { encoding: "utf8" });
}

test("tampering a column type is DETECTED (negative control)", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "alo-parity-neg-"));
  try {
    cpSync(path.join(REPO, "prisma"), tmp, { recursive: true });
    // VARCHAR→TEXT style tamper: remove one @db.Text attribute
    const schemaPath = path.join(tmp, "schema.prisma");
    let schema = readFileSyncStr(schemaPath);
    assert.ok(schema.includes("inputBrief  String? @db.Text") || schema.includes("inputBrief String? @db.Text"));
    schema = schema.replace(/inputBrief\s+String\?\s+@db\.Text/, "inputBrief  String?");
    writeFileSync(schemaPath, schema);
    const { code, stdout } = runParity(tmp);
    assert.notEqual(code, 0, "tampered schema must fail parity");
    assert.match(stdout, /AIAgentRun\.inputBrief/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("dropping a migration table is DETECTED (negative control)", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "alo-parity-neg2-"));
  try {
    cpSync(path.join(REPO, "prisma"), tmp, { recursive: true });
    // remove the AdminOtpChallenge migration (one of the 10 repaired tables)
    rmSync(path.join(tmp, "migrations", "20261010000001_admin_otp_challenges"), { recursive: true, force: true });
    const { code, stdout } = runParity(tmp);
    assert.notEqual(code, 0, "missing table must fail parity");
    assert.match(stdout, /AdminOtpChallenge.*MISSING/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a destructive migration statement is rejected outright", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "alo-parity-neg3-"));
  try {
    cpSync(path.join(REPO, "prisma"), tmp, { recursive: true });
    const evilDir = path.join(tmp, "migrations", "20261099000000_evil");
    mkdirSync(evilDir);
    writeFileSync(
      path.join(evilDir, "migration.sql"),
      "ALTER TABLE `Lead` DROP COLUMN `email`;\n",
    );
    const { code, stdout } = runParity(tmp);
    assert.notEqual(code, 0, "destructive migration must be rejected");
    assert.match(stdout, /destructive\/altering statement/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

function readFileSyncStr(p) {
  return execFileSync("cat", [p], { encoding: "utf8" });
}
