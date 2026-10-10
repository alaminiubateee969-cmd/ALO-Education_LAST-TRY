import { scryptSync, timingSafeEqual } from "node:crypto";
import { isAdminAuthenticationConfigured, isAdminOtpRequired } from "@/lib/auth-config";

export { isAdminOtpRequired };

function safeEqualText(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

/**
 * Password hashes use `scrypt$<base64url salt>$<base64url hash>`.
 * The hash is intentionally configured out-of-band; no default password exists.
 */
export function verifyAdminCredentials(email: string, password: string): boolean {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const encodedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!configuredEmail || !encodedHash || !email || !password) return false;
  if (!safeEqualText(email.trim().toLowerCase(), configuredEmail)) return false;

  const [algorithm, encodedSalt, encodedExpected] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedExpected) return false;

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expected = Buffer.from(encodedExpected, "base64url");
    if (salt.length < 16 || expected.length < 32 || expected.length > 128) return false;

    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function isAdminAuthConfigured(): boolean {
  return isAdminAuthenticationConfigured();
}
