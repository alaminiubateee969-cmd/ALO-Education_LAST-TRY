# DEPLOYMENT RUNBOOK — ALO Learning Journey (production recovery release)

**Target:** physical Ubuntu 22.04 server (hosting.alolabs.net · tailnet `100.85.239.114`) · PM2 `learn-aloeducation` · port `3017` · MySQL `db_learn` · public domain `https://learn.aloeducation.com` (DNS pending).
**Release candidate:** the merge commit of the repair PR on `main` (exact SHA recorded by the pipeline; `scripts/deploy-production.sh` refuses anything ≠ `origin/main`).

> This runbook consolidates and **updates** `DEPLOYMENT.md` with the recovery-specific steps. Where the two differ, this file is authoritative for the recovery release.

---

## 0. Pre-deployment checklist (gates, in order)

| # | Gate | How to verify | Blocking? |
|---|---|---|---|
| 1 | Repair PR merged; CI green **including** `validate` and `migrations (isolated MySQL)` jobs | PR checks page — both jobs green | ✅ |
| 2 | Verified, **restore-tested** backup of `db_learn` exists | §1 below | ✅ |
| 3 | MySQL grants fixed (P1010 resolved) | `mysql … -e "SELECT 1"` with the app's own `DATABASE_URL` credentials | ✅ |
| 4 | Exposed DB credential rotated (pre-audit incident) | operator attestation + new `.env` on server | ✅ |
| 5 | Sharp CPU probe on the VPS | `node -e "require('sharp')('public/logo.svg').resize(64,64).png().then(()=>console.log('sharp OK'))"` inside the release dir | ✅ |
| 6 | On-server rollback dry-run | `bash scripts/test-deploy-rollback.sh` on the VPS | ✅ (one-time) |
| 7 | Migration pre-flight probes clean | `MIGRATION-RECOVERY-PLAN.md` §1 (read-only) | ✅ |
| 8 | GitHub `production` environment has required reviewers | Settings → Environments → production | ✅ |
| 9 | `VPS_DEPLOY_ENABLED` variable set to `true` | Settings → Secrets and variables → Actions → Variables | ✅ (switch; unset = deploy skipped) |

## 1. Take and restore-test a backup (operator, on the VPS)

```bash
TS=$(date -u +%Y%m%d-%H%M%S)
mysqldump -h 127.0.0.1 -u <user> -p --single-transaction --no-tablespaces db_learn \
  | gzip > ~/db_learn-predeploy-$TS.sql.gz
gzip -t ~/db_learn-predeploy-$TS.sql.gz && echo "integrity OK"
mysql -u root -p -e "CREATE DATABASE db_learn_restoretest;"
zcat ~/db_learn-predeploy-$TS.sql.gz | mysql -u root -p db_learn_restoretest
mysql -u root -p -e "SELECT COUNT(*) FROM db_learn_restoretest.Company;"
mysql -u root -p -e "DROP DATABASE db_learn_restoretest;"     # scratch only
```

The deploy script takes its own verified backup immediately before migrating; this manual one satisfies blocker #3 (a proven restore point *before* the pipeline starts).

## 2. Deploy (automated path)

1. Push/merge to `main` → `Deploy to VPS` workflow starts (`verify` → `network-preflight` → `deploy`).
2. Approve the run in the `production` environment when it pauses.
3. The pipeline then executes, in order (each step fails closed):

```
Tailscale join (ephemeral tag:github-runner node)
→ SSH (pinned host key, dedicated deploy key)
→ scripts/network-preflight.sh --tcp --ssh          (re-check)
→ scripts/deploy-production.sh (on the VPS):
     flock deploy lock
     git fetch; EXPECTED_SHA == origin/main (exact merged SHA only)
     materialise releases/<sha>/ via git archive
     npm ci → npx prisma generate
     mysqldump → gzip -t → content probe             (verified backup, 0600)
     npx prisma migrate status                       (informational — see §4)
     npx prisma migrate deploy                       (applies the 3 additive migrations;
                                                      refuses if any is marked failed)
     npm run build → .next/standalone/server.js required
     atomic symlink switch: current -> releases/<sha>
     pm2 startOrReload --only learn-aloeducation
     health gate: 30 × 2 s polls of 127.0.0.1:3017/api/health → 200
     on any failure after switch: ROLLBACK code to previous release
```

4. Post-deploy public check: `GET https://learn.aloeducation.com/api/health` (hard gate once `VPS_DOMAIN` is set; non-strict warning until DNS is live).

## 3. Manual verification after deploy

```bash
# On the VPS
pm2 status learn-aloeducation                 # online
cat /home/aloedu/projects/learn-aloeducation/current/RELEASE_SHA
curl -s http://127.0.0.1:3017/api/health      # 200 + JSON
npx prisma migrate status                     # all 3 applied, exit 0
mysql -u <user> -p db_learn -e "
  SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='db_learn';"   # 34
# From outside
curl -s https://learn.aloeducation.com/api/health   # once DNS/TLS live
curl -sI https://learn.aloeducation.com/ | head -1  # 200 or 3xx to /login
```

## 4. Change from previous runbook — `migrate status` gate

**Previous behavior:** `npx prisma migrate status || fail` aborted the deploy whenever migrations were pending — which is exactly the pre-recovery state, so the recovery deploy could never run.

**Now:** status is printed for evidence; a non-zero exit logs an explanation ("expected while unapplied migrations exist"). `prisma migrate deploy` remains the enforcing gate and **refuses to proceed if any migration is marked failed** in `_prisma_migrations`. Safety ordering is unchanged: the verified backup still runs first. (Regression-tested by `tests/deploy-script.test.mjs`.)

## 5. Rollback

**Automatic (code):** any post-switch failure (PM2 reload, health gate, SHA mismatch) re-points `current` to the previous release and reloads PM2. The database is deliberately never auto-reverted.

**Manual (code):**
```bash
cd /home/aloedu/projects/learn-aloeducation
PREV=$(ls -1dt releases/*/ | sed -n 2p)        # previous release dir
ln -sfn "$PWD/$PREV" current.tmp && mv -T current.tmp current
pm2 startOrReload current/ecosystem.config.js --only learn-aloeducation
```

**Manual (database)** — only if a migration itself misbehaves; all migrations are additive, so restoring the pre-deploy backup simply removes the new tables:
```bash
pm2 stop learn-aloeducation
mysql -u root -p -e "DROP DATABASE db_learn; CREATE DATABASE db_learn;"
zcat ~/db_learn-predeploy-<TS>.sql.gz | mysql -u root -p db_learn
pm2 startOrReload current/ecosystem.config.js --only learn-aloeducation
curl -s http://127.0.0.1:3017/api/health      # 200
```

## 6. GitHub configuration reference (unchanged, verified live)

- **Secrets:** `SERVER_HOST` (tailnet IP/`*.ts.net` — never public), `VPS_USER`, `VPS_SSH_KEY` (dedicated deploy keypair), `VPS_SSH_HOST_KEY` (ED25519 line), `VPS_PORT` (optional), `TAILSCALE_OAUTH_CLIENT_ID`/`TAILSCALE_OAUTH_SECRET` (scoped: `auth_keys:Write`, tag `tag:github-runner`).
- **Variables:** `VPS_APP_DIR=/home/aloedu/projects/learn-aloeducation`, `VPS_PM2_APP=learn-aloeducation`, `VPS_APP_PORT=3017`, `VPS_DOMAIN=https://learn.aloeducation.com` (set once DNS resolves), `VPS_DEPLOY_ENABLED=true` (only after §0 gates clear).
- **Environment:** `production` with required reviewers (verified present; workflow also fails closed if it can read the environment and finds none).
- **Known live issue (as of 2026-10-18):** the `network-preflight` job's Tailscale step fails with `sudo failed with exit code 1` from the pinned `tailscale/github-action@v4.2.0` on GitHub's current runner image — this is a **runner-side action incompatibility**, not a server outage. Resolution options: (a) update the pinned action to a newer release and re-run preflight-only mode (`workflow_dispatch` → `preflight-only`) to gather evidence without deploying; (b) verify tailnet reachability manually from any tailnet client. The deploy job remains safely skipped until this is green.

## 7. Network / public validation status (per `audit/07-NETWORKING-REPAIR-20261013.md` + live checks today)

| Layer | Status |
|---|---|
| Tailnet path (runner → VPS) | configured; preflight currently blocked by the action issue above (§6) |
| Nginx reverse proxy (80/443) on the VPS | config verified in-repo (`deploy/nginx/learn-aloeducation.conf`: TLS 1.2/1.3, HSTS, nosniff, DENY frames, ACME webroot) |
| TLS certificate issuance | operator action (certbot) — not verifiable from here |
| Public DNS for `learn.aloeducation.com` | unresolved at last audit; public health check stays non-strict until `VPS_DOMAIN` is set |
| Port 3017 (local app) | health-gated by the deploy script |

## 8. Post-recovery hygiene

1. Re-run `npx prisma migrate status` after the first successful deploy — must exit 0.
2. Keep `VPS_DEPLOY_ENABLED=true` only while deploys are intended; flip off during maintenance windows.
3. Rotate the deploy SSH keypair and Tailscale OAuth client if ever exposed.
4. Schedule the `sharp` major-version upgrade (see `SECURITY-AUDIT.md` §4) with an on-VPS CPU probe.
5. Once DNS is live, set `VPS_DOMAIN` so the public HTTPS check becomes a hard deployment gate.
