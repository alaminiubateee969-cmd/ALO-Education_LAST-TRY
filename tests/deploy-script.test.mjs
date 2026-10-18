// Deploy-script safety invariants (static regression tests).
// These encode the deployment guarantees the recovery plan depends on:
// additive-only migrations, verified backup BEFORE any schema change,
// exact-SHA pinning, atomic switch with rollback, and no destructive prisma
// commands anywhere in the deploy path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const REPO = path.join(import.meta.dirname, "..");
const deploy = readFileSync(path.join(REPO, "scripts", "deploy-production.sh"), "utf8");

test("deploy runs a verified mysqldump backup BEFORE prisma touches the schema", () => {
  const backupIdx = deploy.indexOf("mysqldump");
  const integrityIdx = deploy.indexOf("gzip -t");
  const migrateIdx = deploy.search(/prisma migrate deploy/);
  assert.ok(backupIdx > -1, "mysqldump step present");
  assert.ok(integrityIdx > -1, "gzip integrity test present");
  assert.ok(migrateIdx > -1, "migrate deploy step present");
  assert.ok(backupIdx < migrateIdx, "backup precedes migrate deploy");
  assert.ok(integrityIdx < migrateIdx, "integrity check precedes migrate deploy");
  assert.match(deploy, /content probe failed/, "backup content is probed");
});

test("migrate deploy failure leaves the live release and DB untouched", () => {
  assert.match(deploy, /migrate deploy failed; live release untouched/);
});

test("deploy NEVER uses destructive prisma commands", () => {
  assert.doesNotMatch(deploy, /prisma migrate dev/, "no migrate dev");
  assert.doesNotMatch(deploy, /prisma migrate reset/, "no migrate reset");
  assert.doesNotMatch(deploy, /prisma db push/, "no db push");
  assert.doesNotMatch(deploy, /db:reset/, "no db:reset npm script");
});

test("migrate status is informational — pending migrations must not deadlock the first deploy", () => {
  // Regression: `npx prisma migrate status || fail` exits non-zero whenever
  // migrations are pending (exactly the production state this repair fixes),
  // which blocked every deploy BEFORE migrate deploy could run.
  assert.doesNotMatch(deploy, /migrate status \|\| fail/);
  const statusLine = deploy.split("\n").find((l) => l.includes("prisma migrate status"));
  assert.ok(statusLine, "migrate status still reported for evidence");
  assert.match(statusLine, /\|\| log /, "status failures are logged, not fatal");
});

test("only the exact merged main SHA can deploy", () => {
  assert.match(deploy, /EXPECTED_SHA != origin\/main — only merged main commits deploy/);
  assert.match(deploy, /cat-file -e/);
  assert.match(deploy, /RELEASE_SHA/);
});

test("atomic release switch with rollback exists", () => {
  assert.match(deploy, /mv -T "\$CURRENT_LINK\.tmp" "\$CURRENT_LINK"/);
  assert.match(deploy, /rollback\(\)/);
  assert.match(deploy, /current -> \$PREV_TARGET/);
  assert.match(deploy, /database NOT auto-reverted/, "DB is deliberately not auto-reverted");
});

test("health gate checks the local port before declaring success", () => {
  assert.match(deploy, /127\.0\.0\.1:\$\{APP_PORT\}\/api\/health/);
  assert.match(deploy, /health check failed — rolled back/);
});

test("deploy refuses to run without the shared .env and Node 22", () => {
  assert.match(deploy, /shared \.env missing/);
  assert.match(deploy, /expected Node 22/);
});

test("migrations themselves contain only additive CREATE TABLE statements", () => {
  const dir = path.join(REPO, "prisma", "migrations");
  for (const m of readdirSync(dir)) {
    const sqlPath = path.join(dir, m, "migration.sql");
    let sql = "";
    try {
      sql = readFileSync(sqlPath, "utf8");
    } catch {
      continue; // migration_lock.toml etc.
    }
    assert.doesNotMatch(sql, /\bDROP\b/i, `${m} must not DROP`);
    assert.doesNotMatch(sql, /\bTRUNCATE\b/i, `${m} must not TRUNCATE`);
    assert.doesNotMatch(sql, /\bALTER\s+TABLE\b/i, `${m} must not ALTER`);
    assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i, `${m} must not DELETE`);
    assert.doesNotMatch(sql, /\bINSERT\s+INTO\b/i, `${m} must not INSERT`);
    assert.doesNotMatch(sql, /db_learn/, `${m} must not name the production database`);
  }
});

test("the baseline uses CREATE TABLE IF NOT EXISTS (safe against pre-existing tables)", () => {
  const baseline = readFileSync(
    path.join(REPO, "prisma", "migrations", "20261001000000_initial_baseline", "migration.sql"),
    "utf8",
  );
  const creates = baseline.match(/CREATE TABLE/g) ?? [];
  const safeCreates = baseline.match(/CREATE TABLE IF NOT EXISTS/g) ?? [];
  assert.ok(creates.length > 0);
  assert.equal(creates.length, safeCreates.length, "every baseline CREATE must be IF NOT EXISTS");
});
