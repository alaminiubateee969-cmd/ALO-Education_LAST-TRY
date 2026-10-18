# SECURITY AUDIT — ALO Learning Journey

**Date:** 2026-10-18 · **Scope:** changes made in this repair session, re-verified against the full repository. Prior sessions' findings (`audit/05-EXPOSURE-REMEDIATION.md`, `audit/FINAL-REPORT-20261017.md` security sections) remain valid and are not repeated in full here.

---

## 1. Secrets handling — verified by execution

| Check | Method | Result |
|---|---|---|
| No credential material in tracked files | **NEW** `scripts/secret-scan.sh` (private keys, GitHub/OpenAI/AMS tokens, credential-bearing DB URLs with placeholder allow-list matched against the user:password portion only) | ✅ clean on the full tree; negative control (staged file with fake `mysql://realuser:…@`, `ghp_…`, `-----BEGIN RSA PRIVATE KEY-----`) correctly produces 3 findings and exit 1 |
| No `.env`, dumps, or backups tracked | `git ls-files` pattern scan | ✅ only `.env.example` (placeholders) |
| Audit docs contain no live credentials | targeted grep over `audit/`, root docs | ✅ only pattern *descriptions* (e.g. the documented scanner regexes) |
| Deploy/workflow files never echo secrets | review of `deploy.yml` + `deploy-production.sh` | ✅ `DATABASE_URL` parsed in-process into a 0600 temp env file, deleted on exit |

## 2. Authentication & session security — now regression-tested

| Property | Test evidence (`tests/auth-otp.test.mjs`, 15/15 pass) |
|---|---|
| Passwords: scrypt, 16-byte salt, 64-byte key, timing-safe compare | correct/wrong/case/malformed/too-short-hash/unconfigured cases — all behave |
| Hash format strictly `scrypt$<22 b64url>$<86 b64url>` | `isAdminAuthenticationConfigured` rejects wrong shapes |
| OTP: 6-digit, HMAC-SHA256 keyed by `NEXTAUTH_SECRET`, only hashes stored | stored `otpHash`/`phoneHash` proven to be sha256 hex with no embedded code |
| Single-use consumption (replay rejected) | ✅ |
| 5-attempt lockout | ✅ valid code rejected after 5 wrong attempts |
| 5-minute expiry | ✅ (backdated challenge rejected) |
| Resend rate limit (60 s window) | ✅ `AdminOtpRateLimitError` with bounded retry-after |
| Gateway failure → challenge invalidated (no orphan valid codes) | ✅ |
| Fail-closed production config: OTP required, `http://` gateway rejected in prod | ✅ |
| No user enumeration / no code leakage in API responses | queue result is `{status:"queued"}` — verified not to contain the code |

## 3. Database-layer safeguards added this session

| Safeguard | Mechanism |
|---|---|
| Destructive prisma commands blocked against production | `scripts/safe-prisma.mjs` wraps `db:push`/`db:migrate`/`db:reset`; refuses `db_learn` (configurable via `ALO_PROD_DB_NAMES`) and any non-loopback host; exit 78; explicit `ALO_ALLOW_DESTRUCTIVE_DB=1` override required (9 test cases) |
| Migrations can never carry destructive SQL | parity tool rejects `DROP`/`TRUNCATE`/`ALTER`/`DELETE`/`INSERT` inside migrations; `tests/deploy-script.test.mjs` re-checks all migration files |
| Schema↔database drift that could shrink columns | eliminated (58 `@db.Text`/`@db.LongText` restorations) + parity gate in CI + isolated-MySQL `migrate diff --exit-code` drift gate |
| Backup before any schema change | `deploy-production.sh`: `mysqldump` → `gzip -t` → content probe, **before** `migrate deploy` (ordering now regression-tested) |
| Deploy never auto-reverts the database | explicit design (rollback restores code only; DB restore is a documented manual procedure) |

## 4. Dependency vulnerabilities — measured, not fixed blindly

`npm audit` (lockfile as-is): 0 critical, 10 high, 4 moderate. All 10 high findings are in **dev/build-time** dependency chains, not runtime request paths:

| Chain | Vector | Assessment |
|---|---|---|
| `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob`/`braces`/`micromatch` | build-time pattern matching (DoS) | lint-only; not shipped in the standalone server bundle |
| `@mdxeditor/editor` → `js-yaml` | quadratic YAML parsing | editor is client-side; requires attacker-crafted YAML input through the authenticated admin UI |
| `prisma`/`@prisma/config` → `deepmerge-ts` | stack exhaustion merging recursive graphs | CLI/generate-time only |
| `sharp` ≤ 0.35.5 | libvips/libheif CVEs (image decoding) | **runtime-relevant**: malicious uploaded images processed by sharp could trigger decoder bugs. Mitigations: uploads are admin-authenticated single-user; sharp version is pinned by the lockfile; upgrading is a major-version bump that must be CPU-probed on the VPS first (blocker #4 in `DEPLOYMENT.md`). Recommend scheduling a controlled `sharp@0.35.5` upgrade during the post-recovery window, *after* the VPS Sharp CPU check. |

No patch was applied in this session because every available fix is semver-major (would change the runtime bundle) and the master rules forbid unverified production changes; the finding is recorded here for a deliberate follow-up.

## 5. CI/CD security posture

| Item | Status |
|---|---|
| Workflow permissions minimal (`contents: read`) | ✅ all three workflows |
| Third-party actions pinned by commit SHA | ✅ (`actions/checkout@v5`, `setup-node@v5`, `tailscale/github-action@d1b6cd2…` # v4.2.0, `DataDog/synthetics-ci-github-action@87b5053…`) |
| SSH: strict host-key checking ON, pinned host key from secret, key material only | ✅ unchanged |
| Deploy authorization: `VPS_DEPLOY_ENABLED` readiness switch **unset** + `production` environment approval (verified configured, no reviewers bypassing) | ✅ deploy job currently skipped by design |
| New `migrations` CI job touches only an ephemeral MySQL service container (`ci_migrate` on the runner), never production | ✅ |
| Datadog workflow no longer fails-open on missing secrets | ✅ gated on secret presence |

## 6. Residual risks / recommendations

1. **`sharp` CVEs** — schedule the major-version upgrade with an on-VPS CPU probe (see §4).
2. **Previously exposed database credential** (pre-audit incident) — rotation remains blocker #2 in `DEPLOYMENT.md`; must stay unmerged-blocking until rotated.
3. **Single-admin model** — no multi-user RBAC by design; acceptable for the current deployment, documented in `.env.example`.
4. **OTP SMS delivery provider** — fail-closed until a real HTTPSMS key is configured; no code change needed.
