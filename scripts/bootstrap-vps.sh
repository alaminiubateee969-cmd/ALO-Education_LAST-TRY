#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# learn-aloeducation — ONE-TIME VPS bootstrap.
#
# Why this exists (VPS audit 2026-10-13): the live directory
# /home/aloedu/projects/learn-aloeducation is an uploaded copy, NOT a git
# repository, and has no package-lock.json — so automatic deploys (which check
# out an exact Git SHA) cannot work until it is a real clone.
#
# What it does, safely:
#   1. Moves the existing directory aside (timestamped, untouched — that is
#      your rollback), clones the GitHub repo fresh into the verified path.
#   2. Copies .env and storage/ from the old copy into the clone.
#   3. npm ci → prisma generate → build → PM2 reload → health check.
#   It does NOT run any database migration (migrate status is printed only),
#   does NOT touch Nginx/Caddy/DNS, and does NOT delete the old copy.
#
# Run ON the VPS as the app user (aloedu), from anywhere:
#   bash scripts/bootstrap-vps.sh            # after cloning this repo once
# or without a local copy:
#   git clone <repo> /tmp/alo-bootstrap && bash /tmp/alo-bootstrap/scripts/bootstrap-vps.sh
#
# Rollback (old copy still runs if anything before PM2 reload fails):
#   pm2 stop learn-aloeducation
#   mv /home/aloedu/projects/learn-aloeducation{,.failed}
#   mv /home/aloedu/projects/learn-aloeducation.pre-git-<TS> /home/aloedu/projects/learn-aloeducation
#   cd /home/aloedu/projects/learn-aloeducation && pm2 restart learn-aloeducation
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/home/aloedu/projects/learn-aloeducation}"
PM2_APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"
APP_PORT="${APP_PORT:-3017}"
REPO_URL="${REPO_URL:-https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION.git}"
TS="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="${APP_DIR}.pre-git-${TS}"

log()  { printf '[bootstrap] %s\n' "$*"; }
fail() { printf '[bootstrap] ERROR: %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null || fail "git not installed"
command -v node >/dev/null || fail "node not installed"
command -v npm >/dev/null || fail "npm not installed"
command -v pm2 >/dev/null || fail "pm2 not installed"
case "$(node -p 'process.versions.node.split(".")[0]')" in
  22) : ;; *) fail "expected Node 22, found $(node -v)" ;;
esac
# NOTE: never use Bun on this VPS — the audit shows it core-dumps
# (Illegal instruction) on this CPU. npm is the verified package manager.

[ -d "$APP_DIR" ] || fail "$APP_DIR does not exist — nothing to bootstrap; use the plain clone steps in DEPLOYMENT.md instead"
[ -d "$APP_DIR/.git" ] && fail "$APP_DIR is already a git repository — bootstrap not needed; deploys can run"
[ -f "$APP_DIR/.env" ] || fail "$APP_DIR/.env missing — refusing to bootstrap without the production env file"
[ ! -e "$BACKUP_DIR" ] || fail "backup target $BACKUP_DIR already exists"

log "moving existing (non-git) production copy aside: $APP_DIR -> $BACKUP_DIR"
log "the PM2 process keeps serving from memory during the swap; the old .next stays in $BACKUP_DIR for rollback"
mv "$APP_DIR" "$BACKUP_DIR"

cleanup_on_failure() {
  log "failure — restoring original directory (nothing was migrated or deleted)"
  rm -rf "$APP_DIR"
  mv "$BACKUP_DIR" "$APP_DIR"
  pm2 restart "$PM2_APP_NAME" || true
}
trap cleanup_on_failure ERR

log "cloning $REPO_URL"
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"
log "checked out $(git rev-parse HEAD) on $(git rev-parse --abbrev-ref HEAD)"

log "copying .env and storage/ into the shared/ layout used by atomic deploys"
# New layout: APP_DIR is the deploy BASE; code lives in releases/<sha> built
# by scripts/deploy-production.sh, with shared/.env + shared/storage.
mkdir -p shared
cp "$BACKUP_DIR/.env" shared/.env && chmod 600 shared/.env
if [ -d "$BACKUP_DIR/storage" ]; then
  mkdir -p shared/storage
  cp -a "$BACKUP_DIR/storage/." shared/storage/
fi
ln -sfn shared/.env .env
# Any other local-only, gitignored state worth keeping can be copied manually
# afterwards — compare with: diff -r --brief \"$BACKUP_DIR\" \"$APP_DIR\"

npm ci
npx prisma generate
log "prisma migrate status (read-only — no migration is applied by bootstrap):"
npx prisma migrate status || true

npm run build
[ -f .next/standalone/server.js ] || fail "build produced no .next/standalone/server.js"

pm2 startOrReload ecosystem.config.js --only "$PM2_APP_NAME" --update-env
pm2 save

healthy=""
for i in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" || true)"
  [ "$code" = "200" ] && { healthy=1; break; }
  sleep 2
done
[ -n "$healthy" ] || fail "health check failed after bootstrap — original directory was NOT restored automatically because PM2 may be mid-restart; see rollback instructions in this script header and DEPLOYMENT.md"

trap - ERR
log "BOOTSTRAP SUCCEEDED: $APP_DIR is now a git clone at $(git rev-parse HEAD), health 200 on :$APP_PORT"
log "previous copy preserved at $BACKUP_DIR — delete it only after days of stable deploys"
log "next steps: GitHub secrets + branch protection, DNS/proxy (DEPLOYMENT.md), then merge a PR and watch the automatic deploy"
