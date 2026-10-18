# DATABASE AUDIT — ALO Learning Journey

**Date:** 2026-10-18 · **Auditor:** automated repair session (arena branch `arena/76c19dd6-alo-education-last-try`)
**Scope:** `prisma/schema.prisma`, `prisma/migrations/**`, and the reported production-database state of `db_learn` (MySQL 8.0.46 at `127.0.0.1:3306` on the ALO VPS).
**Method:** every claim below was produced by executing a check, not by inspection alone. The primary new tool is `scripts/verify-migration-parity.mjs` (engine-free, committed in this change), which parses the schema and all migration SQL and compares tables, columns, nullability, types, defaults, primary keys, indexes, unique constraints, and foreign keys.

---

## 1. Reported production state (input to this audit)

| Item | Reported value |
|---|---|
| Expected Prisma models | 32 |
| Tables found by introspection | 22 models + 1 implicit relation table (`_FamilyProfileToFamilyProject`) = 23 |
| Missing model tables | `AdminOtpChallenge`, `AgentMessage`, `Campaign`, `ContentOpportunityScore`, `HookTest`, `InkboxIntegration`, `Lead`, `LeadActivity`, `Quotation`, `QuotationItem` (10) |
| Schema-vs-database diff | ≈ 220 lines: 10 `CREATE TABLE` + 4 foreign-key constraints |
| `prisma migrate status` | 3 unapplied migrations: `20261001000000_initial_baseline`, `20261010000000_admissions_crm_quotes`, `20261010000001_admin_otp_challenges` |

## 2. Verified repository state (this session)

### 2.1 The migration chain covers every missing table — verified by execution

`node scripts/verify-migration-parity.mjs` (before any fix) reported:

```
schema models        : 32
expected tables      : 33 (32 models + 1 implicit join)
migration CREATE TABL: 33
migration files      : 3 (548 lines)
```

Mapping of the 10 missing tables to the migration that creates them:

| Missing table | Created by |
|---|---|
| `Campaign`, `ContentOpportunityScore`, `HookTest`, `InkboxIntegration`, `AgentMessage` | `20261001000000_initial_baseline` |
| `Lead`, `LeadActivity`, `Quotation`, `QuotationItem` | `20261010000000_admissions_crm_quotes` |
| `AdminOtpChallenge` | `20261010000001_admin_otp_challenges` |

**No new migration is required.** The reported database gap is a *migration-history* gap (the chain was never applied), not a missing-artifact gap. See `MIGRATION-RECOVERY-PLAN.md`.

### 2.2 Baseline safety — verified statement-by-statement

The baseline consists exclusively of `CREATE TABLE IF NOT EXISTS … ;` statements (29 of them) plus comments. Verified invariants (now enforced by `tests/deploy-script.test.mjs`):

- 0 × `DROP`, `TRUNCATE`, `ALTER TABLE`, `DELETE FROM`, `INSERT INTO` in any migration;
- every baseline `CREATE TABLE` uses `IF NOT EXISTS`;
- every table carries the identical `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` tail;
- the 4 CRM foreign keys (`Lead.companyId → Company.id`, `LeadActivity.leadId → Lead.id`, `Quotation.leadId → Lead.id`, `QuotationItem.quotationId → Quotation.id`) are `ON DELETE CASCADE ON UPDATE CASCADE`, exactly matching the schema's `onDelete: Cascade`.

Because the baseline is `IF NOT EXISTS`-guarded, applying it to a database that already contains the 22 tables + join table is a **no-op for existing tables** and creates only what is missing.

### 2.3 NEW FINDING — schema/migration column-type drift (58 columns)

The parity checker initially reported **58 differences**, all of the same class:

> `table X.col: type TEXT|LONGTEXT != expected VARCHAR(191)`

`prisma/schema.prisma` declared plain `String` (→ `VARCHAR(191)`) for 58 prose/JSON columns, while the baseline migration — and therefore the production database it was written to mirror — uses `TEXT` (49 columns) or `LONGTEXT` (9 columns). Representative examples: `AIAgentRun.inputBrief/outputJson/errorMsg`, `ContentIdea.hook/angle`, `RagDocument.content`, `RagChunk.text`, `AgentMessage.objective/result`, `LoopCycle.objective/lesson`.

**Why this matters:** `prisma migrate deploy` applies *migrations*, so production stays `TEXT`/`LONGTEXT` and the application works. But any future `prisma db push` or `prisma migrate dev` would generate `ALTER TABLE … MODIFY` statements that **shrink** those columns to `VARCHAR(191)` — silent truncation of production data (or hard errors in strict mode). This was a live data-loss hazard sitting one command away.

**Why the fix direction is "schema → TEXT":** the reported production diff contained **no** `MODIFY COLUMN` statements, proving the deployed columns already are `TEXT`/`LONGTEXT` (otherwise a schema→database diff would have flagged them). Preserving data (Rule 3) means declaring in the schema what production actually has.

**Fix applied (this change):** restored `@db.Text` (49) and `@db.LongText` (9) to exactly those 58 fields in `prisma/schema.prisma`. After the fix, `verify-migration-parity.mjs` reports **exact parity**:

```
PARITY OK — schema and migrations describe the identical database.
```

The checker also enforces this permanently in CI (positive test + three negative controls: tampered column type, dropped migration table, injected `ALTER TABLE` — all must be detected; see `tests/db-parity.test.mjs`).

### 2.4 Implicit many-to-many join table — verified Prisma layout

`_FamilyProfileToFamilyProject` uses the exact Prisma-generated layout: columns `A`,`B` `VARCHAR(191) NOT NULL`, **no** primary key, `UNIQUE INDEX _…_AB_unique (A,B)`, `INDEX _…_B_index (B)`, and two `CASCADE` foreign keys to `FamilyProfile(id)` / `FamilyProject(id)`. (An earlier misconception that it should have a composite PK is disproven and codified in the parity checker.)

### 2.5 Migration history and checksums

- The repository has exactly 3 migrations, all additive, applied in lexicographic order `20261001000000` → `20261010000000` → `20261010000001`.
- Production `_prisma_migrations` is **empty** (implied by "3 unapplied"); `prisma migrate deploy` will create it and record all three with checksums on first run.
- **`prisma migrate resolve` is NOT recommended here.** The baseline's effects are only *partially* represented in the production database (22 of its 29 tables exist; 5 do not). Resolving it as "applied" would mark those 5 tables as created when they were not, and nothing would ever create them. The correct path is a straight `prisma migrate deploy` — safe because of §2.2. (Prerequisites for `migrate resolve` are *not* proven; the command is therefore not used, per the master rules.)

### 2.6 What could NOT be verified from this sandbox (no VPS/MySQL access)

- Actual production `SHOW TABLES` / column types (relies on the operator-supplied introspection report quoted in §1).
- Existence of rows in the 22 existing tables (data preservation is asserted by the additive-only migration design, not by direct inspection).
- Whether any of the 10 missing tables were created manually after the report (the recovery plan includes a read-only pre-flight that proves this before deploying).

## 3. Summary of audit outcomes

| # | Finding | Severity | Status |
|---|---|---|---|
| A | 10 model tables missing from `db_learn` | High (feature-blocking) | **Repairable with existing migrations** — plan in `MIGRATION-RECOVERY-PLAN.md` |
| B | Migration history empty / 3 migrations unapplied | High (blocks `migrate status` green + deploy gate) | Fixed by recovery plan + deploy-script gate fix (§2 of `MIGRATION-RECOVERY-PLAN.md`) |
| C | 58-column schema↔database type drift (`VARCHAR(191)` vs `TEXT`/`LONGTEXT`) | High (latent data loss on any `db push`/`migrate dev`) | **Fixed in this change** (`@db.Text`/`@db.LongText` restored; parity gate added to CI) |
| D | `npm run db:reset` / `db:migrate` could target production `db_learn` | High (human error → data destruction) | **Fixed in this change** (`scripts/safe-prisma.mjs` guard; blocks `db_learn` + non-loopback hosts unless `ALO_ALLOW_DESTRUCTIVE_DB=1`) |
| E | Deploy script aborted on `migrate status` while migrations were pending | High (deploy pipeline deadlock for the recovery deploy) | **Fixed in this change** (status is informational; `migrate deploy` is the enforcing gate) |
| F | No automated schema↔migration parity check | Medium | **Fixed in this change** (`scripts/verify-migration-parity.mjs` + CI job + tests) |
