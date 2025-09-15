/*
  Warnings:

  - Added the required column `userId` to the `StampCard` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `stampcard` ADD COLUMN `userId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `StampCard` ADD CONSTRAINT `StampCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
