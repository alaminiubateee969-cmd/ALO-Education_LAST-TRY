#!/usr/bin/env bash
# secret-scan.sh — fail CI if real credential material is committed.
#
# Scans tracked text files for private keys, API tokens, and live database
# URLs. Known-safe placeholders (REPLACE_WITH…, <…>, $VARS, and the ci/test
# credentials used by the isolated CI database) are permitted. Historical
# audit reports under audit/ are excluded: they document (already-sanitised)
# findings and were reviewed separately.
#
# Usage: bash scripts/secret-scan.sh   (exit 0 = clean, 1 = findings)
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  mapfile -t FILES < <(git ls-files |
    grep -v '^audit/' |
    grep -v -E '(package-lock\.json|bun\.lock)$' ||
    true)
else
  echo "[secret-scan] git unavailable — scanning the working tree instead" >&2
  mapfile -t FILES < <(find . -type f \
    -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.next/*" \
    -not -path "./.tmp-tests/*" -not -path "./storage/*" -not -path "./audit/*" \
    -not -name "package-lock.json" -not -name "bun.lock" || true)
fi

# Token / private-key shapes that indicate real secret material.
TOKEN_PATTERNS=(
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'ghp_[A-Za-z0-9]{36,}'
  'github_pat_[A-Za-z0-9_]{22,}'
  'gho_[A-Za-z0-9]{36,}'
  'AKIA[0-9A-Z]{16}'
  'sk-[A-Za-z0-9]{20,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'AIza[0-9A-Za-z_-]{35}'
)

# Credential-bearing database URLs (allow-list for placeholders below).
DB_URL_RE='(mysql|postgres(ql)?|mongodb(\+srv)?)://[^/:@[:space:]"'\'']+:([^/@[:space:]"'\'']+@)'
DB_URL_ALLOW_RE='REPLACE_WITH|PLACEHOLDER|<[a-z_ ]+>|\$[A-Z_]+|user:ci|ci:ci|root:root|alo:pw|user:password|YOUR_|xxxxx|:test@|:PASSWORD|:password@'

findings=0

token_grep_args=()
for pat in "${TOKEN_PATTERNS[@]}"; do
  token_grep_args+=(-e "$pat")
done

for file in "${FILES[@]}"; do
  [ -f "$file" ] || continue
  # skip binary-ish files quickly
  case "$file" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.svg|*.mp4|*.mp3|*.wav|*.ttf|*.woff|*.woff2|*.webp|*.zip|*.gz) continue ;;
  esac

  # token / private-key shapes
  while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    printf '✗ %s — token/private-key pattern: %.60s…\n' "$hit"
    findings=$((findings + 1))
  done < <(grep -nE "${token_grep_args[@]}" "$file" 2>/dev/null || true)

  # live-looking database URLs — the allow-list is matched against ONLY the
  # user:password portion of the URL, never the hostname (a placeholder-free
  # password on ANY host is a finding).
  while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    cred="$(printf '%s' "$hit" | sed -n 's/.*:\/\/\([^@]*\)@.*/\1/p')"
    if [ -n "$cred" ] && printf '%s' "$cred" | grep -qE "$DB_URL_ALLOW_RE"; then continue; fi
    printf '✗ %s — credential-bearing database URL: %.70s…\n' "$hit"
    findings=$((findings + 1))
  done < <(grep -nE -e "$DB_URL_RE" "$file" 2>/dev/null || true)
done

if [ "$findings" -gt 0 ]; then
  echo ""
  echo "SECRET SCAN FAILED — $findings finding(s). Remove the credential(s) and rotate any exposed values."
  exit 1
fi
echo "SECRET SCAN OK — no committed credential material detected."
