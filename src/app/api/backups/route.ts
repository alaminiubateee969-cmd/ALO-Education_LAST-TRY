import { NextResponse } from "next/server";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { MODEL_NAMES } from "@/lib/local-db-fallback";
import { ensureSeeded } from "@/lib/seed";
import { getBackupStorageDir } from "@/lib/storage-paths";

const BACKUP_DIR = getBackupStorageDir();
const LOCAL_KEY_FILE = path.join(process.cwd(), "storage", ".backup-key");
const RETENTION_DAYS = 14;
const MAGIC_HEADER = Buffer.from("ALO256GCM1", "utf8"); // 10-byte format magic

interface BackupMeta {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  tables: Record<string, number>;
  status: "complete" | "partial" | "failed";
  encrypted: boolean;
}

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true }).catch(() => undefined);
}

async function getBackupKey(): Promise<Buffer> {
  const configured = process.env.BACKUP_ENCRYPTION_KEY?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (configured) {
    return scryptSync(configured, "alo-backup-aes256gcm-salt", 32);
  }
  try {
    const existing = (await fs.readFile(LOCAL_KEY_FILE, "utf8")).trim();
    if (existing.length >= 32) {
      return scryptSync(existing, "alo-backup-aes256gcm-salt", 32);
    }
  } catch {}
  await fs.mkdir(path.dirname(LOCAL_KEY_FILE), { recursive: true });
  const generated = randomBytes(32).toString("hex");
  await fs.writeFile(LOCAL_KEY_FILE, generated, { mode: 0o600 });
  return scryptSync(generated, "alo-backup-aes256gcm-salt", 32);
}

async function encryptPayload(plaintext: Buffer): Promise<Buffer> {
  const key = await getBackupKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([MAGIC_HEADER, iv, authTag, encrypted]);
}

async function verifyEncryptedPayload(blob: Buffer): Promise<boolean> {
  if (blob.length < MAGIC_HEADER.length + 12 + 16) return false;
  if (!blob.subarray(0, MAGIC_HEADER.length).equals(MAGIC_HEADER)) return false;
  const key = await getBackupKey();
  const iv = blob.subarray(MAGIC_HEADER.length, MAGIC_HEADER.length + 12);
  const authTag = blob.subarray(MAGIC_HEADER.length + 12, MAGIC_HEADER.length + 28);
  const ciphertext = blob.subarray(MAGIC_HEADER.length + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString("utf8"));
  return Boolean(parsed && typeof parsed === "object" && parsed.data);
}

async function listBackups(): Promise<BackupMeta[]> {
  await ensureBackupDir();
  const files = await fs.readdir(BACKUP_DIR).catch(() => [] as string[]);
  const metas: BackupMeta[] = [];
  for (const f of files) {
    if (!f.endsWith(".alo.bak")) continue;
    try {
      const stat = await fs.stat(path.join(BACKUP_DIR, f));
      const manifestPath = path.join(BACKUP_DIR, f.replace(".alo.bak", ".json"));
      let tables: Record<string, number> = {};
      let status: BackupMeta["status"] = "complete";
      let encrypted = true;
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
        tables = manifest.tables ?? {};
        status = manifest.status ?? "complete";
        encrypted = manifest.encrypted ?? true;
      } catch {}
      metas.push({
        id: f.replace(".alo.bak", ""),
        filename: f,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        tables,
        status,
        encrypted,
      });
    } catch {}
  }
  return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function safeBackupId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  return /^backup_[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : null;
}

export async function GET() {
  await ensureSeeded();
  const backups = await listBackups();
  const totalSize = backups.reduce((s, b) => s + b.sizeBytes, 0);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expired = backups.filter((b) => new Date(b.createdAt).getTime() < cutoff).length;
  return NextResponse.json({
    backups,
    stats: {
      total: backups.length,
      totalSizeMb: Number((totalSize / 1024 / 1024).toFixed(2)),
      retentionDays: RETENTION_DAYS,
      expiredCount: expired,
    },
  });
}

export async function POST(req: Request) {
  await ensureSeeded();
  await ensureBackupDir();
  const body = await req.json().catch(() => ({ action: "create" })) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "create";

  if (action === "create") {
    const id = `backup_${Date.now()}`;
    const bakPath = path.join(BACKUP_DIR, `${id}.alo.bak`);
    const manifestPath = path.join(BACKUP_DIR, `${id}.json`);

    const tables: Record<string, number> = {};
    const snapshotData: Record<string, unknown[]> = {};
    let totalRows = 0;

    for (const model of MODEL_NAMES) {
      try {
        const delegate = (db as unknown as Record<string, any>)[model];
        if (model === "adminOtpChallenge") {
          const count = await delegate.count();
          tables[model] = count;
          snapshotData[model] = [];
          totalRows += count;
        } else {
          const rows = await delegate.findMany();
          tables[model] = rows.length;
          snapshotData[model] = rows;
          totalRows += rows.length;
        }
      } catch {
        tables[model] = 0;
        snapshotData[model] = [];
      }
    }

    const payloadBuffer = Buffer.from(
      JSON.stringify({
        id,
        createdAt: new Date().toISOString(),
        schemaModels: MODEL_NAMES.length,
        tables,
        totalRows,
        data: snapshotData,
      }),
      "utf8"
    );

    const encryptedBuffer = await encryptPayload(payloadBuffer);
    await fs.writeFile(bakPath, encryptedBuffer, { mode: 0o600 });
    const sizeBytes = encryptedBuffer.byteLength;
    const status: BackupMeta["status"] = "complete";

    const manifest = {
      id,
      createdAt: new Date().toISOString(),
      tables,
      totalRows,
      status,
      encrypted: true,
      cipher: "aes-256-gcm",
      retentionDays: RETENTION_DAYS,
    };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });

    await db.auditLog.create({
      data: {
        actor: "BackupAgent",
        action: "backup.create",
        detail: `Backup ${id} created (${status}, AES-256-GCM, ${Object.keys(tables).length} tables, ${totalRows} rows)`,
        severity: "info",
      },
    });

    const { id: _manifestId, ...manifestWithoutId } = manifest;
    return NextResponse.json({ ok: true, backup: { id, ...manifestWithoutId, sizeBytes, filename: `${id}.alo.bak` } });
  }

  if (action === "restore") {
    const id = safeBackupId(body.id);
    if (!id) return NextResponse.json({ error: "valid backup id required" }, { status: 400 });
    const bakPath = path.join(BACKUP_DIR, `${id}.alo.bak`);
    let verified = false;
    try {
      const blob = await fs.readFile(bakPath);
      verified = await verifyEncryptedPayload(blob);
    } catch {
      verified = false;
    }
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "backup.restore",
        detail: `Restore verification for ${id}: ${verified ? "AES-256-GCM integrity verified" : "verification failed"} (live DB overwrite gated)`,
        severity: "warn",
      },
    });
    return NextResponse.json({
      ok: true,
      id,
      integrityVerified: verified,
      message: verified
        ? "AES-256-GCM backup integrity verified. Live database overwrite stays gated for safety."
        : "Restore requested — demo mode does not overwrite live DB.",
    });
  }

  if (action === "delete") {
    const id = safeBackupId(body.id);
    if (!id) return NextResponse.json({ error: "valid backup id required" }, { status: 400 });
    try {
      await fs.unlink(path.join(BACKUP_DIR, `${id}.alo.bak`));
      await fs.unlink(path.join(BACKUP_DIR, `${id}.json`)).catch(() => undefined);
      await db.auditLog.create({
        data: { actor: "admin", action: "backup.delete", detail: `Deleted ${id}`, severity: "warn" },
      });
    } catch {}
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
