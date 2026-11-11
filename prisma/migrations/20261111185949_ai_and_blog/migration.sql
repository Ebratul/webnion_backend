-- AlterTable
ALTER TABLE `inquiries` ADD COLUMN `source` VARCHAR(16) NOT NULL DEFAULT 'form';

-- CreateTable
CREATE TABLE `ai_settings` (
    `id` VARCHAR(16) NOT NULL DEFAULT 'main',
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_usage` (
    `day` DATE NOT NULL,
    `feature` VARCHAR(32) NOT NULL,
    `requests` INTEGER NOT NULL DEFAULT 0,
    `inputTokens` INTEGER NOT NULL DEFAULT 0,
    `outputTokens` INTEGER NOT NULL DEFAULT 0,
    `pictures` INTEGER NOT NULL DEFAULT 0,
    `errors` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`day`, `feature`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_visitor_usage` (
    `day` DATE NOT NULL,
    `visitor` CHAR(64) NOT NULL,
    `messages` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`day`, `visitor`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_index_entries` (
    `key` VARCHAR(200) NOT NULL,
    `hash` CHAR(64) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_posts` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` JSON NOT NULL,
    `excerpt` JSON NULL,
    `content` JSON NOT NULL,
    `cover` VARCHAR(2048) NULL,
    `coverAlt` JSON NULL,
    `tags` VARCHAR(400) NULL,
    `seoTitle` JSON NULL,
    `seoDescription` JSON NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `authorName` VARCHAR(120) NULL,
    `aiGenerated` BOOLEAN NOT NULL DEFAULT false,
    `aiMeta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `blog_posts_slug_key`(`slug`),
    INDEX `blog_posts_status_publishedAt_idx`(`status`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
