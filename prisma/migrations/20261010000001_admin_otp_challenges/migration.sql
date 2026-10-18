-- Store only keyed hashes of a single-admin SMS OTP and its configured recipient.
-- The application enforces five-minute expiry, one-use consumption, resend limits,
-- and a five-attempt verification cap; the SMS delivery provider is operator-configured.
CREATE TABLE `AdminOtpChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `phoneHash` VARCHAR(191) NOT NULL,
  `otpHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `failedAttempts` INTEGER NOT NULL DEFAULT 0,
  `sentAt` DATETIME(3) NULL,
  `windowStartedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sendCount` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `AdminOtpChallenge_phoneHash_key` (`phoneHash`),
  INDEX `AdminOtpChallenge_expiresAt_consumedAt_idx` (`expiresAt`, `consumedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
