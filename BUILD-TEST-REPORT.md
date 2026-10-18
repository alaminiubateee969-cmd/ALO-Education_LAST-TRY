# BUILD & TEST REPORT — ALO Learning Journey

**Date:** 2026-10-18 · **Environment:** Node v22.22.3, npm 10.9.8, Ubuntu (sandbox). `npm ci` from `package-lock.json` (860 packages).

> **Sandbox limitation (honest disclosure):** this environment blocks `binaries.prisma.sh`, so Prisma engine binaries cannot be downloaded. Prisma commands were run with `prisma generate --no-engine` plus stubbed engine paths (`PRISMA_SCHEMA_ENGINE_BINARY` etc.), the technique already documented in `audit/FINAL-REPORT-20261017.md`. On the VPS and GitHub runners (both of which can reach the CDN) the normal `npx prisma generate` / `migrate deploy` paths apply — the new CI `migrations` job proves the full engine-dependent chain on a real MySQL 8 container on every run.

---

## 1. Check results (all executed in this session, post-change)

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Dependency install | `npm ci` | ✅ 0 errors (14 audit findings — see `SECURITY-AUDIT.md` §4) |
| 2 | Prisma validate | `npx prisma validate` | ✅ "The schema at prisma/schema.prisma is valid 🚀" |
| 3 | Prisma generate | `npx prisma generate --no-engine` | ✅ client v6.19.3 generated |
| 4 | **Schema↔migration parity (new)** | `node scripts/verify-migration-parity.mjs` | ✅ "PARITY OK — schema and migrations describe the identical database." (32 models / 33 tables / 3 migrations / 548 SQL lines) |
| 5 | Lint | `npm run lint` (`eslint .`) | ✅ 0 errors, 0 warnings |
| 6 | Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ exit 0 |
| 7 | Secret scan (new) | `bash scripts/secret-scan.sh` | ✅ clean (negative control: 3/3 planted findings detected) |
| 8 | **All tests (new + existing)** | `npm test` → `node --test tests/*.test.mjs` | ✅ **68/68 pass, 0 fail** (details §2) |
| 9 | Deploy/rollback script suite | `bash scripts/test-deploy-rollback.sh` | ✅ PASS (atomic switch + rollback + syntax) |
| 10 | Production build | `npm run build` (next build, standalone output) | ✅ exit 0, 46 routes compiled, `.next/standalone/server.js` produced |

## 2. Test inventory (68 cases)

| Suite | File | Cases | Coverage |
|---|---|---|---|
| Sharp lazy-loading regression (pre-existing) | `tests/image-processing.test.mjs` | 4 | no eager sharp import; graceful degradation on unsupported CPU |
| **Auth & admin OTP (new)** | `tests/auth-otp.test.mjs` | 15 | scrypt verify (5 cases), config gating (2), OTP lifecycle (queue/deliver/consume/replay/lockout/expiry/malformed/rate-limit/gateway-failure/no-plaintext) (8) |
| **CRM validation (new)** | `tests/crm-validation.test.mjs` | 12 | lead create/update schemas, consent invariants, enum rejection, defaults, normalization; quotation items/currency/quantity/status |
| **Local fallback store (new)** | `tests/local-db-fallback.test.mjs` | 13 | CRUD operators (gt/gte/lt/lte/contains/in/null), orderBy/take, guarded updateMany, **P2002 unique enforcement (new behavior)**, **cascade deleteMany (new behavior)**, persistence roundtrip, `$transaction` |
| **DB parity (new)** | `tests/db-parity.test.mjs` | 5 | positive parity (32/33 counts), 10 repaired tables present in schema, 3 negative controls (tampered type, dropped migration, destructive statement) |
| **safe-prisma guard (new)** | `tests/safe-prisma.test.mjs` | 9 | block `db_learn` (3 commands), block remote host, override, local allow, never-block safe commands, custom prod names, real exit code 78 |
| **Deploy invariants (new)** | `tests/deploy-script.test.mjs` | 10 | backup-before-migration ordering, no destructive prisma in deploy, `migrate status` no longer deadlocks, exact-SHA pinning, atomic switch + rollback, health gate, Node-22/.env gates, additive-only migrations, `IF NOT EXISTS` baseline |

Infrastructure: `tests/helpers/compile-ts.mjs` compiles the real `src/lib` TypeScript modules (import-graph copy with alias/extension rewriting) so tests execute **the actual production code** under `node --test` — no mocks of application logic; only the SMS gateway is a local HTTP stand-in, and the DB runs on the real local fallback store.

## 3. What CI additionally proves (cannot run in this sandbox)

The new `migrations` job (`.github/workflows/ci.yml`) runs on every PR/push with a real MySQL 8 service container:

1. `npx prisma migrate deploy` succeeds from an empty database (real engines, real DDL);
2. exactly 33 tables + 3 applied migrations result (asserted via `information_schema`);
3. `npx prisma migrate diff --from-url … --to-schema-datamodel prisma/schema.prisma --exit-code` proves the applied schema is **identical** to `schema.prisma`;
4. a second `migrate deploy` is a no-op (deployment-level idempotence).

## 4. Fixes required to reach green (this session)

| Symptom | Root cause | Fix |
|---|---|---|
| (pre-existing) 58 parity differences | schema had dropped `@db.Text`/`@db.LongText` | attributes restored → parity OK |
| `node --test tests/` failed | Node 22.22 needs a glob, not a bare directory | `node --test tests/*.test.mjs` (package.json + CI) |
| TS "parameter property not supported in strip-only mode" | `AdminOtpRateLimitError` used `constructor(readonly …)` | explicit field assignment |
| secret-scan false negatives during hardening | allow-list matched hostnames (`example` in `db.example.com`) | allow-list now matched against the URL's user:password portion only |

## 5. Scripts that do not exist (reported, not claimed)

Per the master rules: there is **no** `npm run e2e`, `npm run test:integration`, or coverage tooling in this repository; nothing of the sort is claimed. The `test:sharp` script is a thin alias for the Sharp suite. `shellcheck` is not installed in this sandbox — shell scripts were validated with `bash -n` (the rollback suite notes this explicitly).
