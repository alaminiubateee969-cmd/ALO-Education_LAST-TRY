import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { isAdminOtpDeliveryConfigured } from "@/lib/auth-config";

const OTP_TTL_MS = 5 * 60 * 1_000;
const RESEND_WINDOW_MS = 60 * 1_000;
const RATE_WINDOW_MS = 60 * 60 * 1_000;
const MAX_SENDS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;

export class AdminOtpRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("OTP request rate limit reached");
    this.name = "AdminOtpRateLimitError";
  }
}

function settings() {
  if (!isAdminOtpDeliveryConfigured()) throw new Error("SMS OTP delivery is not configured");
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  const recipient = process.env.ADMIN_OTP_PHONE!.trim();
  const sender = process.env.HTTPSMS_FROM!.trim();
  const apiKey = process.env.HTTPSMS_API_KEY!.trim();
  const baseUrl = (process.env.HTTPSMS_BASE_URL?.trim() || "https://api.httpsms.com").replace(/\/+$/, "");
  if (!secret) throw new Error("OTP signing secret is missing");
  return { secret, recipient, sender, apiKey, baseUrl };
}

function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

/** Queue one OTP to the fixed administrator phone; never returns the code. */
export async function queueAdminOtp(): Promise<{ status: "queued" }> {
  const config = settings();
  const phoneHash = hmac(config.secret, `admin-otp-phone:${config.recipient}`);
  const now = new Date();
  const previous = await db.adminOtpChallenge.findUnique({ where: { phoneHash } });

  if (previous?.sentAt) {
    const resendWait = RESEND_WINDOW_MS - (now.getTime() - previous.sentAt.getTime());
    if (resendWait > 0) throw new AdminOtpRateLimitError(Math.ceil(resendWait / 1_000));
  }
  const withinRateWindow = Boolean(previous && now.getTime() - previous.windowStartedAt.getTime() < RATE_WINDOW_MS);
  const sendCount = withinRateWindow ? previous!.sendCount : 0;
  if (sendCount >= MAX_SENDS_PER_WINDOW) {
    const retryAfter = RATE_WINDOW_MS - (now.getTime() - previous!.windowStartedAt.getTime());
    throw new AdminOtpRateLimitError(Math.max(1, Math.ceil(retryAfter / 1_000)));
  }

  const code = String(randomInt(100_000, 1_000_000));
  const otpHash = hmac(config.secret, `admin-otp-code:${phoneHash}:${code}`);
  const windowStartedAt = withinRateWindow ? previous!.windowStartedAt : now;
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  const nextSendCount = sendCount + 1;

  if (previous) {
    const reserved = await db.adminOtpChallenge.updateMany({
      where: {
        id: previous.id,
        otpHash: previous.otpHash,
        sendCount: previous.sendCount,
        windowStartedAt: previous.windowStartedAt,
        sentAt: previous.sentAt,
      },
      data: {
        otpHash,
        expiresAt,
        consumedAt: null,
        failedAttempts: 0,
        sentAt: now,
        windowStartedAt,
        sendCount: nextSendCount,
      },
    });
    if (reserved.count !== 1) throw new AdminOtpRateLimitError(RESEND_WINDOW_MS / 1_000);
  } else {
    try {
      await db.adminOtpChallenge.create({
        data: {
          phoneHash,
          otpHash,
          expiresAt,
          failedAttempts: 0,
          sentAt: now,
          windowStartedAt: now,
          sendCount: 1,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new AdminOtpRateLimitError(RESEND_WINDOW_MS / 1_000);
      throw error;
    }
  }

  try {
    const endpoint = `${config.baseUrl}/v1/messages/send`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey },
      body: JSON.stringify({
        content: `ALO administrator sign-in code: ${code}. It expires in 5 minutes. Do not share this code.`,
        from: config.sender,
        to: config.recipient,
        request_id: randomUUID(),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`SMS gateway rejected the request (${response.status})`);
  } catch {
    await db.adminOtpChallenge.updateMany({
      where: { phoneHash, otpHash, consumedAt: null },
      data: { consumedAt: now },
    }).catch(() => undefined);
    throw new Error("SMS gateway did not accept the OTP request");
  }

  return { status: "queued" };
}

/** Atomically consume a valid code once, or count one failed attempt. */
export async function consumeAdminOtp(code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const config = settings();
  const phoneHash = hmac(config.secret, `admin-otp-phone:${config.recipient}`);
  const challenge = await db.adminOtpChallenge.findUnique({ where: { phoneHash } });
  const now = new Date();
  if (!challenge || challenge.consumedAt || challenge.expiresAt <= now || challenge.failedAttempts >= MAX_VERIFY_ATTEMPTS) return false;

  const candidateHash = hmac(config.secret, `admin-otp-code:${phoneHash}:${code}`);
  const expected = Buffer.from(challenge.otpHash, "hex");
  const candidate = Buffer.from(candidateHash, "hex");
  const matches = expected.length === candidate.length && timingSafeEqual(expected, candidate);
  const stateGuard = {
    id: challenge.id,
    otpHash: challenge.otpHash,
    failedAttempts: challenge.failedAttempts,
    expiresAt: { gt: now },
    consumedAt: null,
  };

  if (matches) {
    const consumed = await db.adminOtpChallenge.updateMany({ where: stateGuard, data: { consumedAt: now } });
    return consumed.count === 1;
  }

  await db.adminOtpChallenge.updateMany({
    where: stateGuard,
    data: { failedAttempts: { increment: 1 } },
  });
  return false;
}
