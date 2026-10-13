-- Baseline migration for the 26 core ALO Learning Journey models.
-- Uses CREATE TABLE IF NOT EXISTS so existing deployments can baseline safely.

CREATE TABLE IF NOT EXISTS `Company` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `domain` VARCHAR(191) NULL,
  `logoUrl` VARCHAR(191) NULL,
  `plan` VARCHAR(191) NOT NULL DEFAULT 'growth',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AIAgentRun` (
  `id` VARCHAR(191) NOT NULL,
  `agentId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'idle',
  `inputBrief` TEXT NULL,
  `outputJson` LONGTEXT NULL,
  `errorMsg` TEXT NULL,
  `retryCount` INTEGER NOT NULL DEFAULT 0,
  `costEstUsd` DOUBLE NOT NULL DEFAULT 0,
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AIAgentRun_agentId_idx` (`agentId`),
  INDEX `AIAgentRun_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ContentIdea` (
  `id` VARCHAR(191) NOT NULL,
  `topic` VARCHAR(191) NOT NULL,
  `hook` TEXT NOT NULL,
  `angle` TEXT NOT NULL,
  `audience` VARCHAR(191) NOT NULL,
  `ragSources` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'idea',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ContentIdea_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ContentPackage` (
  `id` VARCHAR(191) NOT NULL,
  `ideaId` VARCHAR(191) NULL,
  `topic` VARCHAR(191) NOT NULL,
  `reelScript` LONGTEXT NOT NULL,
  `hooksJson` LONGTEXT NOT NULL,
  `seoKeywords` TEXT NULL,
  `captionsJson` LONGTEXT NOT NULL,
  `hashtagsJson` TEXT NULL,
  `imagePrompt` TEXT NULL,
  `voiceDirection` TEXT NULL,
  `cta` TEXT NOT NULL,
  `disclaimerBn` TEXT NULL,
  `qualityScore` INTEGER NOT NULL DEFAULT 0,
  `safetyStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `ragCitations` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ContentPackage_safetyStatus_idx` (`safetyStatus`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ApprovalItem` (
  `id` VARCHAR(191) NOT NULL,
  `packageId` VARCHAR(191) NULL,
  `topic` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'content',
  `title` VARCHAR(191) NOT NULL,
  `summary` TEXT NOT NULL,
  `riskLevel` VARCHAR(191) NOT NULL DEFAULT 'low',
  `blockedReasons` TEXT NULL,
  `requiredEdits` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `reviewerNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,
  INDEX `ApprovalItem_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SocialConnection` (
  `id` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `accountName` VARCHAR(191) NOT NULL,
  `handle` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'not_connected',
  `scopesJson` TEXT NULL,
  `tokenExpiry` DATETIME(3) NULL,
  `lastSyncAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `SocialConnection_platform_accountName_key` (`platform`, `accountName`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RagDocument` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `sourceType` VARCHAR(191) NOT NULL DEFAULT 'manual',
  `sourceUrl` VARCHAR(191) NULL,
  `content` LONGTEXT NOT NULL,
  `tagsJson` TEXT NULL,
  `chunkCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RagChunk` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `text` LONGTEXT NOT NULL,
  `keywordsJson` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RagChunk_documentId_idx` (`documentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AnalyticsSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `metric` VARCHAR(191) NOT NULL,
  `value` INTEGER NOT NULL,
  `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AnalyticsSnapshot_platform_metric_idx` (`platform`, `metric`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TelegramCommand` (
  `id` VARCHAR(191) NOT NULL,
  `command` VARCHAR(191) NOT NULL,
  `args` TEXT NULL,
  `senderId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'received',
  `response` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `actor` VARCHAR(191) NOT NULL DEFAULT 'system',
  `action` VARCHAR(191) NOT NULL,
  `detail` TEXT NULL,
  `severity` VARCHAR(191) NOT NULL DEFAULT 'info',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuditLog_severity_idx` (`severity`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Notification` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `kind` VARCHAR(191) NOT NULL DEFAULT 'info',
  `read` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `FamilyModel` (
  `id` VARCHAR(191) NOT NULL,
  `characterName` VARCHAR(191) NOT NULL,
  `personType` VARCHAR(191) NOT NULL,
  `consentConfirmed` BOOLEAN NOT NULL DEFAULT false,
  `consentDate` DATETIME(3) NULL,
  `referenceImages` TEXT NULL,
  `voiceSample` VARCHAR(191) NULL,
  `appearanceJson` TEXT NULL,
  `voiceSettingsJson` TEXT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PublishedPost` (
  `id` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `providerPostId` VARCHAR(191) NULL,
  `url` VARCHAR(191) NULL,
  `topic` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedAt` DATETIME(3) NULL,
  `scheduledAt` DATETIME(3) NULL,
  `packageId` VARCHAR(191) NULL,
  INDEX `PublishedPost_status_idx` (`status`),
  INDEX `PublishedPost_platform_idx` (`platform`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CommentInbox` (
  `id` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `authorName` VARCHAR(191) NOT NULL,
  `authorHandle` VARCHAR(191) NULL,
  `text` TEXT NOT NULL,
  `postTopic` VARCHAR(191) NULL,
  `category` VARCHAR(191) NOT NULL DEFAULT 'safe_general',
  `riskLevel` VARCHAR(191) NOT NULL DEFAULT 'low',
  `status` VARCHAR(191) NOT NULL DEFAULT 'new',
  `draftReply` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `repliedAt` DATETIME(3) NULL,
  INDEX `CommentInbox_status_idx` (`status`),
  INDEX `CommentInbox_category_idx` (`category`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Department` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `family` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `agentCount` INTEGER NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Department_family_idx` (`family`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgentEmployee` (
  `id` VARCHAR(191) NOT NULL,
  `departmentId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL,
  `specialization` VARCHAR(191) NOT NULL,
  `capabilities` VARCHAR(191) NOT NULL,
  `tools` TEXT NOT NULL,
  `modelProvider` VARCHAR(191) NOT NULL DEFAULT 'local',
  `modelName` VARCHAR(191) NOT NULL DEFAULT 'local',
  `qualityScore` DOUBLE NOT NULL DEFAULT 0,
  `successRate` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'idle',
  `sopCoverage` DOUBLE NOT NULL DEFAULT 0,
  `maxAttempts` INTEGER NOT NULL DEFAULT 3,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AgentEmployee_departmentId_idx` (`departmentId`),
  INDEX `AgentEmployee_status_idx` (`status`),
  INDEX `AgentEmployee_capabilities_idx` (`capabilities`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LoopCycle` (
  `id` VARCHAR(191) NOT NULL,
  `objective` TEXT NOT NULL,
  `phase` VARCHAR(191) NOT NULL DEFAULT 'observe',
  `status` VARCHAR(191) NOT NULL DEFAULT 'running',
  `agentsUsed` TEXT NULL,
  `qualityScore` DOUBLE NOT NULL DEFAULT 0,
  `retryCount` INTEGER NOT NULL DEFAULT 0,
  `costUsd` DOUBLE NOT NULL DEFAULT 0,
  `errorType` VARCHAR(191) NULL,
  `lesson` TEXT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  INDEX `LoopCycle_status_idx` (`status`),
  INDEX `LoopCycle_phase_idx` (`phase`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `FamilyProfile` (
  `id` VARCHAR(191) NOT NULL,
  `personName` VARCHAR(191) NOT NULL,
  `personType` VARCHAR(191) NOT NULL,
  `consentConfirmed` BOOLEAN NOT NULL DEFAULT false,
  `consentDate` DATETIME(3) NULL,
  `guardianName` VARCHAR(191) NULL,
  `voiceConsent` BOOLEAN NOT NULL DEFAULT false,
  `faceConsent` BOOLEAN NOT NULL DEFAULT false,
  `appearanceJson` TEXT NULL,
  `voiceSettingsJson` TEXT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `FamilyProfile_personType_idx` (`personType`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `FamilyReferenceAsset` (
  `id` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `assetType` VARCHAR(191) NOT NULL,
  `angleType` VARCHAR(191) NULL,
  `context` VARCHAR(191) NULL,
  `expression` VARCHAR(191) NULL,
  `lighting` VARCHAR(191) NULL,
  `clothing` VARCHAR(191) NULL,
  `hairstyle` VARCHAR(191) NULL,
  `filePath` VARCHAR(191) NOT NULL,
  `fileName` VARCHAR(191) NULL,
  `fileSize` INTEGER NOT NULL DEFAULT 0,
  `mimeType` VARCHAR(191) NULL,
  `qualityScore` DOUBLE NOT NULL DEFAULT 0,
  `isDuplicate` BOOLEAN NOT NULL DEFAULT false,
  `approved` BOOLEAN NOT NULL DEFAULT false,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `FamilyReferenceAsset_profileId_idx` (`profileId`),
  INDEX `FamilyReferenceAsset_assetType_idx` (`assetType`),
  INDEX `FamilyReferenceAsset_approved_idx` (`approved`),
  PRIMARY KEY (`id`),
  CONSTRAINT `FamilyReferenceAsset_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `FamilyProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `FamilyProject` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `prompt` TEXT NOT NULL,
  `castProfileIds` TEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `qualityScore` DOUBLE NOT NULL DEFAULT 0,
  `currentStage` VARCHAR(191) NULL,
  `outputJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `FamilyProject_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `_FamilyProfileToFamilyProject` (
  `A` VARCHAR(191) NOT NULL,
  `B` VARCHAR(191) NOT NULL,
  UNIQUE INDEX `_FamilyProfileToFamilyProject_AB_unique` (`A`, `B`),
  INDEX `_FamilyProfileToFamilyProject_B_index` (`B`),
  CONSTRAINT `_FamilyProfileToFamilyProject_A_fkey` FOREIGN KEY (`A`) REFERENCES `FamilyProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_FamilyProfileToFamilyProject_B_fkey` FOREIGN KEY (`B`) REFERENCES `FamilyProject` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MediaGeneration` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NULL,
  `stage` VARCHAR(191) NOT NULL,
  `inputJson` TEXT NULL,
  `outputJson` LONGTEXT NULL,
  `qualityScore` DOUBLE NOT NULL DEFAULT 0,
  `identityScore` DOUBLE NOT NULL DEFAULT 0,
  `provider` VARCHAR(191) NOT NULL DEFAULT 'local',
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `attempt` INTEGER NOT NULL DEFAULT 1,
  `maxAttempts` INTEGER NOT NULL DEFAULT 3,
  `issuesJson` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MediaGeneration_projectId_idx` (`projectId`),
  INDEX `MediaGeneration_stage_idx` (`stage`),
  INDEX `MediaGeneration_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ContentOpportunityScore` (
  `id` VARCHAR(191) NOT NULL,
  `topic` VARCHAR(191) NOT NULL,
  `searchDemand` INTEGER NOT NULL DEFAULT 0,
  `parentRelevance` INTEGER NOT NULL DEFAULT 0,
  `bangladeshRelevance` INTEGER NOT NULL DEFAULT 0,
  `competition` INTEGER NOT NULL DEFAULT 0,
  `videoPotential` INTEGER NOT NULL DEFAULT 0,
  `brandFit` INTEGER NOT NULL DEFAULT 0,
  `finalScore` INTEGER NOT NULL DEFAULT 0,
  `rationale` TEXT NULL,
  `approved` BOOLEAN NOT NULL DEFAULT false,
  `provider` VARCHAR(191) NOT NULL DEFAULT 'local',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ContentOpportunityScore_approved_idx` (`approved`),
  INDEX `ContentOpportunityScore_finalScore_idx` (`finalScore`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `HookTest` (
  `id` VARCHAR(191) NOT NULL,
  `topic` VARCHAR(191) NOT NULL,
  `hookText` TEXT NOT NULL,
  `variant` VARCHAR(191) NOT NULL DEFAULT 'A',
  `impressions` INTEGER NOT NULL DEFAULT 0,
  `hookRetention` DOUBLE NOT NULL DEFAULT 0,
  `watchTime` INTEGER NOT NULL DEFAULT 0,
  `completion` DOUBLE NOT NULL DEFAULT 0,
  `isWinner` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `testedAt` DATETIME(3) NULL,
  INDEX `HookTest_topic_idx` (`topic`),
  INDEX `HookTest_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Campaign` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `topic` VARCHAR(191) NOT NULL,
  `opportunityId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'planned',
  `platformCount` INTEGER NOT NULL DEFAULT 0,
  `totalAssets` INTEGER NOT NULL DEFAULT 0,
  `views` INTEGER NOT NULL DEFAULT 0,
  `reach` INTEGER NOT NULL DEFAULT 0,
  `engagement` DOUBLE NOT NULL DEFAULT 0,
  `followerGain` INTEGER NOT NULL DEFAULT 0,
  `audienceRelevance` DOUBLE NOT NULL DEFAULT 0,
  `conversionRate` DOUBLE NOT NULL DEFAULT 0,
  `lesson` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedAt` DATETIME(3) NULL,
  `measuredAt` DATETIME(3) NULL,
  INDEX `Campaign_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `InkboxIntegration` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `agentId` VARCHAR(191) NOT NULL,
  `inkboxIdentityId` VARCHAR(191) NULL,
  `channels` VARCHAR(191) NOT NULL DEFAULT '[]',
  `status` VARCHAR(191) NOT NULL DEFAULT 'not_connected',
  `configJson` TEXT NULL,
  `lastHealthCheck` DATETIME(3) NULL,
  `lastError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `InkboxIntegration_status_idx` (`status`),
  INDEX `InkboxIntegration_agentId_idx` (`agentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgentMessage` (
  `id` VARCHAR(191) NOT NULL,
  `senderAgentId` VARCHAR(191) NOT NULL,
  `recipientAgentId` VARCHAR(191) NOT NULL,
  `taskId` VARCHAR(191) NULL,
  `objective` TEXT NOT NULL,
  `context` TEXT NULL,
  `requiredOutput` TEXT NULL,
  `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `result` LONGTEXT NULL,
  `failureReason` TEXT NULL,
  `hopCount` INTEGER NOT NULL DEFAULT 0,
  `channel` VARCHAR(191) NOT NULL DEFAULT 'internal',
  `inkboxMessageId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deliveredAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  INDEX `AgentMessage_senderAgentId_idx` (`senderAgentId`),
  INDEX `AgentMessage_recipientAgentId_idx` (`recipientAgentId`),
  INDEX `AgentMessage_status_idx` (`status`),
  INDEX `AgentMessage_taskId_idx` (`taskId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
