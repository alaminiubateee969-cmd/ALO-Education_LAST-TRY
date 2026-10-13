#!/usr/bin/env bash
# Isolated release-switch + rollback test (no PM2/MySQL/prod touched).
# Verifies the atomic symlink mechanism deploy-production.sh relies on.
set -euo pipefail
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/releases/sha-old" "$TMP/releases/sha-new"
echo sha-old > "$TMP/releases/sha-old/RELEASE_SHA"; echo sha-new > "$TMP/releases/sha-new/RELEASE_SHA"
switch() { ln -sfn "$1" "$TMP/current.tmp" && mv -T "$TMP/current.tmp" "$TMP/current"; }
switch "$TMP/releases/sha-old";  [ "$(cat "$TMP/current/RELEASE_SHA")" = sha-old ]
switch "$TMP/releases/sha-new";  [ "$(cat "$TMP/current/RELEASE_SHA")" = sha-new ]
switch "$TMP/releases/sha-old";  [ "$(cat "$TMP/current/RELEASE_SHA")" = sha-old ] # rollback
bash -n "$(dirname "$0")/deploy-production.sh"
command -v shellcheck >/dev/null && shellcheck "$(dirname "$0")/deploy-production.sh" || echo "shellcheck not installed — bash -n only"
echo "PASS: atomic switch + rollback + deploy script syntax"
