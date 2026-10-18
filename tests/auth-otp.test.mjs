// Authentication & admin OTP integration tests (engine-free).
//
// Runs the REAL modules (src/lib/auth.ts, src/lib/auth-config.ts,
// src/lib/admin-otp.ts) against the local JSON fallback store, with a local
// HTTP mock standing in for the SMS gateway. Verifies: scrypt password
// verification, auth configuration gating, OTP queue→deliver→consume happy
// path, replay rejection, attempt lockout, expiry, resend rate limit, and
// gateway-failure invalidation.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { randomBytes, scryptSync } from "node:crypto";
import { compileTsGraph } from "./helpers/compile-ts.mjs";

const REPO = path.join(import.meta.dirname, "..");

// ── isolated cwd so the fallback store never touches the real storage/ ────
const tmpCwd = mkdtempSync(path.join(os.tmpdir(), "alo-auth-otp-"));
process.chdir(tmpCwd);

const buildDir = path.join(REPO, ".tmp-tests", "auth-otp");
const authEntry = compileTsGraph("lib/auth", buildDir);
const otpEntry = compileTsGraph("lib/admin-otp", buildDir);
const dbEntry = compileTsGraph("lib/db", buildDir);

const { verifyAdminCredentials, isAdminAuthConfigured } = await import(authEntry);
const { queueAdminOtp, consumeAdminOtp, AdminOtpRateLimitError } = await import(otpEntry);
const { db } = await import(dbEntry);

// ── mock SMS gateway ───────────────────────────────────────────────────────
const gateway = {
  requests: [],
  failNext: false,
  server: null,
  port: 0,
};

before(async () => {
  gateway.server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let parsed = {};
      try {
        parsed = JSON.parse(body);
      } catch {}
      gateway.requests.push({ url: req.url, apiKey: req.headers["x-api-key"], body: parsed });
      if (gateway.failNext) {
        gateway.failNext = false;
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end("{}");
        return;
      }
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise((resolve) => gateway.server.listen(0, "127.0.0.1", resolve));
  gateway.port = gateway.server.address().port;

  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = ""; // force the deterministic local fallback
  process.env.NEXTAUTH_SECRET = "test-secret-for-otp-signing-only";
  process.env.ADMIN_OTP_PHONE = "+8801711111111";
  process.env.HTTPSMS_FROM = "+8801722222222";
  process.env.HTTPSMS_API_KEY = "test-api-key";
  process.env.HTTPSMS_BASE_URL = `http://127.0.0.1:${gateway.port}`;
});

after(async () => {
  await new Promise((resolve) => gateway.server.close(resolve));
  try {
    rmSync(tmpCwd, { recursive: true, force: true });
  } catch {}
});

// ── helpers ────────────────────────────────────────────────────────────────
function makeScryptHash(password, bytes = 64) {
  // mirrors scripts/hash-admin-password.mjs: 16-byte salt, 64-byte scrypt hash
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, bytes);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function lastDeliveredCode() {
  const last = gateway.requests[gateway.requests.length - 1];
  const m = last?.body?.content?.match(/code: (\d{6})\./);
  return m ? m[1] : null;
}

async function clearChallenges() {
  await db.adminOtpChallenge.deleteMany({});
  gateway.requests.length = 0;
}

// ── password authentication (scrypt) ──────────────────────────────────────

test("verifyAdminCredentials accepts the correct email+password", () => {
  process.env.ADMIN_EMAIL = "admin@example.com";
  process.env.ADMIN_PASSWORD_HASH = makeScryptHash("correct horse battery staple");
  assert.equal(verifyAdminCredentials("admin@example.com", "correct horse battery staple"), true);
});

test("verifyAdminCredentials rejects a wrong password", () => {
  process.env.ADMIN_PASSWORD_HASH = makeScryptHash("correct horse battery staple");
  assert.equal(verifyAdminCredentials("admin@example.com", "wrong password"), false);
});

test("verifyAdminCredentials is case-insensitive on the email only", () => {
  process.env.ADMIN_PASSWORD_HASH = makeScryptHash("pw-1234567890");
  assert.equal(verifyAdminCredentials("ADMIN@example.com", "pw-1234567890"), true);
  assert.equal(verifyAdminCredentials("admin@Example.com", "pw-1234567890"), true);
  assert.equal(verifyAdminCredentials("other@example.com", "pw-1234567890"), false);
});

test("verifyAdminCredentials rejects malformed hash material", () => {
  process.env.ADMIN_EMAIL = "admin@example.com";
  process.env.ADMIN_PASSWORD_HASH = "plaintext-not-a-hash";
  assert.equal(verifyAdminCredentials("admin@example.com", "plaintext-not-a-hash"), false);
  process.env.ADMIN_PASSWORD_HASH = "bcrypt$abc$def"; // wrong algorithm label
  assert.equal(verifyAdminCredentials("admin@example.com", "x"), false);
  process.env.ADMIN_PASSWORD_HASH = makeScryptHash("x", 8); // too-short hash body
  assert.equal(verifyAdminCredentials("admin@example.com", "x"), false);
});

test("verifyAdminCredentials fails closed when unconfigured", () => {
  const savedEmail = process.env.ADMIN_EMAIL;
  const savedHash = process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD_HASH;
  assert.equal(verifyAdminCredentials("admin@example.com", "whatever"), false);
  process.env.ADMIN_EMAIL = savedEmail;
  process.env.ADMIN_PASSWORD_HASH = savedHash;
});

// ── authentication configuration gating ───────────────────────────────────

test("isAdminAuthConfigured requires the exact scrypt hash format", () => {
  const saved = { secret: process.env.NEXTAUTH_SECRET, email: process.env.ADMIN_EMAIL, hash: process.env.ADMIN_PASSWORD_HASH };
  process.env.NEXTAUTH_SECRET = "x".repeat(32);
  process.env.ADMIN_EMAIL = "admin@example.com";
  process.env.ADMIN_PASSWORD_HASH = makeScryptHash("some-valid-password-1");
  assert.equal(isAdminAuthConfigured(), true);
  process.env.ADMIN_PASSWORD_HASH = "scrypt$short$hash"; // wrong shape
  assert.equal(isAdminAuthConfigured(), false);
  for (const k of Object.keys(saved)) process.env[k] = saved[k];
});

test("production requires OTP delivery to be configured (fail closed)", async () => {
  const { isAdminOtpRequired } = await import(otpEntry.replace(/admin-otp\.ts$/, "auth-config.ts"));
  const savedNodeEnv = process.env.NODE_ENV;
  const savedBase = process.env.HTTPSMS_BASE_URL;
  process.env.NODE_ENV = "production";
  assert.equal(isAdminOtpRequired(), true);
  // http:// gateway is rejected in production (must be https)
  process.env.HTTPSMS_BASE_URL = `http://127.0.0.1:${gateway.port}`;
  const { isAdminOtpDeliveryConfigured } = await import(otpEntry.replace(/admin-otp\.ts$/, "auth-config.ts"));
  assert.equal(isAdminOtpDeliveryConfigured(), false);
  process.env.NODE_ENV = savedNodeEnv;
  process.env.HTTPSMS_BASE_URL = savedBase;
});

// ── OTP lifecycle ─────────────────────────────────────────────────────────

test("queueAdminOtp queues a code to the gateway without exposing it", async () => {
  await clearChallenges();
  const result = await queueAdminOtp();
  assert.deepEqual(result, { status: "queued" });
  assert.equal(gateway.requests.length, 1);
  assert.equal(gateway.requests[0].url, "/v1/messages/send");
  assert.equal(gateway.requests[0].apiKey, "test-api-key");
  assert.equal(gateway.requests[0].body.to, "+8801711111111");
  const code = lastDeliveredCode();
  assert.match(code ?? "", /^\d{6}$/);
  // the API result must never contain the code itself
  assert.equal(JSON.stringify(result).includes(code), false);
});

test("a delivered OTP consumes exactly once (replay rejected)", async () => {
  await clearChallenges();
  await queueAdminOtp();
  const code = lastDeliveredCode();
  assert.equal(await consumeAdminOtp(code), true, "first use must succeed");
  assert.equal(await consumeAdminOtp(code), false, "replay must fail");
});

test("five wrong attempts lock out the challenge", async () => {
  await clearChallenges();
  await queueAdminOtp();
  const code = lastDeliveredCode();
  for (let i = 0; i < 5; i++) {
    const wrong = code === "000000" ? "000001" : "000000";
    assert.equal(await consumeAdminOtp(wrong), false, `wrong attempt ${i + 1}`);
  }
  assert.equal(await consumeAdminOtp(code), false, "valid code must be rejected after lockout");
});

test("expired OTP is rejected", async () => {
  await clearChallenges();
  await queueAdminOtp();
  const code = lastDeliveredCode();
  const rows = await db.adminOtpChallenge.findMany({});
  assert.equal(rows.length, 1);
  await db.adminOtpChallenge.update({
    where: { id: rows[0].id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(await consumeAdminOtp(code), false);
});

test("malformed codes never reach the store", async () => {
  await clearChallenges();
  await queueAdminOtp();
  assert.equal(await consumeAdminOtp("12345"), false);
  assert.equal(await consumeAdminOtp("1234567"), false);
  assert.equal(await consumeAdminOtp("abcdef"), false);
  assert.equal(await consumeAdminOtp(""), false);
});

test("resend within the 60s window is rate limited", async () => {
  await clearChallenges();
  await queueAdminOtp();
  await assert.rejects(() => queueAdminOtp(), (err) => {
    assert.ok(err instanceof AdminOtpRateLimitError);
    assert.ok(err.retryAfterSeconds > 0 && err.retryAfterSeconds <= 60);
    return true;
  });
});

test("gateway failure invalidates the challenge and surfaces an error", async () => {
  await clearChallenges();
  gateway.failNext = true;
  await assert.rejects(() => queueAdminOtp(), /SMS gateway did not accept the OTP request/);
  const rows = await db.adminOtpChallenge.findMany({});
  assert.equal(rows.length, 1);
  assert.ok(rows[0].consumedAt, "challenge must be invalidated when delivery fails");
  // and the invalidated challenge must not verify
  const code = lastDeliveredCode(); // body was still sent to the failing gateway
  if (code) assert.equal(await consumeAdminOtp(code), false);
});

test("only a keyed HMAC of the OTP is stored (never plaintext)", async () => {
  await clearChallenges();
  await queueAdminOtp();
  const code = lastDeliveredCode();
  const rows = await db.adminOtpChallenge.findMany({});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].otpHash.includes(code), false, "stored hash must not contain the code");
  assert.match(rows[0].otpHash, /^[0-9a-f]{64}$/, "sha256 hex hmac");
  assert.match(rows[0].phoneHash, /^[0-9a-f]{64}$/, "phone is stored hashed");
});
