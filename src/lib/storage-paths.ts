import path from "node:path";

function resolveStorageSubdir(envValue: string | undefined, defaultRel: string): string {
  const raw = envValue?.trim();
  if (!raw) return path.join(/*turbopackIgnore: true*/ process.cwd(), defaultRel);
  const resolved = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(/*turbopackIgnore: true*/ process.cwd(), raw);
  return resolved;
}

export function getUploadRootDir(): string {
  return resolveStorageSubdir(process.env.UPLOAD_DIR, path.join("storage", "uploads"));
}

export function getFamilyUploadDir(): string {
  return path.join(getUploadRootDir(), "family");
}

export function getVideoStorageDir(): string {
  return resolveStorageSubdir(process.env.VIDEO_DIR, path.join("storage", "videos"));
}

export function getAudioStorageDir(): string {
  return path.join(process.cwd(), "storage", "audio");
}

export function getSceneAssetStorageDir(): string {
  return path.join(process.cwd(), "storage", "scene-assets");
}

export function getBackupStorageDir(): string {
  return path.join(process.cwd(), "storage", "backups");
}
