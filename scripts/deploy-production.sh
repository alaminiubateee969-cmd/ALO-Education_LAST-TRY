#!/usr/bin/env bash
# learn-aloeducation — atomic production deploy (runs ON the VPS via SSH).
#
# Layout under APP_DIR (base, never the live code dir itself):
#   releases/<sha>/   immutable release, built in isolation
#   current -> releases/<sha>   symlink switched atomically (mv -T)
#   shared/.env, shared/storage/, shared/.backups/   preserved across releases
#   repo/             git mirror used only to fetch + `git archive` a SHA
#
# Safety: deploy lock; exact-SHA verification; build NEVER touches the
# running release's .next; verified MySQL backup (mysqldump + gzip -t +
# row probe) BEFORE `prisma migrate deploy`; health gate; on failure the
# `current` symlink and PM2 are rolled back to the previous release.
# DB schema is never auto-reverted. No `git reset --hard` in a live dir.
# Secrets are never echoed (DATABASE_URL is parsed in-process only).
set -euo pipefail
cd / # never inherit a deleted cwd (PM2 ENOENT: uv_cwd)

APP_DIR="${APP_DIR:-/home/aloedu/projects/learn-aloeducation}"
PM2_APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"
APP_PORT="${APP_PORT:-3017}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
REPO_URL="${REPO_URL:-origin}"
RELEASES_DIR="$APP_DIR/releases"; SHARED_DIR="$APP_DIR/shared"
CURRENT_LINK="$APP_DIR/current"; REPO_DIR="$APP_DIR/repo"
LOCK_FILE="/tmp/${PM2_APP_NAME}-deploy.lock"
log()  { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

exec 9>"$LOCK_FILE"; flock -n 9 || fail "another deploy is running"
for c in git node npm pm2 mysqldump mysql curl flock tar; do command -v "$c" >/dev/null || fail "$c not installed"; done
[ "$(node -p 'process.versions.node.split(".")[0]')" = "22" ] || fail "expected Node 22, found $(node -v)"
[ -f "$SHARED_DIR/.env" ] || fail "shared .env missing at $SHARED_DIR/.env (chmod 600)"
mkdir -p "$RELEASES_DIR" "$SHARED_DIR/storage" "$SHARED_DIR/.backups"; chmod 700 "$SHARED_DIR/.backups" || true

# ── Fetch exact SHA into the mirror (live dir untouched) ────────────────────
if [ ! -d "$REPO_DIR/.git" ]; then git clone --quiet "$REPO_URL" "$REPO_DIR" || fail "clone failed"; fi
git -C "$REPO_DIR" fetch --prune --quiet origin main || fail "git fetch failed"
REMOTE_SHA="$(git -C "$REPO_DIR" rev-parse origin/main)"
[ -n "$EXPECTED_SHA" ] || { EXPECTED_SHA="$REMOTE_SHA"; log "manual run: deploying origin/main $EXPECTED_SHA"; }
[ "$EXPECTED_SHA" = "$REMOTE_SHA" ] || fail "EXPECTED_SHA != origin/main — only merged main commits deploy"
git -C "$REPO_DIR" cat-file -e "${EXPECTED_SHA}^{commit}" || fail "SHA not found after fetch"
RELEASE_DIR="$RELEASES_DIR/$EXPECTED_SHA"
PREV_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
log "deploying $EXPECTED_SHA (previous: ${PREV_TARGET:-none})"

rollback() {
  [ -n "$PREV_TARGET" ] && [ -d "$PREV_TARGET" ] || fail "deploy failed and no previous release exists to roll back to"
  log "ROLLBACK: current -> $PREV_TARGET (database NOT auto-reverted)"
  ln -sfn "$PREV_TARGET" "$CURRENT_LINK.tmp" && mv -T "$CURRENT_LINK.tmp" "$CURRENT_LINK"
  cd "$APP_DIR" && pm2 startOrReload "$CURRENT_LINK/ecosystem.config.js" --only "$PM2_APP_NAME" --update-env || true
}

# ── Materialise + build the release in isolation ────────────────────────────
if [ ! -f "$RELEASE_DIR/.next/standalone/server.js" ]; then
  rm -rf "$RELEASE_DIR"; mkdir -p "$RELEASE_DIR"
  git -C "$REPO_DIR" archive "$EXPECTED_SHA" | tar -x -C "$RELEASE_DIR" || fail "git archive failed"
fi
printf '%s\n' "$EXPECTED_SHA" > "$RELEASE_DIR/RELEASE_SHA"
ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
rm -rf "$RELEASE_DIR/storage"; ln -sfn "$SHARED_DIR/storage" "$RELEASE_DIR/storage"
cd "$RELEASE_DIR"
npm ci || { rm -rf "$RELEASE_DIR"; fail "npm ci failed (live release untouched)"; }
npx prisma generate || fail "prisma generate failed (live release untouched)"

# ── Verified backup, then migration gate ────────────────────────────────────
TS="$(date -u +%Y%m%d-%H%M%S)"; BACKUP_FILE="$SHARED_DIR/.backups/db-${TS}-${EXPECTED_SHA:0:7}.sql.gz"
BACKUP_ENV="$(mktemp)"; chmod 600 "$BACKUP_ENV"; trap 'rm -f "$BACKUP_ENV"' EXIT
node - "$BACKUP_ENV" <<'NODE'
const fs = require("fs"); const out = process.argv[2]; let url = "";
for (const line of fs.readFileSync(process.env.ENV_FILE || ".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
  if (m) { url = m[1].trim().replace(/^["']|["']$/g, ""); break; }
}
if (!url.startsWith("mysql://")) { console.error("[deploy] DATABASE_URL missing/not mysql://"); process.exit(1); }
const u = new URL(url); const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
fs.writeFileSync(out, [`MYSQL_HOST=${q(decodeURIComponent(u.hostname))}`, `MYSQL_PORT=${q(u.port || "3306")}`,
  `MYSQL_USER=${q(decodeURIComponent(u.username))}`, `MYSQL_PWD=${q(decodeURIComponent(u.password))}`,
  `MYSQL_DB=${q(decodeURIComponent(u.pathname.slice(1)))}`, ""].join("\n"));
NODE
# shellcheck disable=SC1090
set -a; . "$BACKUP_ENV"; set +a
# Connectivity gate (P1010 surfaces here, before any schema change):
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -N -e "SELECT 1" "$MYSQL_DB" >/dev/null \
  || { unset MYSQL_PWD; fail "MySQL SELECT 1 failed — check user/host grants for db (P1010); no migration attempted"; }
mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --single-transaction --no-tablespaces "$MYSQL_DB" | gzip > "$BACKUP_FILE"
unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
chmod 600 "$BACKUP_FILE"
gzip -t "$BACKUP_FILE" && [ -s "$BACKUP_FILE" ] || fail "backup failed integrity check"
zcat "$BACKUP_FILE" | head -c 4096 | grep -qi "MySQL dump\|CREATE TABLE" || fail "backup content probe failed"
log "verified backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
npx prisma migrate status || log "note: migrate status is non-zero — expected while unapplied migrations exist (first reconciliation deploy); migrate deploy below is the enforcing gate and refuses to continue if any migration is marked failed"
npx prisma migrate deploy || { log "migrate deploy failed; live release untouched, DB left as-is (manual review; backup: $BACKUP_FILE)"; fail "migration failed"; }

npm run build || fail "build failed (live release untouched)"
[ -f .next/standalone/server.js ] || fail "no .next/standalone/server.js produced"

# ── Atomic switch + health gate (rollback on failure) ───────────────────────
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.tmp" && mv -T "$CURRENT_LINK.tmp" "$CURRENT_LINK"
cd "$APP_DIR"
pm2 startOrReload "$CURRENT_LINK/ecosystem.config.js" --only "$PM2_APP_NAME" --update-env || { rollback; fail "PM2 reload failed — rolled back"; }
pm2 save || true
healthy=""
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" || true)"
  [ "$code" = "200" ] && { healthy=1; break; }; sleep 2
done
[ -n "$healthy" ] || { pm2 logs "$PM2_APP_NAME" --lines 50 --nostream || true; rollback; fail "health check failed — rolled back"; }
[ "$(cat "$CURRENT_LINK/RELEASE_SHA")" = "$EXPECTED_SHA" ] || { rollback; fail "running release SHA mismatch"; }
log "health OK :$APP_PORT /api/health -> 200 · release $EXPECTED_SHA live"
mkdir -p "$APP_DIR/.releases"
printf 'sha=%s prev=%s at=%s backup=%s\n' "$EXPECTED_SHA" "${PREV_TARGET:-none}" "$(date -u +%FT%TZ)" "$BACKUP_FILE" >> "$APP_DIR/.releases/history.log"
# Retention: keep newest $KEEP_RELEASES release dirs (never the current/prev).
ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
  case "$(readlink -f "$old")" in "$RELEASE_DIR"|"$PREV_TARGET") : ;; *) rm -rf "$old" ;; esac
done
log "DEPLOY SUCCEEDED: $EXPECTED_SHA"
