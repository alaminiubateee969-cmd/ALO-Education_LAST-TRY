# ALO Learning Journey — Deployment and Verification

> **Pipeline status: IMPLEMENTED — live deployment NOT YET VERIFIED.**
> The workflows and deploy script in this repository implement
> `feature branch → PR (CI must pass) → main → automatic VPS deploy → live check`.
> A live site can only be claimed after (1) the GitHub secrets/variables and
> branch protection in §GitHub setup are configured, (2) the one-time VPS
> setup in §One-time VPS setup is done, and (3) a merged PR's deploy run is
> green including the final public health check. Nothing in this file claims
> an SSH session, database, or live site has been verified from here.

## Verified VPS configuration (operator-supplied)

| Component | Verified configuration |
|---|---|
| Application (PM2 name) | `learn-aloeducation` |
| Project directory | `/home/aloedu/projects/learn-aloeducation` |
| Runtime | Node.js `22.23.3` |
| Package manager | npm `10.9.9` (`package-lock.json` is the canonical lockfile) |
| Process manager | PM2 `7.0.4` (`ecosystem.config.js`) |
| Application port | `3017` (Next.js standalone, `127.0.0.1`) |
| Reverse proxy | Nginx, ports 80/443 (`deploy/nginx/learn-aloeducation.conf`) |
| Database | MySQL, running locally on the VPS |
| Redis | Running locally on the VPS (app has no hard Redis dependency) |
| Public site | `https://learn.aloeducation.com` (override with `SITE_URL` variable) |

Repository facts reconciled to the table above: Next.js `^16.1.1` with
`output: "standalone"`; Prisma 6 with MySQL provider and checked-in migrations
(including an `IF NOT EXISTS` baseline); `/api/health` is the low-detail
public readiness probe used by both deploy gates.

## The pipeline

```
feature branch ──► pull request ──► CI "validate" ──► merge to main
                                                        │
                          Deploy to VPS workflow ◄──────┘ (push to main)
                            1. verify job  = same CI workflow (reusable)
                            2. deploy job  = SSH (pinned host key) runs
                               scripts/deploy-production.sh at the exact SHA:
                               lock → clean-tree check → fetch/checkout SHA
                               → mysqldump backup → npm ci → prisma generate
                               → prisma migrate deploy → npm run build
                               → PM2 startOrReload → 127.0.0.1:3017 health gate
                               (any failure → code rollback to previous SHA)
                            3. public check = https://<site>/api/health == 200
```

Key files: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
`scripts/deploy-production.sh`, `ecosystem.config.js`,
`deploy/nginx/learn-aloeducation.conf`.

## GitHub setup (one-time, repository admin)

### Secrets — Settings → Secrets and variables → Actions

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS hostname or IP |
| `VPS_USER` | SSH user that owns the app (expected `aloedu`) |
| `VPS_PORT` | *(optional)* SSH port, default `22` |
| `VPS_SSH_KEY` | Private key of a **dedicated deploy keypair** (public half in the VPS user's `~/.ssh/authorized_keys`) |
| `VPS_SSH_HOST_KEY` | The VPS ED25519 host-key line for `known_hosts`. Get it out-of-band on the VPS: `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`, then from a trusted machine `ssh-keyscan -t ed25519 <host>` and confirm the fingerprints match. Never paste private keys or passwords anywhere else. |

### Variables (optional overrides — defaults already match the verified VPS)

`VPS_APP_DIR` (`/home/aloedu/projects/learn-aloeducation`), `PM2_APP_NAME`
(`learn-aloeducation`), `APP_PORT` (`3017`), `SITE_URL`
(`https://learn.aloeducation.com`).

### Branch protection — Settings → Branches → rule for `main`

Require a pull request before merging; require status checks
**`validate`** (from CI) and **`verify`** (from Deploy to VPS) to pass before
merging; require branches to be up to date; do not allow bypassing. Direct
pushes to `main` should be impossible — every change arrives via a verified PR.

### Environment

Create an environment named `production` (Settings → Environments). Do **not**
add required reviewers unless you want a manual approval gate before each
deploy; the workflow targets automatic deployment after merge.

## One-time VPS setup (as the app user, e.g. `aloedu`)

**Audit finding (2026-10-13, `audit/06-VPS-AUDIT-20261013.md`):** the live
`/home/aloedu/projects/learn-aloeducation` is an uploaded copy — **not a git
repository, no `package-lock.json`** — and `learn.aloeducation.com` does not
resolve in DNS yet. The app itself is healthy (PM2 online, local health 200).
Convert the directory to a real clone first; never use Bun on this VPS (it
core-dumps on this CPU — npm is canonical).

```bash
# Preconditions matching the verified stack
node -v; npm -v; pm2 -v; mysql --version; redis-cli ping
curl -fsI https://binaries.prisma.sh >/dev/null && echo "prisma CDN reachable"  # build/generate need this

# Convert the existing non-git directory into a clone (keeps the old copy
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

# First start (subsequent restarts are handled by deploys)
npm run build
pm2 start ecosystem.config.js --only learn-aloeducation
pm2 save && pm2 startup   # follow the printed instruction for boot persistence
curl -i http://127.0.0.1:3017/api/health
```

Do not expose SSH private keys, database passwords, or API keys in chat or
Git. Generate the admin hash on the VPS with
`read -rsp 'Admin password: ' p && printf '%s' "$p" | node scripts/hash-admin-password.mjs && unset p`.

## DNS / proxy — required for a *confirmed live* website

At audit time `learn.aloeducation.com` did not resolve, Nginx owns 80/443,
and Caddy is stuck activating with a config for the same domain. Before
claiming the site is live, decide on **one** proxy and one routing path:

```bash
getent hosts learn.aloeducation.com          # must return the VPS public IP (or tunnel)
dig +short learn.aloeducation.com
sudo nginx -T 2>/dev/null | grep -B2 -A15 'server_name learn.aloeducation.com'
sudo cat /etc/caddy/Caddyfile                # does another proxy claim the domain?
cat ~/.cloudflared/config.yml 2>/dev/null    # cloudflared is running — check ingress hostnames
```

If Nginx is the chosen proxy (matches the verified config), install
`deploy/nginx/learn-aloeducation.conf` (see one-time setup), obtain TLS for
the domain, and stop/disable the conflicting Caddy service
(`sudo systemctl disable --now caddy`) once nothing else needs it — the audit
shows other names in that Caddyfile, so confirm before disabling. Then set the
GitHub variable `SITE_URL=https://learn.aloeducation.com`: that turns the
deploy workflow's public check into a hard gate. Until `SITE_URL` is set, the
workflow only warns on public-check failure (VPS-side health remains a hard
gate either way). Note the app currently binds `0.0.0.0:3017`; after the first
deploy of this repo's `ecosystem.config.js` it must show `127.0.0.1:3017` in
`ss -lntp`.

## First migration — read before the first automatic deploy

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
mysqldump ... > pre-baseline-backup.sql        # verified backup (see §Rollback)
npx prisma migrate resolve --applied 20261001000000_initial_baseline
# Only mark later migrations applied if their tables/columns verifiably exist:
npx prisma migrate resolve --applied 20261010000000_admissions_crm_quotes
npx prisma migrate resolve --applied 20261010000001_admin_otp_challenges
npx prisma migrate status                      # must be green before deploying
```

## What every automatic deploy does (scripts/deploy-production.sh)

Lock → verify Node 22/tools → require clean git tree and `.env` → fetch and
check out the exact merged SHA (refuses anything ≠ `origin/main`) →
`mysqldump` backup to `.backups/` (0700, gz-verified; **deploy stops if the
backup fails**) → `npm ci` → `prisma generate` → `prisma migrate deploy` →
`npm run build` + standalone check → `pm2 startOrReload` → up to 60 s of
`http://127.0.0.1:3017/api/health` checks. Any post-checkout failure rolls the
**code** back to the previous SHA, rebuilds, and restarts. The workflow then
independently verifies the public `SITE_URL/api/health` from GitHub.

## Rollback

- **Automatic:** failed deploys restore the p
...[truncated 3881 chars]