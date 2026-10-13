# ALO Learning Journey — Deployment and Verification

> **Pipeline status: NETWORKING REPAIR IMPLEMENTED — production deployment
> BLOCKED by design until the §Deployment blockers are cleared.**
> The workflows and deploy scripts implement
> `feature branch → PR (CI must pass) → merge to main → Tailscale network
> preflight → production approval → deploy of the exact merged SHA → health
> checks`. This application runs on a **self-hosted physical Ubuntu server**
> (hosting.alolabs.net · LAN 192.168.0.24 · tailnet 100.85.239.114) behind a
> NAT router — **not a rented VPS, not Hostinger** — with **no directly
> reachable public IP**. GitHub Actions reaches it exclusively over the
> tailnet. Nothing in this file claims a live production deploy has been
> verified; see `audit/07-NETWORKING-REPAIR-20261013.md` for the per-item
> PASS/FAIL/UNVERIFIED matrix.

## Verified server configuration (operator-supplied, audit 2026-10-13)

| Component | Verified configuration |
|---|---|
| Host | `hosting.alolabs.net` · Ubuntu 22.04.5 · LAN `192.168.0.24` · tailnet `100.85.239.114` · SSH `aloedu@:22` |
| Application (PM2 name) | `learn-aloeducation` |
| Project directory | `/home/aloedu/projects/learn-aloeducation` |
| Source directory | `/home/aloedu/alo-learning-source` |
| Runtime | Node.js `22.23.3` |
| Package manager | npm `10.9.9` (`package-lock.json` is the canonical lockfile; **never use Bun on this CPU** — it core-dumps) |
| Process manager | PM2 `7.0.4` (`ecosystem.config.js`) |
| Application port | `3017` (Next.js standalone) |
| Reverse proxy | Nginx on 80/443 (`deploy/nginx/learn-aloeducation.conf`) |
| Database | MySQL 8.0.46, local to the server |
| Firewall | UFW active; SSH reachable via tailscale interface; no public SSH exposure |
| Public site | `https://learn.aloeducation.com` (DNS unresolved at audit time — set `VPS_DOMAIN` when it resolves) |

## The pipeline

```
AI Builder ──► GitHub feature branch ──► Pull Request ──► CI "validate" PASS
                                                             │
                                       reviewed merge to main (exact SHA)
                                                             │
       Deploy to VPS workflow ◄──────────────────────────────┘
         1. verify            = same CI workflow (reusable)
         2. network-preflight = Tailscale join (ephemeral tag:github-runner)
                                → ping 100.85.239.114 → TCP 22 → SSH auth probe
                                (READ-ONLY: never deploys, never touches the app)
         3. deploy            = ONLY IF: preflight green + VPS_DEPLOY_ENABLED=true
                                + human approval in the `production` environment
                                → SSH (pinned host key) runs scripts/deploy-production.sh
                                at the EXACT merged SHA:
                                lock → fetch SHA (must equal origin/main)
                                → mysqldump backup (gz + content verified, gate)
                                → npm ci → prisma generate → migrate deploy
                                → build (CPU-safe) → atomic PM2 release switch
                                → 127.0.0.1:3017 health gate
                                (any failure → code rollback to previous release)
         4. public check      = https://<VPS_DOMAIN>/api/health == 200 (hard gate
                                once VPS_DOMAIN is set)
```

Key files: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
`scripts/network-preflight.sh`, `scripts/deploy-production.sh`,
`scripts/test-deploy-rollback.sh`, `ecosystem.config.js`,
`deploy/nginx/learn-aloeducation.conf`, `deploy/tailscale/README.md`,
`deploy/tailscale/acl.hujson`.

## GitHub setup (one-time, repository admin)

### Secrets — Settings → Secrets and variables → Actions

| Secret | Value | Status |
|---|---|---|
| `SERVER_HOST` | **`100.85.239.114`** (tailnet IP or a verified `*.ts.net` name) | preferred name |
| `VPS_HOST` | same value as `SERVER_HOST` | **legacy name — kept compatible**; the workflow reads `SERVER_HOST` **or** `VPS_HOST`. Migrate to `SERVER_HOST` when convenient, then delete `VPS_HOST`. Never an unverified public address. |
| `VPS_USER` | SSH user that owns the app (`aloedu`) | required |
| `VPS_PORT` | *(optional)* SSH port, default `22` | optional |
| `VPS_SSH_KEY` | Private key of the **dedicated deploy keypair** (public half in the server user's `~/.ssh/authorized_keys`) | required — protect it; rotate if ever exposed |
| `VPS_SSH_HOST_KEY` | The server ED25519 host-key **line** for pinning (`cat /etc/ssh/ssh_host_ed25519_key.pub` on the server, fingerprint-verified out-of-band). Strict host-key verification stays **ON**; the workflow binds the pinned key material to the deploy host. | required |
| `TAILSCALE_OAUTH_CLIENT_ID` | OAuth client ID (scope: `auth_keys:Write`, tag `tag:github-runner` only) | required — see `deploy/tailscale/README.md` §3 |
| `TAILSCALE_OAUTH_SECRET` | OAuth client secret (shown once at creation) | required |

Secret values are never printed, logged, or echoed by any workflow step.

### Variables (optional overrides — defaults match the verified server)

| Variable | Default | Purpose |
|---|---|---|
| `VPS_APP_DIR` | `/home/aloedu/projects/learn-aloeducation` | release layout base (`releases/`, `current`, `shared/`) |
| `VPS_PM2_APP` | `learn-aloeducation` | PM2 process name |
| `VPS_APP_PORT` | `3017` | local health port |
| `VPS_DOMAIN` | `https://learn.aloeducation.com` | public health gate; setting it makes the public check **strict** |
| `VPS_DEPLOY_ENABLED` | *(unset)* | **readiness switch.** The deploy job is **skipped** unless this equals exactly `true`. Leave unset until every §Deployment blocker is cleared |

### Production approval gate (required)

Create/keep the GitHub Environment named `production` (Settings →
Environments) and set **Required reviewers** (at least yourself). Every deploy
job pauses until a reviewer explicitly approves **that run**. The workflow also
fails closed if it can read the environment and finds no reviewers configured.

*Do not set `VPS_DEPLOY_ENABLED=true` before required reviewers are in place.*

### Branch protection — Settings → Branches → rule for `main`

Require a pull request before merging; require status check **`validate`**
(from CI) to pass; require branches to be up to date; do not allow bypassing.
Direct pushes to `main` should be impossible — every change arrives via a
verified PR.

## Deployment blockers — deployment is intentionally disabled

The deploy job stays skipped (`VPS_DEPLOY_ENABLED` unset) while **any** of
these is unresolved. Clear each one, then flip the readiness switch:

1. **Production MySQL P1010 access-denied error** — the app's MySQL user/host
   grants fail authentication (`SELECT 1` fails). Fix grants on the server
   (user must connect from the host it connects from — verify with the same
   `DATABASE_URL` the app uses).
2. **Previously exposed database credential requiring rotation** — rotate the
   MySQL credential (and any other value from the exposed `.env` material)
   before a deploy re-introduces it in a new release artifact.
3. **Unverified real production database backup** — take and verify a manual
   backup first (`mysqldump | gzip`, `gzip -t`, row probe); the automated
   backup gate in `deploy-production.sh` only proves *the dump works*, not that
   a restore point already exists.
4. **Unverified CPU compatibility for Sharp PNG processing** — the server CPU
   rejected Bun (illegal instruction); confirm the pinned Sharp binary works on
   this CPU (`node -e` Sharp resize on the server) before release.
5. **Untested first production release-switch procedure** — run the dry-run of
   the switch/rollback mechanics (`scripts/test-deploy-rollback.sh`) **on the
   server**, and plan the first switch off the current uploaded copy
   (`scripts/bootstrap-vps.sh`) with a rollback window.

Successful network connectivity is **not** authorization to deploy.

## One-time server setup (as `aloedu`) — see also deploy/tailscale/README.md

```bash
# Preconditions matching the verified stack
node -v; npm -v; pm2 -v; mysql --version; redis-cli ping
curl -fsI https://binaries.prisma.sh >/dev/null && echo "prisma CDN reachable"

# Convert the existing non-git directory into a real clone (keeps the old copy
# aside for rollback, copies .env + storage/, rebuilds, health-checks;
# runs NO database migration):
git clone https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION.git /tmp/alo-bootstrap
bash /tmp/alo-bootstrap/scripts/bootstrap-vps.sh
cd /home/aloedu/projects/learn-aloeducation

# Production env: real values, never committed
cp .env.example .env && chmod 600 .env   # set DATABASE_URL (local MySQL), NEXTAUTH_*, ADMIN_*, HTTPSMS_*
npm ci && npx prisma generate

# Nginx (reference config in-repo; TLS via your issuer, e.g. certbot)
sudo cp deploy/nginx/learn-aloeducation.conf /etc/nginx/sites-available/learn-aloeducation
sudo ln -sfn /etc/nginx/sites-available/learn-aloeducation /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# First start (subsequent releases are handled by deploys)
npm run build
pm2 start ecosystem.config.js --only learn-aloeducation
pm2 save && pm2 startup
curl -i http://127.0.0.1:3017/api/health
```

Do not expose SSH private keys, database passwords, or API keys in chat or
Git. Generate the admin hash on the server with
`read -rsp 'Admin password: ' p && printf '%s' "$p" | node scripts/hash-admin-password.mjs && unset p`.

## DNS / proxy — required for a *confirmed live* website

`learn.aloeducation.com` did not resolve at audit time; Nginx owns 80/443 and
Caddy is stuck activating with a config for the same domain. Decide on **one**
proxy and one routing path (the repo reference is Nginx +
`deploy/nginx/learn-aloeducation.conf`), obtain TLS, and resolve the Caddy /
cloudflared conflict. Then set the GitHub variable
`VPS_DOMAIN=https://learn.aloeducation.com`: that turns the deploy workflow's
public check into a **hard gate**. Until then the workflow only warns on
public-check failure (server-side health remains a hard gate either way).
The app currently binds `0.0.0.0:3017`; after the first deploy of this repo's
`ecosystem.config.js` it must show `127.0.0.1:3017` in `ss -lntp`.

## First migration — read before the first deploy

`prisma migrate deploy` is the only migration command deploys run (never
`db push` / `migrate reset`). The baseline migration uses
`CREATE TABLE IF NOT EXISTS`, but the CRM/OTP deltas do not. If the live
database was previously synced with `db push`, its tables exist without a
`_prisma_migrations` history and `migrate deploy` will fail closed (previous
code is restored automatically). In that case, baseline it **manually, once,
after a verified backup**:

```bash
cd /home/aloedu/projects/learn-aloeducation
npx prisma migrate status                      # inspect first
mysqldump ... > pre-baseline-backup.sql        # verified backup first
npx prisma migrate resolve --applied 20261001000000_initial_baseline
# Only mark later migrations applied if their tables/columns verifiably exist:
npx prisma migrate resolve --applied 20261010000000_admissions_crm_quotes
npx prisma migrate resolve --applied 20261010000001_admin_otp_challenges
npx prisma migrate status                      # must be green before deploying
```

## What every deploy does (`scripts/deploy-production.sh`)

Lock → verify Node 22/tools → require `shared/.env` → fetch the exact merged
SHA into a git mirror (refuses anything ≠ `origin/main`) → `git archive` into
`releases/<sha>/` (the running release's `.next` is never touched) →
`mysqldump` backup to `shared/.backups/` (0700, `gzip -t` + content probe;
**deploy stops if the backup fails**) → `npm ci` → `prisma generate` →
`prisma migrate deploy` → `npm run build` + standalone check → atomic
`current` symlink switch (`mv -T`) → `pm2 startOrReload` → up to 60 s of
`http://127.0.0.1:3017/api/health` checks → `RELEASE_SHA` must equal the
expected SHA. Any failure after switch rolls the **code** back to the previous
release and restarts PM2. DB schema is never auto-reverted. The workflow then
independently verifies the public `VPS_DOMAIN/api/health` from GitHub.

## Rollback

- **Automatic:** failed deploys restore the previous `releases/<sha>` via the
  `current` symlink and PM2 reload; the deploy fails loudly.
- **Manual:** `releases/` keeps the newest 5 releases (never the current or
  previous); `cd APP_DIR && ln -sfn releases/<old-sha> current.tmp && mv -T
  current.tmp current && pm2 startOrReload current/ecosystem.config.js --only
  learn-aloeducation --update-env`. Restore the DB from
  `shared/.backups/db-*.sql.gz` **only** with an explicit decision — deploys
  never downgrade schema automatically.
- History: `APP_DIR/.releases/history.log` records `sha=, prev=, at=, backup=`
  for every deploy.

## Verification evidence

Per-item PASS/FAIL/UNVERIFIED status for the networking repair and the full
deployment-readiness checklist lives in
`audit/07-NETWORKING-REPAIR-20261013.md`. **No production success is claimed
until the exact approved SHA is verified running on the server and public
health checks pass.**
