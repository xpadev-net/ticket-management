/*
  Warnings:

  - Added the required column `nameKana` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `event_sessions` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `events` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `organization_members` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `nameKana` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;
