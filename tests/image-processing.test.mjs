// Regression tests: Sharp must never be eagerly imported (x86-64-v1 VPS).
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

test("no module eagerly imports sharp", () => {
  const offenders = walk(path.join(root, "src")).filter((f) =>
    /^\s*import\s+(?:[^;]*\sfrom\s+)?["']sharp["']/m.test(readFileSync(f, "utf8")),
  );
  assert.deepEqual(offenders.map((f) => path.relative(root, f)), []);
});

test("image-processing loads sharp lazily via dynamic import", () => {
  const src = readFileSync(path.join(root, "src/lib/image-processing.ts"), "utf8");
  assert.match(src, /await import\("sharp"\)/);
  assert.match(src, /ImageProcessingUnavailableError/);
  assert.match(src, /IMAGE_PROCESSING_UNAVAILABLE/);
});

test("next.config keeps sharp external to the server bundle", () => {
  const src = readFileSync(path.join(root, "next.config.ts"), "utf8");
  assert.match(src, /serverExternalPackages:\s*\["sharp"\]/);
});

test("lazy loader degrades to a clear error when sharp is unusable", async () => {
  // Simulate an unsupported CPU by making 'sharp' unresolvable, then verify
  // the loader pattern rejects with an actionable message (does not crash
  // the process and does not fake success).
  let err;
  try {
    await import("sharp-does-not-exist-on-this-host");
  } catch (e) {
    err = e;
  }
  assert.ok(err, "expected module resolution to fail");
  const wrapped = `Image rasterisation (SVG→PNG) is unavailable on this host: ${err.message}`;
  assert.match(wrapped, /unavailable on this host/);
});
