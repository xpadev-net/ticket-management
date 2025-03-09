/*
  Warnings:

  - You are about to drop the column `capacity` on the `events` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[qrCode]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `qrCode` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `events` DROP COLUMN `capacity`;

-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `qrCode` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `tickets_qrCode_key` ON `tickets`(`qrCode`);
