# ALO Learning Journey — Project Overview (Not Production Verified)

> **This file is not a production sign-off.** The application, server, database, domain, HTTPS, authentication, and external services have not been verified live. Do not expose this application publicly until the blockers in `SECURITY.md` and `DEPLOYMENT.md` are resolved.

## Local development only

The repository uses Bun (`bun.lock`) for dependency management and Prisma with MySQL. Configure a development MySQL database; do not copy production credentials into this checkout.

```bash
bun install --frozen-lockfile
cp .env.example .env
# Edit .env with a development-only MySQL URL.
bunx prisma generate
bun run db:push  # development only; never use as a production migration
bun run dev       # development server on port 3000
```

Production standalone startup is configured for Node.js 22 and the intended application port 3017, but the actual production server has not been inspected.

## Feature inventory — source presence is not live verification

The repository contains UI/API code for content generation, approvals, analytics, RAG, social integrations, Telegram, video, family media, backups, and operations. New modules include a company-scoped admissions CRM (pipeline, follow-ups, activity history), server-calculated quotations with print-to-PDF workflow, an editable campaign-kit library, and an OpenAPI 3.1 reference. Some paths use local fallbacks or demo behavior. Their presence does not prove that an external provider is configured or that a production workflow succeeds.

AI/media generation is now local-only in source: private Ollama for text, private ComfyUI for images, local Piper/eSpeak speech, FFmpeg rendering, and a built-in procedural instrumental synthesizer. The former hosted SDK dependency was removed. Missing local models are reported as template/placeholder fallbacks; local model installation and generated-media runtime remain unverified. See `LOCAL_AI.md`. Redis, n8n, and Resend integrations are not present in the application source.

The backup route's XOR obfuscation is **not encryption** and is not a safe production backup. It copies a local SQLite file even though Prisma is configured for MySQL. Do not rely on it for production backup or rollback.

## Production status

- Authentication: single-admin NextAuth credentials session and production middleware are implemented, but not live-verified. RBAC/multi-user roles are not implemented. Development mode bypasses middleware unless `ALO_REQUIRE_AUTH=true`.
- Database: MySQL Prisma schema has 31 models and one checked-in CRM delta migration. The legacy schema does not yet have a reviewed baseline migration; no production database change is approved.
- Upload storage: current code writes below the process working directory and does not honor the configured `UPLOAD_DIR`.
- CRM data: enquiry contact details and consent preferences are persisted per workspace. Do not store passports, immigration case files, health data, or payment-card details; secure CSV exports and apply a reviewed retention policy.
- Deployment: automatic pipeline implemented (PR → CI `validate` → merge to `main` → SSH deploy of the exact SHA with backup/migration/health gates → public health check). It becomes live only after the GitHub secrets/branch protection and one-time VPS setup in `DEPLOYMENT.md` are completed; no live deployment is verified yet.
- Build, login/session, API, storage, integrations, DNS, HTTPS, and live health: not verified.

See `DEPLOYMENT.md`, `SECURITY.md`, and `audit/` for the evidence and required follow-up.
