#!/usr/bin/env node
/**
 * verify-migration-parity.mjs — offline (engine-free) parity gate between
 * prisma/schema.prisma and the union of prisma/migrations/<name>/migration.sql.
 *
 * Checks, per table: existence, column names/order-independent set, nullability,
 * column types, defaults, PRIMARY KEY, secondary indexes (name + columns),
 * UNIQUE indexes, and foreign keys (column, referenced table/column,
 * ON DELETE / ON UPDATE actions).
 *
 * Also asserts: every model in the schema has a table, migration SQL never
 * drops/alters anything, and every CREATE TABLE uses the same
 * `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` tail so that
 * tables created by earlier `db push` runs and tables created by migrations
 * share one character set.
 *
 * No database and no Prisma engine required — safe for restricted sandboxes
 * and CI alike. Exit code 0 = exact parity, 1 = differences (printed).
 *
 * Usage: node scripts/verify-migration-parity.mjs [--schema prisma/schema.prisma]
 *                                                  [--migrations prisma/migrations]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const schemaPath = path.resolve(root, argValue("--schema", "prisma/schema.prisma"));
const migrationsDir = path.resolve(root, argValue("--migrations", "prisma/migrations"));

const SCALARS = new Set(["String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"]);

const errors = [];
const notes = [];
function fail(msg) {
  errors.push(msg);
}

// ── helpers ─────────────────────────────────────────────────────────────────
function stripLineComment(line) {
  let out = "";
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") {
        out += ch + (line[i + 1] ?? "");
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      out += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && line[i + 1] === "/") break;
    out += ch;
  }
  return out.trimEnd();
}

function splitTopLevel(text, sep = ",") {
  const parts = [];
  let depth = 0;
  let cur = "";
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      cur += ch;
      if (ch === "\\") {
        cur += text[i + 1] ?? "";
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function unquoteSql(id) {
  return id.replace(/`/g, "");
}

function sqlDefaultEquals(raw, expected) {
  if (raw === undefined && expected === undefined) return true;
  if (raw === undefined || expected === undefined) return false;
  const a = String(raw).trim().replace(/^'|"|'$/g, "").replace(/^"|"$/g, "");
  const b = String(expected).trim().replace(/^'/g, "").replace(/^"$/g, "");
  if (a === b) return true;
  const na = Number(a.replace(/'/g, ""));
  const nb = Number(b.replace(/'/g, ""));
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  // MySQL renders boolean defaults as true/false identically to Prisma SQL
  const norm = (s) => (s === "true" ? "1" : s === "false" ? "0" : s);
  return norm(a) === norm(b);
}

// ── 1. parse schema.prisma ─────────────────────────────────────────────────
function parseSchema(file) {
  const rawLines = readFileSync(file, "utf8").split(/\r?\n/).map(stripLineComment);
  const models = new Map(); // name -> { fields: Map, indexes: [], uniques: [], idFields: [] }

  let i = 0;
  while (i < rawLines.length) {
    const m = rawLines[i].match(/^model\s+(\w+)\s*\{$/);
    if (!m) {
      i++;
      continue;
    }
    const name = m[1];
    const model = { fields: new Map(), indexes: [], uniques: [], idFields: [] };
    let depth = 1;
    i++;
    for (; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;
      if (line === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
        continue;
      }
      // block-level attributes
      if (line.startsWith("@@")) {
        const idx = line.match(/^@@index\(\[([^\]]+)\]/);
        if (idx) {
          const cols = idx[1].split(",").map((s) => s.trim());
          const mapArg = line.match(/map\(\s*"([^"]+)"\s*\)/);
          model.indexes.push({ name: mapArg ? mapArg[1] : `${name}_${cols.join("_")}_idx`, cols });
        }
        const uniq = line.match(/^@@unique\(\[([^\]]+)\]/);
        if (uniq) {
          const cols = uniq[1].split(",").map((s) => s.trim());
          const mapArg = line.match(/map\(\s*"([^"]+)"\s*\)/);
          model.uniques.push({ name: mapArg ? mapArg[1] : `${name}_${cols.join("_")}_key`, cols });
        }
        const idAttr = line.match(/^@@id\(\[([^\]]+)\]/);
        if (idAttr) model.idFields.push(...idAttr[1].split(",").map((s) => s.trim()));
        continue;
      }
      // scalar / relation field
      const fm = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!fm) {
        fail(`schema: unparseable line in model ${name}: "${line}"`);
        continue;
      }
      const [, fName, fType, isList, isOptional, rest] = fm;
      const attrs = rest || "";
      const field = { name: fName, type: fType, isList: Boolean(isList), isOptional: Boolean(isOptional), attrs };

      if (attrs.startsWith("@relation") || !SCALARS.has(fType)) {
        // relation field — no column of its own; FK info (if any) is extracted
        // from @relation(fields: [..], references: [..]) below.
        const rel = attrs.match(/@relation\(\s*fields:\s*\[([^\]]+)\]\s*,\s*references:\s*\[([^\]]+)\](?:\s*,\s*onDelete:\s*(\w+))?(?:\s*,\s*onUpdate:\s*(\w+))?/);
        if (rel) {
          field.fk = {
            column: rel[1].split(",").map((s) => s.trim())[0],
            refField: rel[2].split(",").map((s) => s.trim())[0],
            onDelete: rel[3] || null,
            onUpdate: rel[4] || null,
            refModel: fType, // target model (may be list)
            relationField: fName,
          };
        } else if (attrs.startsWith("@relation")) {
          fail(`schema: model ${name} field ${fName}: @relation without fields/references cannot be a FK`);
        }
        field.relation = true;
        model.fields.set(fName, field);
        continue;
      }
      if (!SCALARS.has(fType)) {
        fail(`schema: model ${name} field ${fName}: unknown type ${fType}`);
        continue;
      }
      field.isId = /(^|\s)@id(\s|$)/.test(attrs);
      if (field.isId) model.idFields.push(fName);
      field.isUnique = /(^|\s)@unique(\s|$)/.test(attrs);
      if (field.isUnique && !attrs.includes("@unique()")) {
        model.uniques.push({ name: `${name}_${fName}_key`, cols: [fName] });
      }
      // default — balanced-paren extraction so `@default(0) @db.Decimal(12, 2)`
      // does not swallow the type attribute
      const defIdx = attrs.indexOf("@default(");
      if (defIdx >= 0) {
        let depth = 0;
        let end = -1;
        for (let ci = defIdx + "@default(".length - 1; ci < attrs.length; ci++) {
          if (attrs[ci] === "(") depth++;
          else if (attrs[ci] === ")") {
            depth--;
            if (depth === 0) {
              end = ci;
              break;
            }
          }
        }
        if (end > defIdx) field.default = attrs.slice(defIdx + "@default(".length, end);
      }
      // @db type override
      const dbType = attrs.match(/@db\.(\w+)(?:\(([^)]*)\))?/);
      if (dbType) field.db = { name: dbType[1], args: dbType[2] || "" };
      model.fields.set(fName, field);
    }
    models.set(name, model);
  }
  return models;
}

// schema type -> expected SQL type
function expectedSqlType(field) {
  switch (field.type) {
    case "String":
      if (field.db?.name === "Text") return "TEXT";
      if (field.db?.name === "MediumText") return "MEDIUMTEXT";
      if (field.db?.name === "LongText") return "LONGTEXT";
      if (field.db?.name === "VarChar") return `VARCHAR(${field.db.args})`;
      return "VARCHAR(191)";
    case "Int":
      return "INTEGER";
    case "BigInt":
      return "BIGINT";
    case "Float":
      return "DOUBLE";
    case "Decimal":
      if (field.db?.name === "Decimal") return `DECIMAL(${field.db.args})`.replace(/,\s*/, ", ");
      return "DECIMAL(65, 30)";
    case "Boolean":
      return "BOOLEAN";
    case "DateTime":
      return "DATETIME(3)";
    case "Json":
      return "JSON";
    case "Bytes":
      return "LONGBLOB";
    default:
      return null;
  }
}

function expectedDefault(field) {
  if (!("default" in field)) return undefined;
  const d = field.default;
  if (d === "now()") return "CURRENT_TIMESTAMP(3)";
  if (d === "cuid()" || d === "uuid()" || d === "cuid(2)") return undefined; // client-side
  if (d === "autoincrement()") return undefined; // handled as AUTO_INCREMENT
  if (/^".*"$/.test(d)) return d.slice(1, -1);
  if (d === "true" || d === "false") return d;
  if (/^-?\d+(\.\d+)?$/.test(d)) return d;
  if (d === "dbgenerated()") return undefined;
  fail(`schema: model default not understood: ${d}`);
  return d;
}

function normalizeAction(action) {
  if (!action) return null;
  const map = { Cascade: "CASCADE", SetNull: "SET NULL", SetDefault: "SET DEFAULT", Restrict: "RESTRICT", NoAction: "NO ACTION" };
  return map[action] ?? action.toUpperCase();
}

function parseMigrations(dir) {
  const tables = new Map(); // name -> table def
  const files = readdirSync(dir)
    .filter((f) => existsSync(path.join(dir, f, "migration.sql")))
    .sort();
  const statements = [];
  for (const f of files) {
    const sql = readFileSync(path.join(dir, f, "migration.sql"), "utf8");
    // reject destructive statements outright
    for (const banned of [/\bDROP\s+TABLE\b/i, /\bDROP\s+COLUMN\b/i, /\bTRUNCATE\b/i, /\bALTER\s+TABLE\b/i, /\bDELETE\s+FROM\b/i, /\bINSERT\s+INTO\b/i]) {
      if (banned.test(sql)) {
        fail(`migration ${f}: contains destructive/altering statement (${banned}) — migrations must be additive`);
      }
    }
    const re = /CREATE TABLE (?:IF NOT EXISTS )?`(\w+)`\s*\(([\s\S]*?)\)\s*DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci\s*;/g;
    let m;
    let consumed = 0;
    while ((m = re.exec(sql)) !== null) {
      consumed += m[0].length;
      statements.push({ file: f, name: m[1], body: m[2] });
    }
    // anything left besides comments/whitespace must be understood
    const residue = sql.replace(re, "").replace(/--[^\n]*/g, "").trim();
    if (residue) fail(`migration ${f}: unparsed SQL residue:\n${residue.slice(0, 400)}`);
    void consumed;
  }
  return { files, statements };
}

function parseTableBody(name, body) {
  const table = { name, columns: new Map(), pk: [], indexes: [], uniques: [], fks: [] };
  const parts = splitTopLevel(body);
  for (const part of parts) {
    if (/^PRIMARY KEY\s*\(/i.test(part)) {
      table.pk = part.match(/\(([^)]+)\)/)[1].split(",").map((c) => unquoteSql(c.trim()));
      continue;
    }
    const idx = part.match(/^(UNIQUE )?INDEX\s+`?(\w+)`?\s*\(([^)]+)\)/i);
    if (idx) {
      const cols = idx[3].split(",").map((c) => unquoteSql(c.trim()));
      (idx[1] ? table.uniques : table.indexes).push({ name: idx[2], cols });
      continue;
    }
    const fk = part.match(/^CONSTRAINT\s+`?(\w+)`?\s+FOREIGN KEY\s*\(`?(\w+)`?\)\s+REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)(?:\s+ON DELETE (\w+))?(?:\s+ON UPDATE (\w+))?/i);
    if (fk) {
      table.fks.push({ name: fk[1], column: fk[2], refTable: fk[3], refColumn: fk[4], onDelete: fk[5] || null, onUpdate: fk[6] || null });
      continue;
    }
    const col = part.match(/^`(\w+)`\s+([A-Z]+(?:\([^\)]*\))?)\s*(.*)$/i);
    if (col) {
      const rest = col[3];
      const notNull = /\bNOT NULL\b/i.test(rest);
      const autoInc = /\bAUTO_INCREMENT\b/i.test(rest);
      const defMatch = rest.match(/\bDEFAULT\s+('(?:[^'\\]|\\.)*'|[^\s]+)/i);
      table.columns.set(col[1], {
        type: col[2].toUpperCase().replace(/,\s*/, ", "),
        notNull,
        autoInc,
        default: defMatch ? defMatch[1] : undefined,
      });
      continue;
    }
    fail(`table ${name}: unparsed definition: "${part}"`);
  }
  return table;
}

// ── 3. compare ─────────────────────────────────────────────────────────────
const models = parseSchema(schemaPath);
const { files: migFiles, statements } = parseMigrations(migrationsDir);

if (models.size === 0) fail("schema: no models parsed");
if (statements.length === 0) fail("migrations: no CREATE TABLE parsed");

// implicit m2m join tables from implicit many-to-many relations (no @relation
// attributes on scalar list fields of two models) — Prisma materialises
// `_${A}To${B}` with A/B ordered alphabetically.
const expectedTables = new Map(); // sqlTable -> { source: modelName|null, def }
for (const [name, model] of models) {
  expectedTables.set(name, { source: name, model });
}
// detect implicit m2m: fields of type Model[] without @relation attrs
const m2mPairs = [];
for (const [name, model] of models) {
  for (const field of model.fields.values()) {
    if (!field.relation) continue;
    if (!field.isList) continue;
    if (field.attrs && field.attrs.includes("@relation")) continue; // explicit m2m or back-relation with attrs
    const other = field.type;
    if (!models.has(other)) continue;
    const otherModel = models.get(other);
    const back = [...otherModel.fields.values()].find((f) => f.relation && f.isList && f.type === name && !(f.attrs || "").includes("@relation"));
    if (!back) continue; // one-sided list is not a relation pair unless both sides exist — prisma requires both
    const [a, b] = [name, other].sort();
    m2mPairs.push(`${a}To${b}`);
  }
}
for (const pair of [...new Set(m2mPairs)]) {
  expectedTables.set(`_${pair}`, { source: null, join: pair });
}

const actualTables = new Map();
for (const st of statements) {
  if (actualTables.has(st.name)) fail(`migration duplicate CREATE TABLE ${st.name} (${st.file})`);
  actualTables.set(st.name, { ...st, def: parseTableBody(st.name, st.body) });
}

// table set
for (const name of expectedTables.keys()) {
  if (!actualTables.has(name)) fail(`table ${name}: present in schema but MISSING from migrations`);
}
for (const name of actualTables.keys()) {
  if (!expectedTables.has(name)) fail(`table ${name}: created by migrations but not expected from schema`);
}

// per-table detail comparison
for (const [name, exp] of expectedTables) {
  const act = actualTables.get(name);
  if (!act) continue;
  const t = act.def;

  if (exp.join) {
    // implicit join table: columns A,B both NOT NULL, PK(A,B), 2 FKs, unique pair index per prisma
    for (const c of ["A", "B"]) {
      if (!t.columns.has(c)) fail(`join table ${name}: missing column ${c}`);
      else if (!t.columns.get(c).notNull) fail(`join table ${name}: column ${c} must be NOT NULL`);
    }
    const [m1, m2] = exp.join.replace(/^_/, "").split("To");
    const want = [
      { column: "A", refTable: m1, refColumn: "id" },
      { column: "B", refTable: m2, refColumn: "id" },
    ];
    for (const w of want) {
      const got = t.fks.find((f) => f.column === w.column);
      if (!got) fail(`join table ${name}: missing FK on ${w.column}`);
      else {
        if (got.refTable !== w.refTable) fail(`join table ${name}: FK ${w.column} references ${got.refTable}, expected ${w.refTable}`);
        if (got.refColumn !== w.refColumn) fail(`join table ${name}: FK ${w.column} references ${got.refTable}(${got.refColumn}), expected (${w.refColumn})`);
        if (got.onDelete !== "CASCADE") fail(`join table ${name}: FK ${w.column} ON DELETE ${got.onDelete}, expected CASCADE`);
        if (got.onUpdate !== "CASCADE") fail(`join table ${name}: FK ${w.column} ON UPDATE ${got.onUpdate}, expected CASCADE`);
      }
    }
    // Prisma implicit m2m join tables carry NO primary key: uniqueness comes
    // from the (A, B) UNIQUE index; B gets its own index for reverse lookups.
    if (t.pk.length > 0) fail(`join table ${name}: PRIMARY KEY [${t.pk.join(",")}] present — implicit m2m tables use a UNIQUE index, not a PK`);
    const uniq = t.uniques.find((u) => u.cols.length === 2 && u.cols.includes("A") && u.cols.includes("B"));
    if (!uniq) fail(`join table ${name}: missing UNIQUE index on (A, B)`);
    if (!t.indexes.some((ix) => ix.cols.length === 1 && ix.cols[0] === "B")) fail(`join table ${name}: missing index on (B)`);
    continue;
  }

  const model = exp.model;
  const scalarCols = [...model.fields.values()].filter((f) => !f.relation);

  // columns
  for (const f of scalarCols) {
    const col = t.columns.get(f.name);
    if (!col) {
      fail(`table ${name}: column ${f.name} missing in migrations`);
      continue;
    }
    const wantType = expectedSqlType(f);
    if (wantType && col.type !== wantType) {
      fail(`table ${name}.${f.name}: type ${col.type} != expected ${wantType}`);
    }
    const wantNotNull = !f.isOptional;
    if (col.notNull !== wantNotNull) {
      fail(`table ${name}.${f.name}: ${col.notNull ? "NOT NULL" : "NULL"} != expected ${wantNotNull ? "NOT NULL" : "NULL"}`);
    }
    const wantDefault = expectedDefault(f);
    if (!sqlDefaultEquals(col.default, wantDefault)) {
      fail(`table ${name}.${f.name}: DEFAULT ${col.default ?? "(none)"} != expected ${wantDefault ?? "(none)"}`);
    }
    if (f.default === "autoincrement()" && !col.autoInc) fail(`table ${name}.${f.name}: expected AUTO_INCREMENT`);
  }
  for (const cName of t.columns.keys()) {
    if (!scalarCols.some((f) => f.name === cName)) fail(`table ${name}: column ${cName} in migrations but not in schema`);
  }

  // PK
  const wantPk = model.idFields.length ? [...model.idFields] : [];
  if (JSON.stringify([...t.pk].sort()) !== JSON.stringify([...wantPk].sort())) {
    fail(`table ${name}: PRIMARY KEY [${t.pk.join(",")}] != expected [${wantPk.join(",")}]`);
  }

  // indexes & uniques (by name and columns)
  const cmpIndexList = (kind, want, got) => {
    for (const w of want) {
      const g = got.find((x) => x.name === w.name);
      if (!g) {
        fail(`table ${name}: ${kind} ${w.name} missing in migrations`);
        continue;
      }
      if (JSON.stringify(g.cols) !== JSON.stringify(w.cols)) {
        fail(`table ${name}: ${kind} ${w.name} columns [${g.cols}] != expected [${w.cols}]`);
      }
    }
    for (const g of got) {
      if (!want.some((w) => w.name === g.name)) fail(`table ${name}: unexpected ${kind} ${g.name} in migrations`);
    }
  };
  cmpIndexList("index", model.indexes, t.indexes);
  cmpIndexList("unique index", model.uniques, t.uniques);

  // foreign keys — live on the relation field, referencing a scalar column
  const wantFks = [...model.fields.values()].filter((f) => f.fk);
  for (const f of wantFks) {
    const got = t.fks.find((k) => k.column === f.fk.column);
    if (!got) {
      fail(`table ${name}: FK on ${f.fk.column} missing in migrations`);
      continue;
    }
    const refTableName = f.fk.refModel;
    if (got.refTable !== refTableName) fail(`table ${name}: FK ${f.fk.column} → ${got.refTable} != expected ${refTableName}`);
    if (got.refColumn !== f.fk.refField) fail(`table ${name}: FK ${f.fk.column} → ${got.refTable}(${got.refColumn}) != expected (${f.fk.refField})`);
    const wantDelete = normalizeAction(f.fk.onDelete) || null;
    if (got.onDelete !== wantDelete) fail(`table ${name}: FK ${f.fk.column} ON DELETE ${got.onDelete} != expected ${wantDelete ?? "(none)"}`);
    if (got.onUpdate !== "CASCADE") fail(`table ${name}: FK ${f.fk.column} ON UPDATE ${got.onUpdate} != expected CASCADE`);
  }
  for (const k of t.fks) {
    if (!wantFks.some((f) => f.fk.column === k.column)) fail(`table ${name}: unexpected FK on ${k.column} in migrations`);
  }
}

// FK columns referenced models must exist as tables (order-independence note)
for (const t of actualTables.values()) {
  for (const k of t.def.fks) {
    if (!expectedTables.has(k.refTable)) fail(`table ${t.name}: FK references unknown table ${k.refTable}`);
  }
}

// ── report ─────────────────────────────────────────────────────────────────
const modelCount = models.size;
const tableCount = expectedTables.size;
const migTableCount = actualTables.size;
const migLineCount = migFiles.reduce((n, f) => n + readFileSync(path.join(migrationsDir, f, "migration.sql"), "utf8").split(/\r?\n/).length, 0);

console.log(`schema models        : ${modelCount}`);
console.log(`expected tables      : ${tableCount} (${modelCount} models + ${tableCount - modelCount} implicit join)`);
console.log(`migration CREATE TABL: ${migTableCount}`);
console.log(`migration files      : ${migFiles.length} (${migLineCount} lines)`);
console.log(`implicit m2m tables  : ${[...expectedTables.values()].filter((t) => t.join).map((t) => "_" + t.join).join(", ") || "(none)"}`);

if (errors.length) {
  console.error(`\nPARITY FAILED — ${errors.length} difference(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("\nPARITY OK — schema and migrations describe the identical database.");
for (const n of notes) console.log(`  note: ${n}`);
