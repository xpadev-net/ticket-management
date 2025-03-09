/*
  Warnings:

  - You are about to drop the column `date` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `tickets` table. All the data in the column will be lost.
  - Added the required column `sessionId` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `tickets` DROP FOREIGN KEY `tickets_eventId_fkey`;

-- DropIndex
DROP INDEX `tickets_eventId_fkey` ON `tickets`;

-- AlterTable
ALTER TABLE `events` DROP COLUMN `date`,
    DROP COLUMN `location`;

-- AlterTable
ALTER TABLE `tickets` DROP COLUMN `eventId`,
    ADD COLUMN `sessionId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `event_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `event_sessions` ADD CONSTRAINT `event_sessions_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `event_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
