-- AlterTable
ALTER TABLE `events` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `organization_members` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `notes` TEXT NULL;
