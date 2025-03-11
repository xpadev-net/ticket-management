-- AlterTable
ALTER TABLE `event_sessions` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `events` ADD COLUMN `imageUrl` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `organization_members` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `tickets` ALTER COLUMN `updatedAt` DROP DEFAULT;
