#!/usr/bin/env bash
# learn-aloeducation — read-only network preflight (NO deploy, NO app changes).
#
# Verifies, in order:
#   1. the configured deploy host is a PRIVATE tailnet destination
#      (Tailscale CGNAT 100.64.0.0/10 or a MagicDNS *.ts.net name) — a public
#      IP is refused: this app is hosted on a physical server behind NAT and
#      SSH must never travel over the public internet;
#   2. TCP reachability of the SSH port (default 22);
#   3. optional (--ssh): SSH public-key authentication with StrictHostKeyChecking
#      (pinned known_hosts entry required), executing only `true` remotely.
#
# Usage (also called from .github/workflows/deploy.yml so CI and operator
# evidence come from the same code):
#   SERVER_HOST=100.85.239.114 scripts/network-preflight.sh --tcp
#   SERVER_HOST=100.85.239.114 SERVER_USER=aloedu \
#     SSH_KEY_FILE=$HOME/.ssh/deploy_key scripts/network-preflight.sh --tcp --ssh
#
# Env:
#   SERVER_HOST   required — tailnet IP (100.x) or *.ts.net name
#   SERVER_PORT   optional — SSH port (default 22)
#   SERVER_USER   required for --ssh
#   SSH_KEY_FILE  optional — private key path (default ~/.ssh/deploy_key)
#   KNOWN_HOSTS   optional — known_hosts file (default ~/.ssh/known_hosts)
#   PREFLIGHT_ATTEMPTS / PREFLIGHT_TCP_TIMEOUT  optional — probe tuning
set -euo pipefail

SERVER_HOST="${SERVER_HOST:-}"
SERVER_PORT="${SERVER_PORT:-22}"
SERVER_USER="${SERVER_USER:-}"
SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/deploy_key}"
KNOWN_HOSTS="${KNOWN_HOSTS:-$HOME/.ssh/known_hosts}"
DO_SSH=0

usage() { echo "usage: SERVER_HOST=<tailnet-host> $0 [--tcp] [--ssh]" >&2; exit 2; }
[ -n "$SERVER_HOST" ] || { echo "[preflight] FAIL: SERVER_HOST is not set" >&2; usage; }

for arg in "$@"; do
  case "$arg" in
    --tcp) : ;; # TCP probe always runs
    --ssh) DO_SSH=1 ;;
    *) usage ;;
  esac
done

log()  { printf '[preflight] %s\n' "$*"; }
fail() { printf '[preflight] FAIL: %s\n' "$*" >&2; exit 1; }

# ── 1. Destination must be an authenticated private tailnet address ─────────
if [[ "$SERVER_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  IFS=. read -r o1 o2 _ _ <<< "$SERVER_HOST"
  if [ "$o1" != 100 ] || [ "$o2" -lt 64 ] 2>/dev/null || [ "$o2" -gt 127 ] 2>/dev/null; then
    fail "SERVER_HOST=$SERVER_HOST is not inside the Tailscale CGNAT range 100.64.0.0/10. Use 100.85.239.114 (or a verified *.ts.net name) — never a public IP."
  fi
  log "PASS  destination $SERVER_HOST is inside tailnet range 100.64.0.0/10"
elif [[ "$SERVER_HOST" == *.ts.net ]]; then
  log "PASS  destination $SERVER_HOST is a Tailscale MagicDNS name"
else
  fail "SERVER_HOST='$SERVER_HOST' is neither a tailnet IP (100.64.0.0/10) nor a *.ts.net name. Use 100.85.239.114 or a verified tailnet DNS name — public hostnames/IPs are not valid deploy targets."
fi

# ── 2. TCP reachability of the SSH port ─────────────────────────────────────
ATTEMPTS="${PREFLIGHT_ATTEMPTS:-6}"
TCP_TIMEOUT="${PREFLIGHT_TCP_TIMEOUT:-5}"
log "TCP probe ${SERVER_HOST}:${SERVER_PORT} ..."
tcp_ok=""
i=1
while [ "$i" -le "$ATTEMPTS" ]; do
  if timeout "$TCP_TIMEOUT" bash -c "exec 3<>/dev/tcp/${SERVER_HOST}/${SERVER_PORT}" 2>/dev/null; then
    tcp_ok=1; break
  fi
  log "TCP attempt $i/$ATTEMPTS failed — retrying in 5s (tailnet propagation can lag after runner join)"
  sleep 5
  i=$((i + 1))
done
[ -n "$tcp_ok" ] || fail "TCP ${SERVER_HOST}:${SERVER_PORT} unreachable. Check: tailscale status on both peers; ACL/grants allow tag:github-runner → this host on port ${SERVER_PORT}; UFW rule 'allow in on tailscale0 to any port ${SERVER_PORT}' on the server. Do NOT expose SSH publicly or disable UFW."
log "PASS  TCP ${SERVER_HOST}:${SERVER_PORT} is open"

# ── 3. Optional: SSH public-key authentication (read-only) ──────────────────
if [ "$DO_SSH" = 1 ]; then
  [ -n "$SERVER_USER" ] || fail "--ssh requires SERVER_USER (e.g. aloedu)"
  [ -f "$SSH_KEY_FILE" ] || fail "SSH key file not found: $SSH_KEY_FILE"
  [ -s "$KNOWN_HOSTS" ] || fail "known_hosts missing/empty at $KNOWN_HOSTS — pin the server host key first (StrictHostKeyChecking stays ON)"
  log "SSH auth probe as ${SERVER_USER}@${SERVER_HOST}:${SERVER_PORT} (BatchMode, pinned host key, remote command: true) ..."
  ssh -i "$SSH_KEY_FILE" -p "$SERVER_PORT" \
    -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o BatchMode=yes \
    -o UserKnownHostsFile="$KNOWN_HOSTS" \
    -o ConnectTimeout=20 \
    "$SERVER_USER@$SERVER_HOST" 'true' \
    || fail "SSH public-key authentication failed (key not accepted, host-key mismatch, or sshd unreachable). Verify VPS_SSH_KEY public half is in the server user's authorized_keys and VPS_SSH_HOST_KEY matches 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub' on the server."
  log "PASS  SSH public-key authentication as ${SERVER_USER}@${SERVER_HOST}"
fi

log "PREFLIGHT PASS (read-only; nothing was deployed or changed)"
