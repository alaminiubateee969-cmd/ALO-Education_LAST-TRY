#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# learn-aloeducation — production deploy (runs ON the VPS, invoked over SSH
# by .github/workflows/deploy.yml; can also be run manually by the app user).
#
# Verified VPS config (DEPLOYMENT.md): /home/aloedu/projects/learn-aloeducation
# Node 22 · npm · PM2 app "learn-aloeducation" · Next.js standalone :3017
# Nginx 80/443 · local MySQL · local Redis.
#
# Safety properties:
#   • Deploys exactly EXPECTED_SHA (the merged main commit) — never a guess.
#   • Fail-closed: dirty tree, missing .env, missing backup tool, failed
#     backup, failed migration, failed build, or failed health check all stop
#     the deploy. No `|| true` anywhere on a critical step.
#   • MySQL backup (mysqldump) is taken BEFORE any migration.
#   • Migrations use `prisma migrate deploy` — NEVER `db push` / `migrate reset`.
#   • On failure after checkout, code is rolled back to the previous SHA and
#     rebuilt. Database migrations are NOT auto-reversed (restoring the dump
#     is a manual, destructive decision — see DEPLOYMENT.md §Rollback).
#   • .env and storage/ are gitignored and are never touched by checkout.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/home/aloedu/projects/learn-aloeducation}"
PM2_APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"
APP_PORT="${APP_PORT:-3017}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
LOCK_FILE="/tmp/${PM2_APP_NAME}-deploy.lock"

log()  { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

# ── Lock: one deploy at a time ───────────────────────────────────────────────
exec 9>"$LOCK_FILE"
flock -n 9 || fail "another deploy is already running (lock: $LOCK_FILE)"

# ── Preconditions ────────────────────────────────────────────────────────────
command -v git        >/dev/null || fail "git not installed"
command -v node       >/dev/null || fail "node not installed"
command -v npm        >/dev/null || fail "npm not installed"
command -v pm2        >/dev/null || fail "pm2 not installed"
command -v mysqldump  >/dev/null || fail "mysqldump not installed — backup gate cannot pass, refusing to deploy"
command -v curl       >/dev/null || fail "curl not installed"

case "$(node -p 'process.versions.node.split(".")[0]')" in
  22) : ;;
  *)  fail "expected Node 22, found $(node -v)" ;;
esac
log "runtime: node $(node -v) · npm $(npm -v) · pm2 $(pm2 -v)"

[ -d "$APP_DIR/.git" ] || fail "$APP_DIR is not a git working tree — clone the repo there first (DEPLOYMENT.md §One-time VPS setup)"
cd "$APP_DIR"

[ -f .env ] || fail ".env missing in $APP_DIR — create it (chmod 600) before deploying"
[ "$(stat -c '%a' .env)" = "600" ] || log "WARNING: .env permissions are $(stat -c '%a' .env), expected 600"

# Refuse to deploy over uncommitted work (ignored files like .env/storage are fine).
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --porcelain --untracked-files=no >&2
  fail "working tree has uncommitted changes — refusing to deploy over them"
fi

# ── Resolve target SHA ───────────────────────────────────────────────────────
git fetch --prune origin main
REMOTE_SHA="$(git rev-parse origin/main)"
if [ -z "$EXPECTED_SHA" ]; then
  EXPECTED_SHA="$REMOTE_SHA"
  log "no EXPECTED_SHA given (manual run) — deploying origin/main $EXPECTED_SHA"
fi
[ "$EXPECTED_SHA" = "$REMOTE_SHA" ] || fail "EXPECTED_SHA $EXPECTED_SHA != origin/main $REMOTE_SHA — only merged main commits may deploy"
PREV_SHA="$(git rev-parse HEAD)"
log "deploying $EXPECTED_SHA (previous: $PREV_SHA)"

rollback_code() {
  log "ROLLBACK: restoring previous code $PREV_SHA (database is NOT auto-reverted — see runbook)"
  git reset --hard "$PREV_SHA"
  npm ci
  npx prisma generate
  npm run build
  pm2 startOrReload ecosystem.config.js --only "$PM2_APP_NAME" --update-env
  log "rollback build complete; previous version restarting"
}

# ── Checkout exact SHA ───────────────────────────────────────────────────────
git checkout --quiet main
git reset --hard "$EXPECTED_SHA"
[ "$(git rev-parse HEAD)" = "$EXPECTED_SHA" ] || fail "checkout did not land on $EXPECTED_SHA"

# ── MySQL backup gate (before ANY schema change) ─────────────────────────────
TS="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="$APP_DIR/.backups"
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/db-${TS}-${EXPECTED_SHA:0:7}.sql.gz"
BACKUP_ENV="$(mktemp)"
chmod 600 "$BACKUP_ENV"
trap 'rm -f "$BACKUP_ENV"' EXIT

node - "$BACKUP_ENV" <<'NODE'
const fs = require("fs");
const out = process.argv[2];
let url = "";
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
  if (m) { url = m[1].trim().replace(/^["']|["']$/g, ""); break; }
}
if (!url.startsWith("mysql://")) { console.error("[deploy] DATABASE_URL missing or not mysql:// in .env"); process.exit(1); }
const u = new URL(url);
const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
fs.writeFileSync(out, [
  `MYSQL_HOST=${q(decodeURIComponent(u.hostname))}`,
  `MYSQL_PORT=${q(u.port || "3306")}`,
  `MYSQL_USER=${q(decodeURIComponent(u.username))}`,
  `MYSQL_PWD=${q(decodeURIComponent(u.password))}`,
  `MYSQL_DB=${q(decodeURIComponent(u.pathname.slice(1)))}`,
  "",
].join("\n"));
NODE

set -a; . "$BACKUP_ENV"; set +a
mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" \
  --single-transaction --no-tablespaces "$MYSQL_DB" | gzip > "$BACKUP_FILE"
unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
chmod 600 "$BACKUP_FILE"
gzip -t "$BACKUP_FILE" || fail "backup file failed gzip integrity check"
log "MySQL backup written: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# ── Install · generate · migrate · build ─────────────────────────────────────
if ! npm ci; then rollback_code; fail "npm ci failed — rolled back to $PREV_SHA"; fi
if ! npx prisma generate; then rollback_code; fail "prisma generate failed — rolled back to $PREV_SHA"; fi

log "prisma migrate status (before):"
npx prisma migrate status || true
if ! npx prisma migrate deploy; then
  rollback_code
  fail "prisma migrate deploy failed — code rolled back; database left as-is. If this is the first migrate-managed deploy on a db-push-created database, baseline it manually (DEPLOYMENT.md §First migration)"
fi

if ! npm run build; then rollback_code; fail "build failed — rolled back to $PREV_SHA"; fi
[ -f .next/standalone/server.js ] || { rollback_code; fail "build produced no .next/standalone/server.js — rolled back"; }

# ── Restart via PM2 ──────────────────────────────────────────────────────────
pm2 startOrReload ecosystem.config.js --only "$PM2_APP_NAME" --update-env
pm2 save

# ── Health gate ──────────────────────────────────────────────────────────────
healthy=""
for i in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" || true)"
  if [ "$code" = "200" ]; then healthy=1; break; fi
  sleep 2
done
if [ -z "$healthy" ]; then
  pm2 logs "$PM2_APP_NAME" --lines 50 --nostream || true
  rollback_code
  fail "health check http://127.0.0.1:${APP_PORT}/api/health did not return 200 — rolled back to $PREV_SHA"
fi
log "health check OK: http://127.0.0.1:${APP_PORT}/api/health -> 200"

pm2 describe "$PM2_APP_NAME" | grep -E "status|uptime" || true
if command -v redis-cli >/dev/null; then
  redis-cli ping >/dev/null 2>&1 && log "redis: PONG" || log "WARNING: redis-cli ping failed (app has no hard Redis dependency — see DEPLOYMENT.md)"
fi

# Record the release for rollback/audit (gitignored, never committed).
mkdir -p .releases
printf 'sha=%s prev=%s deployed_at=%s backup=%s\n' "$EXPECTED_SHA" "$PREV_SHA" "$(date -u +%FT%TZ)" "$BACKUP_FILE" >> ".releases/history.log"
log "DEPLOY SUCCEEDED: $EXPECTED_SHA live on port $APP_PORT (backup: $BACKUP_FILE)"
