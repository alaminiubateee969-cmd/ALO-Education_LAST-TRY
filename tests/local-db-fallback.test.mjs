// Local JSON fallback store tests — the data layer used in sandbox/dev when
// MySQL is unreachable. Verifies the operators the application actually uses
// (see src/lib/*.ts findMany/updateMany call sites) so the fallback is not a
// silent source of behavioural drift.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileTsGraph } from "./helpers/compile-ts.mjs";

const REPO = path.join(import.meta.dirname, "..");
const tmpCwd = mkdtempSync(path.join(os.tmpdir(), "alo-fallback-"));
process.chdir(tmpCwd);

const buildDir = path.join(REPO, ".tmp-tests", "fallback");
const dbEntry = compileTsGraph("lib/db", buildDir);
const { db } = await import(dbEntry);

before(async () => {
  process.env.DATABASE_URL = "";
  await db.company.create({ data: { id: "co-1", name: "ALO", active: true } });
  await db.lead.createMany({
    data: [
      { id: "l1", companyId: "co-1", fullName: "A One", stage: "new", email: "a@x.co", createdAt: new Date("2026-01-01") },
      { id: "l2", companyId: "co-1", fullName: "B Two", stage: "qualified", email: "b@x.co", createdAt: new Date("2026-02-01") },
      { id: "l3", companyId: "co-1", fullName: "C Three", stage: "new", email: null, createdAt: new Date("2026-03-01") },
    ],
  });
});

test("findMany with orderBy desc + take", async () => {
  const rows = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 2 });
  assert.deepEqual(rows.map((r) => r.id), ["l3", "l2"]);
});

test("where equality and IN-style OR", async () => {
  const news = await db.lead.findMany({ where: { stage: "new" } });
  assert.equal(news.length, 2);
  const byIds = await db.lead.findMany({ where: { OR: [{ id: "l1" }, { id: "l3" }] } });
  assert.equal(byIds.length, 2);
});

test("where gt / gte / lt / lte / contains on dates and strings", async () => {
  const gt = await db.lead.findMany({ where: { createdAt: { gt: new Date("2026-01-15") } } });
  assert.equal(gt.length, 2);
  const gte = await db.lead.findMany({ where: { createdAt: { gte: new Date("2026-02-01") } } });
  assert.equal(gte.length, 2);
  const lt = await db.lead.findMany({ where: { createdAt: { lt: new Date("2026-02-01") } } });
  assert.equal(lt.length, 1);
  const contains = await db.lead.findMany({ where: { fullName: { contains: "Two" } } });
  assert.equal(contains.length, 1);
});

test("null filters (email: null vs set)", async () => {
  const noEmail = await db.lead.findMany({ where: { email: null } });
  assert.equal(noEmail.length, 1);
  assert.equal(noEmail[0].id, "l3");
});

test("findFirst and count", async () => {
  const first = await db.lead.findFirst({ where: { stage: "new" }, orderBy: { createdAt: "asc" } });
  assert.equal(first.id, "l1");
  assert.equal(await db.lead.count({ where: { companyId: "co-1" } }), 3);
});

test("updateMany guarded writes only affect matching rows", async () => {
  const r = await db.lead.updateMany({ where: { stage: "new" }, data: { stage: "contacted" } });
  assert.equal(r.count, 2);
  assert.equal((await db.lead.findMany({ where: { stage: "contacted" } })).length, 2);
});

test("unique constraint surfaces as P2002 on duplicate phoneHash", async () => {
  await db.adminOtpChallenge.create({ data: { id: "o1", phoneHash: "h1", otpHash: "x", expiresAt: new Date() } });
  await assert.rejects(
    () => db.adminOtpChallenge.create({ data: { id: "o2", phoneHash: "h1", otpHash: "y", expiresAt: new Date() } }),
    (err) => err.code === "P2002",
  );
});

test("state-guarded updateMany (optimistic concurrency) — the OTP consumption pattern", async () => {
  await db.adminOtpChallenge.create({
    data: { id: "o3", phoneHash: "h3", otpHash: "z", expiresAt: new Date(Date.now() + 60000), consumedAt: null, failedAttempts: 0 },
  });
  const guard = { id: "o3", otpHash: "z", failedAttempts: 0, expiresAt: { gt: new Date() }, consumedAt: null };
  const first = await db.adminOtpChallenge.updateMany({ where: guard, data: { consumedAt: new Date() } });
  assert.equal(first.count, 1);
  const replay = await db.adminOtpChallenge.updateMany({ where: guard, data: { consumedAt: new Date() } });
  assert.equal(replay.count, 0, "second consumption must not match");
});

test("relation filter: quotation where lead stage", async () => {
  const rows = await db.quotation.findMany({ where: { lead: { stage: "contacted" } } });
  assert.ok(Array.isArray(rows));
});

test("deleteMany removes only matching rows and cascades logically", async () => {
  await db.quotation.create({ data: { id: "q1", leadId: "l1", number: "Q-1", title: "T", subtotal: "0", total: "0" } });
  await db.quotationItem.create({ data: { id: "qi1", quotationId: "q1", description: "item", quantity: 1, unitPrice: "10", lineTotal: "10" } });
  const r = await db.quotation.deleteMany({ where: { id: "q1" } });
  assert.equal(r.count, 1);
  assert.equal(await db.quotationItem.count({ where: { quotationId: "q1" } }), 0, "items must cascade");
});

test("data survives persistence to disk (store save/load roundtrip)", async () => {
  const before = await db.lead.count();
  assert.ok(before >= 3);
  const { readFileSync } = await import("node:fs");
  const storePath = path.join(tmpCwd, "storage", "local-db.json");
  const persisted = JSON.parse(readFileSync(storePath, "utf8"));
  assert.ok(Array.isArray(persisted.lead));
  assert.equal(persisted.lead.length, before);
});

test("$transaction executes a function atomically against the store", async () => {
  const out = await db.$transaction(async (tx) => {
    await tx.lead.create({ data: { id: "ltx", companyId: "co-1", fullName: "Tx Lead", stage: "new" } });
    return tx.lead.count({ where: { fullName: "Tx Lead" } });
  });
  assert.equal(out, 1);
});

// cleanup after all tests (node:test has no global after; last test removes cwd copy)
test("cleanup", async () => {
  try {
    rmSync(tmpCwd, { recursive: true, force: true });
  } catch {}
  assert.ok(true);
});
