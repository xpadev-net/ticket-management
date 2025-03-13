/*
  Warnings:

  - You are about to drop the `EventTag` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `EventTag` DROP FOREIGN KEY `EventTag_eventId_fkey`;

-- AlterTable
ALTER TABLE `event_sessions` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `events` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `organization_members` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `tickets` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- DropTable
DROP TABLE `EventTag`;
