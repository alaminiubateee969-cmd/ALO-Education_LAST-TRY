# MIGRATION RECOVERY PLAN — ALO Learning Journey

**Date:** 2026-10-18 · **Preconditions:** merge of the repair PR to `main`, CI green (including the new isolated-MySQL migration job).
**Goal:** bring `db_learn` from "22 models + 1 join table, empty migration history" to "all 32 models + join table, consistent `_prisma_migrations`, zero data loss" — using only additive SQL.

---

## 0. Why this plan is safe (all verified in this session)

1. **The migration chain is purely additive.** All 3 migrations contain only `CREATE TABLE [IF NOT EXISTS]` — no `DROP`, `ALTER`, `TRUNCATE`, `DELETE`, `INSERT` (enforced by `tests/deploy-script.test.mjs`).
2. **The baseline tolerates pre-existing tables.** All 29 of its `CREATE TABLE` statements are `IF NOT EXISTS`; re-running against the 22 existing tables + join table is a no-op for them.
3. **Schema and migrations now match exactly.** `scripts/verify-migration-parity.mjs` reports exact parity after the `@db.Text`/`@db.LongText` fix (see `DATABASE-AUDIT.md` §2.3), and CI re-proves it on every PR — including a *real* `prisma migrate deploy` + `migrate diff --exit-code` drift gate against a disposable MySQL 8 service container.
4. **The deploy script cannot destroy data.** It takes a verified `mysqldump` backup (gzip integrity + content probe) **before** any migration, refuses to run destructive prisma commands, and rolls the *code* back on failure (the database is never auto-reverted).
5. **Destructive commands are guarded everywhere.** `npm run db:reset` / `db:migrate` / `db:push` now refuse to touch `db_learn` or any non-loopback host unless explicitly overridden (`scripts/safe-prisma.mjs`, exit 78).

## 1. Operator pre-flight (read-only, ~2 minutes, on the VPS)

Run these as the app user. Nothing here modifies the database.

```bash
cd /home/aloedu/projects/learn-aloeducation   # or the repo/ release dir
export $(grep -E '^DATABASE_URL=' shared/.env | xargs)   # do not echo it

# 1. Which of the 10 target tables already exist? (expect: none)
mysql -h 127.0.0.1 -u <user> -p <db> -e "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN ('AdminOtpChallenge','AgentMessage','Campaign',
      'ContentOpportunityScore','HookTest','InkboxIntegration','Lead',
      'LeadActivity','Quotation','QuotationItem');"

# 2. Migration history (expect: empty result / "3 migrations not yet applied")
npx prisma migrate status

# 3. Existing data is present (sanity: row counts on a few existing tables)
mysql -h 127.0.0.1 -u <user> -p <db> -e "
  SELECT 'Company' t, COUNT(*) FROM Company
  UNION ALL SELECT 'PublishedPost', COUNT(*) FROM PublishedPost
  UNION ALL SELECT 'AuditLog', COUNT(*) FROM AuditLog;"
```

**Decision table for step 1:**

| Probe result | Meaning | Action |
|---|---|---|
| 0 rows | Clean state assumed by this plan | Continue with §2 |
| 1–10 rows | Some tables were created manually after the audit | **STOP.** For each existing table compare its shape to the matching `CREATE TABLE` in `prisma/migrations/` (columns/indexes/FKs). If identical → `npx prisma migrate resolve --applied <migration>` **only for migrations whose *every* table exists and matches**, then re-run `migrate status` and continue. If any shape differs → do not deploy; export the table, reconcile manually, re-audit. |
| Probe errors (e.g. `SELECT` denied) | Grants too narrow | Fix grants first (blocker #1 in `DEPLOYMENT.md`); no migration is attempted |

## 2. Recovery execution (two supported paths)

### Path A — recommended: through the normal deploy pipeline

This is the designed path: the exact merged `main` SHA flows through CI → Tailscale preflight → production approval → `scripts/deploy-production.sh`, which performs:

```
lock → fetch SHA (must equal origin/main)
→ npm ci → prisma generate
→ mysqldump backup (gzip -t + content probe)        ← verified restore point
→ prisma migrate status (informational)
→ prisma migrate deploy                              ← applies the 3 migrations
→ npm run build → atomic PM2 release switch
→ health gate on 127.0.0.1:3017/api/health (rollback on failure)
```

Operator steps:

1. Clear the five deployment blockers listed in `DEPLOYMENT.md` §Deployment blockers (P1010 grants, credential rotation, restore-tested backup, Sharp CPU probe, on-server rollback dry-run).
2. Set repository variable `VPS_DEPLOY_ENABLED=true` (Settings → Secrets and variables → Actions → Variables).
3. Confirm the `production` environment has Required reviewers configured.
4. Merge the repair PR (CI must be green), then approve the resulting `Deploy to VPS` run.

### Path B — manual, on the VPS (equivalent, for operators who prefer hands-on)

```bash
# 0. Backup FIRST and prove it restores (do not skip):
TS=$(date -u +%Y%m%d-%H%M%S)
mysqldump -h 127.0.0.1 -u <user> -p --single-transaction --no-tablespaces db_learn \
  | gzip > ~/db_learn-pre-recovery-$TS.sql.gz
gzip -t ~/db_learn-pre-recovery-$TS.sql.gz && echo "backup integrity OK"
# restore-test into a scratch database (on the VPS, then drop the scratch copy):
mysql -u root -p -e "CREATE DATABASE db_learn_restoretest"
zcat ~/db_learn-pre-recovery-$TS.sql.gz | mysql -u root -p db_learn_restoretest
mysql -u root -p -e "SELECT COUNT(*) FROM db_learn_restoretest.Company;"
mysql -u root -p -e "DROP DATABASE db_learn_restoretest"   # scratch copy only

# 1. Apply the additive chain (never `migrate dev` / `db push`):
cd <release-dir>
npx prisma migrate deploy

# 2. Verify green history:
npx prisma migrate status    # expect: "3 migrations found ... all applied" / exit 0

# 3. Verify the 10 tables now exist and the count is right:
mysql -h 127.0.0.1 -u <user> -p db_learn -e "
  SELECT COUNT(*) AS tables_total FROM information_schema.tables
  WHERE table_schema='db_learn';"   -- expect 34 (33 + _prisma_migrations)
```

### What `migrate deploy` will do on `db_learn` (statement-level prediction)

| Migration | Effect on existing data | New objects |
|---|---|---|
| `20261001000000_initial_baseline` | **None** — 23 of 29 `CREATE TABLE IF NOT EXISTS` are skipped (tables exist); the other 6 execute | `Campaign`, `ContentOpportunityScore`, `HookTest`, `InkboxIntegration`, `AgentMessage` (+`_prisma_migrations` row) |
| `20261010000000_admissions_crm_quotes` | None | `Lead`, `LeadActivity`, `Quotation`, `QuotationItem` (+4 FK constraints) |
| `20261010000001_admin_otp_challenges` | None | `AdminOtpChallenge` |

Idempotence at the workflow level: a **second** `migrate deploy` applies nothing (CI proves this on the isolated MySQL database every run).

## 3. Rollback procedure (verified mechanics, DB deliberately not auto-reverted)

Code rollback is automatic in `deploy-production.sh` (previous release symlink + PM2 reload). Database rollback is **manual by design** and only needed if a migration itself misbehaves:

```bash
# 1. Stop writes (single-admin app: pm2 stop learn-aloeducation)
pm2 stop learn-aloeducation

# 2. Restore the pre-recovery backup taken in §2 (Path B step 0 or the deploy's
#    shared/.backups/db-<ts>-<sha>.sql.gz):
mysql -u root -p -e "DROP DATABASE db_learn; CREATE DATABASE db_learn;"
zcat ~/db_learn-pre-recovery-$TS.sql.gz | mysql -u root -p db_learn

# 3. Restart the previous release:
cd /home/aloedu/projects/learn-aloeducation
pm2 startOrReload current/ecosystem.config.js --only learn-aloeducation
curl -s http://127.0.0.1:3017/api/health   # expect 200
```

Because all migrations are additive, a rollback never has to reverse DDL — the restored backup simply predates the new tables.

## 4. `prisma migrate resolve` — when it is (and is not) allowed

| Situation | `migrate resolve` allowed? |
|---|---|
| Production tables already match a migration's output exactly (proven by §1 probe + shape comparison) and history is empty | **Yes**, `--applied` for that migration only — but Path A/B make this unnecessary |
| Baseline only *partially* represented (current production state — 22/29 tables) | **No.** Marking it applied would lie about the 5 missing tables; use `migrate deploy` instead |
| A migration was applied and then manually reverted | No — restore from backup (§3) |

## 5. Success criteria (all must hold)

- [ ] `npx prisma migrate status` exits 0 on the VPS ("all migrations applied").
- [ ] `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='db_learn'` = **34** (32 model tables + `_FamilyProfileToFamilyProject` + `_prisma_migrations`).
- [ ] Pre-recovery row counts on existing tables unchanged (§1 probe 3 vs. after).
- [ ] `/api/health` → 200 on `127.0.0.1:3017` and via `https://learn.aloeducation.com` (once DNS/proxy are live).
- [ ] A restore-tested backup exists under `shared/.backups/` (deploy) or `~/` (manual).
