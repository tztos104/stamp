-- DropForeignKey
ALTER TABLE `StampEntry` DROP FOREIGN KEY `StampEntry_eventId_fkey`;

-- DropIndex
DROP INDEX `StampEntry_eventId_fkey` ON `StampEntry`;

-- AlterTable
ALTER TABLE `StampEntry` ADD COLUMN `adminNote` VARCHAR(191) NULL,
    MODIFY `eventId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `StampEntry` ADD CONSTRAINT `StampEntry_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
