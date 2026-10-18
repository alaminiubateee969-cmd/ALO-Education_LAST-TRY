# ALO Learning Journey — Security

## Authentication
- Status: a single-administrator credentials flow is implemented with NextAuth.js JWT sessions, an HttpOnly/SameSite cookie, and production middleware guarding the application and API routes. `/api/health`, `/api/auth/*`, and `/login` are public by design.
- Production fails closed unless `NEXTAUTH_SECRET`, `ADMIN_EMAIL`, a valid `ADMIN_PASSWORD_HASH`, `ADMIN_OTP_PHONE`, `HTTPSMS_API_KEY`, and `HTTPSMS_FROM` are configured. Passwords are verified with scrypt; a second SMS code is required in production; no default account or public registration exists.
- OTP challenges store HMACs rather than plaintext phone numbers/codes, expire after five minutes, are consumed once, allow at most five verification attempts, and are limited to three sends per hour with a 60-second resend cooldown. The HTTP SMS gateway only confirms queue acceptance; carrier/handset delivery is not guaranteed. No SMS was sent or live integration tested in this environment.
- The OTP send route is publicly reachable by design before sign-in, but requires same-origin POST and valid administrator email/password before it asks the configured provider to send to the fixed phone. The API returns an intentionally generic accepted message for invalid credentials.
- Configure secrets outside Git. Generate a hash with `read -rsp 'Admin password: ' p && printf '%s' "$p" | node scripts/hash-admin-password.mjs && unset p`.
- Development mode bypasses middleware for preview convenience unless `ALO_REQUIRE_AUTH=true`; do not use development mode with real CRM data.
- This is single-admin authentication, not RBAC or multi-user/team authorization. Production login, cookie behavior, HTTPS proxying, and protected routes still need end-to-end verification before exposure.

## Secrets Management
- `.env` is in `.gitignore` — never committed
- `.env.example` contains placeholder values only
- GitHub Actions secrets used for VPS deployment
- No credential-shaped strings in source code (verified by pattern scan across
  all tracked files: no `AKIA…`, `ghp_…`, `github_pat_…`, `xox…`, PEM private
  keys, or DSNs with embedded passwords)

## Application backups are NOT encrypted
`storage/backups/*.alo.bak` is a **raw SQLite database file** XOR-obfuscated with
the key `"alo-backup-2024"`, which is **hardcoded in
`src/app/api/backups/route.ts`** next to the comment *"not real crypto — marker
only"*. The manifest's `"encrypted": true` field is **false**. Anyone with the
file and this public source can decode it in one line.

Consequences:
- Never commit a `.alo.bak` to Git. `storage/backups/` is now gitignored, and the
  one file that had been committed (266 KB, 383 rows) has been removed from the
  working tree. **It remains in Git history** until history is rewritten — see
  `audit/05-EXPOSURE-REMEDIATION.md`.
- Keep backups off the web root, on a `0700` directory, and ideally off-server.
- Replace XOR with real crypto (AES-256-GCM via `crypto.scryptSync` +
  `createCipheriv`, key from an env var) before relying on backups at all.

### What the exposed database did and did not contain
Verified by decoding the committed artefact and inspecting it column by column
(values were never printed):

- **No credentials.** No model in `prisma/schema.prisma` has a token, secret,
  password, or API-key column. `SocialConnection` holds only `id, platform,
  accountName, handle, status, scopesJson, tokenExpiry, lastSyncAt, createdAt,
  updatedAt` — and `scopesJson` was **NULL in all 11 rows**. The only
  token-named field in the then-current 27-model schema was `tokenExpiry DateTime?`,
  a timestamp. The current schema has 31 models and still contains no OAuth credential field. **No OAuth token rotation was indicated by that inspected snapshot.**
- **But real business data was public:** 383 rows including `AnalyticsSnapshot`
  (315), `AuditLog` (13), `ApprovalItem` (11), `CommentInbox` (8),
  `ContentPackage` (7), `ContentIdea` (4), `RagDocument` (4), `PublishedPost`
  (3), `TelegramCommand` (3), `Notification` (3), `Company` (1).
- That snapshot is also **stale and not a valid restore point**: 15 tables
  against the then-current 27 models (the schema now has 31), `createdAt` 2026-08-09 with `retentionDays: 14`.

## Known Limitations
- **No role-based authorization or multi-user isolation.** The current credential is a single admin account. The browser-selected workspace header is a scope selector, not a security boundary between users.
- Development mode is intentionally unauthenticated by default for local preview; real or production data must never be used there. Set `ALO_REQUIRE_AUTH=true` to test the login flow locally.
- The SMS-code endpoint has per-admin resend and attempt limits, but there is no general IP-based login/API rate limiting or primary-password lockout; configure a trusted edge/proxy rate limit before public exposure.
- Database migrations have not been reconciled against the live server. See `DEPLOYMENT.md` before applying the checked-in CRM delta migration.
- CRM records contain personal contact data. Keep exports secure, avoid special-category data and identity documents, and apply the organisation's retention/deletion policy. The UI does not send marketing messages; `consentStatus` is an internal preference record, not proof of lawful basis.
- Email marketing refinement produces a human-review draft only. There is no sender, consent enforcement, suppression list, unsubscribe handling, or delivery pipeline; do not configure or claim email delivery from unused SMTP variables.
