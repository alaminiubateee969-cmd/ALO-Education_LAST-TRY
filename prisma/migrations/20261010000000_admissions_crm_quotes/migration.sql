-- Add a small, company-scoped admissions CRM and printable quotation records.
-- Does not alter or backfill existing application tables.
CREATE TABLE `Lead` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `targetCountry` VARCHAR(191) NULL,
  `studyLevel` VARCHAR(191) NULL,
  `courseInterest` VARCHAR(191) NULL,
  `intake` VARCHAR(191) NULL,
  `source` VARCHAR(191) NOT NULL DEFAULT 'website',
  `stage` VARCHAR(191) NOT NULL DEFAULT 'new',
  `consentStatus` VARCHAR(191) NOT NULL DEFAULT 'unknown',
  `consentRecordedAt` DATETIME(3) NULL,
  `nextFollowUp` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Lead_companyId_stage_idx` (`companyId`, `stage`),
  INDEX `Lead_companyId_nextFollowUp_idx` (`companyId`, `nextFollowUp`),
  INDEX `Lead_companyId_createdAt_idx` (`companyId`, `createdAt`),
  INDEX `Lead_email_idx` (`email`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Lead_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LeadActivity` (
  `id` VARCHAR(191) NOT NULL,
  `leadId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'note',
  `body` TEXT NOT NULL,
  `actor` VARCHAR(191) NOT NULL DEFAULT 'admin',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `LeadActivity_leadId_createdAt_idx` (`leadId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `LeadActivity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Quotation` (
  `id` VARCHAR(191) NOT NULL,
  `leadId` VARCHAR(191) NOT NULL,
  `number` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'GBP',
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `validUntil` DATETIME(3) NULL,
  `terms` TEXT NULL,
  `notes` TEXT NULL,
  `acceptedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Quotation_number_key` (`number`),
  INDEX `Quotation_leadId_status_idx` (`leadId`, `status`),
  INDEX `Quotation_createdAt_idx` (`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Quotation_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QuotationItem` (
  `id` VARCHAR(191) NOT NULL,
  `quotationId` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unitPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `lineTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `position` INTEGER NOT NULL DEFAULT 0,
  INDEX `QuotationItem_quotationId_position_idx` (`quotationId`, `position`),
  PRIMARY KEY (`id`),
  CONSTRAINT `QuotationItem_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
