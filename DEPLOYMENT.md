# ALO Learning Journey — Deployment and Verification

> **Current status: BLOCKED — NOT PRODUCTION VERIFIED.** This is a repository-side review, not a claim about the Ubuntu host. No SSH connection, production database, reverse proxy, DNS, certificate, or live application was verified. Do not run the existing automatic deployment workflow until the blockers below are addressed.

## Repository facts

- Framework: `next` declares `^16.1.1` with standalone output; the current Arena worktree resolves Next.js 16.4.0.
- Package manager: Bun (`bun.lock` is the only lockfile). The requested runtime target is Node 22; `package.json` now declares Node 22 and starts the standalone server with `node`. The actual server runtime remains unverified.
- ORM/database: Prisma 6.11.x, MySQL provider. The schema includes a company-scoped admissions CRM/quotation delta and an admin OTP challenge table. Checked-in migrations add the CRM tables and OTP challenge table, but the legacy schema still has no reviewed baseline migration.
- Intended application endpoint: `127.0.0.1:3017` (repository config only; live listener is unverified).
- `Caddyfile` is a repository config example for `learn.aloeducation.com` → `127.0.0.1:3017`; it does not prove Caddy is installed or configured on the production host. No live Nginx/Caddy configuration was inspected.
- No production `.env` is present in this checkout. `.env.example` is not a production configuration and contains no real credentials.

## Production blockers

1. **Authentication is implemented but not production-verified.** A single-admin NextAuth Credentials flow uses a scrypt password hash, a required production SMS one-time code, and a signed JWT session; middleware protects application pages and API routes in production (except `/login`, `/api/auth/*`, and low-detail `/api/health`). Configure `NEXTAUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_OTP_PHONE`, `HTTPSMS_API_KEY`, and `HTTPSMS_FROM`. The httpSMS-compatible API's accepted response means queued, not delivered; actual SMS, handset, and proxy/cookie behavior have not been tested. OTP codes are five-minute, single-use challenges with a three-send/hour and five-attempt limit; there is still no general login/API rate limit, RBAC, or multi-user identity model. Complete end-to-end login and protected-route tests before exposure.
2. **Database change strategy is not production-safe yet.** The checked-in migrations add CRM tables and an OTP challenge table; they do not establish a baseline for the existing 27 legacy models/tables. Do not run `prisma db push`, `prisma migrate reset`, or `prisma migrate deploy` against production until the actual MySQL schema is inspected and backed up, a baseline plan is reviewed, and all deltas have been validated against that schema.
3. **The workflow on the audited `main` commit is not safe to run.** At SHA `03361c5f6bf19727907452ed0edc5247948b9466`, `.github/workflows/deploy.yml` auto-triggered on `main`, assumed Bun and PM2, defaulted to the unverified path `/root/alo-github-verify`, had no verified SSH host-key pin, only implemented a SQLite backup path (not a MySQL backup), ran `prisma db push`, did not reliably pass the workflow commit SHA to the remote shell, and contained `|| true` failure suppression. This working branch replaces that workflow with a manual fail-closed gate; **it does not deploy**. Merge only after reviewing the gate and completing the actual host, authentication, migration, and rollback audit.
4. **Host details and server state are unknown.** The actual host/IP, SSH port/user, application user/path, Ubuntu version, Node/MySQL/Redis versions, process manager, listeners, firewall, and deployed SHA have not been inspected. Values in old repository docs/config are not verified and must not be reused.
5. **External integrations are not production-verified.** AI/media generation uses only private local Ollama/ComfyUI endpoints, local Piper/eSpeak, FFmpeg, and a built-in procedural instrumental generator; no paid AI API is configured. Model installation and media runtime are not verified. See `LOCAL_AI.md`. Administrator OTP can call an operator-configured HTTPSMS-compatible HTTP gateway; no SMS has been sent here and the gateway's accepted response is not proof of handset delivery. Email marketing remains draft-only: no SMTP/Resend sender, consent ledger, unsubscribe endpoint, or delivery integration is configured. Redis and n8n are not application adapters and must not be reported healthy based on environment-variable names alone.
6. **Upload storage is not configurable.** `src/app/api/family-studio/route.ts` writes under `process.cwd()/storage/uploads/family`; it does not use `UPLOAD_DIR`. Asset deletion now constrains stored paths to that directory, but upload size/MIME validation, retention, backup, and the production storage path still need review before accepting real uploads.
7. **Repository history contains public business data.** The GitHub repository is public. Commit `e95b39b` contains `storage/backups/backup_1786236820070.alo.bak`, a 266,240-byte XOR-obfuscated SQLite snapshot. It decodes to 15 tables and 383 rows. The file was removed from the current tree but remains reachable in Git history. No high-confidence credential pattern was found in the targeted scan; that does not undo the business-data exposure. See `SECURITY.md` and `audit/05-EXPOSURE-REMEDIATION.md`.
8. **Production runtime and database are not verified.** Bun is not installed in this Arena environment. `npm install --package-lock=false` was used for checks; this is not a frozen install from `bun.lock`. Typecheck, ESLint, and the Next.js production build pass. Prisma schema validation passed using the bundled JS/WASM schema-engine path; the client was generated in `engine=none` mode only to compile without the Prisma binary-download host. The build did not query MySQL or exercise that runtime client. No test suite or live database/SMS/media integration was available. Repeat the project-lockfile install, standard Prisma generation with its runtime engine, production build, and end-to-end checks in a supported environment. Next.js 16.4.0 still warns that the `middleware` convention is deprecated; migration to `proxy` remains unverified. The latest GitHub `Deploy to VPS` run (2026-09-30, SHA `03361c5f6bf19727907452ed0edc5247948b9466`) failed; its log could not be retrieved, so the precise failure is unknown. No successful deployment or deployed SHA was established.

## Safe repository checks

Use the project's lockfile/package manager; do not substitute `npm ci` (there is no `package-lock.json`). On a machine with Bun 1.3+ and Node 22 installed:

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
DATABASE_URL='mysql://user:placeholder@127.0.0.1:3306/db_learn' bunx prisma validate
DATABASE_URL='mysql://user:placeholder@127.0.0.1:3306/db_learn' bunx prisma generate
bun run build
```

There is currently no test script/test suite configured. A green build alone does not verify database migrations, authentication, external services, or production operation.

For development only, `bun run db:push` is a schema-sync convenience, not a production migration strategy. Never run `bun run db:push`, `bun run db:reset`, or `prisma db push` on production without a reviewed plan, a verified backup, and explicit approval.

## Host verification required before any deployment

Run these on the actual server using its verified access path; do not infer results from this repository:

```bash
cat /etc/os-release
uname -a
node -v && npm -v
mysql --version
redis-server --version
nginx -v 2>&1
sudo systemctl status mysql redis-server nginx --no-pager
sudo ss -lntp
sudo ufw status verbose
systemctl list-units --type=service --state=running
```

Identify the actual application service/process manager, application user/path, and reverse proxy before changing them. Do not expose SSH private keys, database passwords, or API keys in chat or Git. Store deployment credentials only in protected GitHub Actions secrets and verify the server ED25519 host fingerprint out-of-band.

## Required post-deployment checks

Only after authentication, migrations, backup/rollback, and deployment workflow are made safe, verify from the real host and an independent client:

```bash
curl -i http://127.0.0.1:3017/
curl -i http://127.0.0.1:3017/api/health
curl -i https://learn.aloeducation.com/
curl -i https://learn.aloeducation.com/api/health
curl -I http://learn.aloeducation.com/
echo | openssl s_client -connect learn.aloeducation.com:443 \
  -servername learn.aloeducation.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

Record the workflow SHA and server `git rev-parse HEAD`; they must match. Test real login/session/protected API behavior, database read/write, and every integration that the production application actually depends on. Mark anything not exercised as **NOT VERIFIED**.
