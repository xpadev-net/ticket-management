-- AlterTable
ALTER TABLE `event_sessions` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `events` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `organization_members` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `fullyUsed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lastUsedAt` DATETIME(3) NULL,
    ADD COLUMN `usedCount` INTEGER NOT NULL DEFAULT 0,
    ALTER COLUMN `updatedAt` DROP DEFAULT;
