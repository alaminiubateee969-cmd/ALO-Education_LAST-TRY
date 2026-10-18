// Test bootstrap: make selected TypeScript modules from src/lib importable
// under plain `node --test` (no bundler) using Node 22 type stripping.
//
// Strategy: copy the import graph of the entry module into a temp directory,
// rewriting "@/lib/X" → "./X.ts" and extension-less relative imports to
// explicit ".ts" specifiers (required by --experimental-strip-types).
// Only modules actually imported by the entry are copied, so heavyweight
// optional integrations (ai.ts, local-models.ts, …) never load.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, "..", "..");
const SRC_ROOT = path.join(REPO_ROOT, "src");

const IGNORED_IMPORTS = new Set(["server-only"]);

export function compileTsGraph(entryRel, outDir) {
  const copied = new Map(); // rel path (no ext) -> abs out path
  const queue = [entryRel];
  while (queue.length) {
    const rel = queue.shift();
    if (copied.has(rel)) continue;
    const srcFile = path.join(SRC_ROOT, rel + ".ts");
    let code = readFileSync(srcFile, "utf8");

    // rewrite import/export specifiers
    const specRegex = /(from\s*|import\s*\(\s*|import\s+)(["'])([^"']+)\2/g;
    const deps = new Set();
    code = code.replace(specRegex, (full, prefix, quote, spec) => {
      if (IGNORED_IMPORTS.has(spec)) return full;
      let target = null;
      if (spec.startsWith("@/lib/")) {
        target = "lib/" + spec.slice("@/lib/".length);
      } else if (spec.startsWith("./") || spec.startsWith("../")) {
        const base = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
        target = base;
      } else {
        return full; // package import (node:crypto, zod, @prisma/client …)
      }
      deps.add(target);
      // rewrite to a relative specifier with an explicit .ts extension
      const fromDir = path.posix.dirname(rel);
      let outSpec = path.posix.relative(fromDir, target);
      if (!outSpec.startsWith(".")) outSpec = "./" + outSpec;
      if (!/\.(ts|tsx|mjs|js)$/.test(outSpec)) outSpec += ".ts";
      return `${prefix}${quote}${outSpec}${quote}`;
    });

    const outPath = path.join(outDir, rel + ".ts");
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, code);
    copied.set(rel, outPath);
    for (const dep of deps) queue.push(dep);
  }
  return copied.get(entryRel);
}

export { readdirSync };
