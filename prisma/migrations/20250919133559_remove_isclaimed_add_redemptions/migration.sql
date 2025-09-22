/*
  Warnings:

  - You are about to drop the column `claimedByUserId` on the `claimablestamp` table. All the data in the column will be lost.
  - You are about to drop the column `isClaimed` on the `claimablestamp` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `claimablestamp` DROP FOREIGN KEY `ClaimableStamp_claimedByUserId_fkey`;

-- DropIndex
DROP INDEX `ClaimableStamp_claimedByUserId_fkey` ON `claimablestamp`;

-- AlterTable
ALTER TABLE `claimablestamp` DROP COLUMN `claimedByUserId`,
    DROP COLUMN `isClaimed`,
    ADD COLUMN `currentUses` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `maxUses` INTEGER NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `ClaimableStampRedemption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimableStampId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ClaimableStampRedemption_claimableStampId_userId_key`(`claimableStampId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClaimableStampRedemption` ADD CONSTRAINT `ClaimableStampRedemption_claimableStampId_fkey` FOREIGN KEY (`claimableStampId`) REFERENCES `ClaimableStamp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClaimableStampRedemption` ADD CONSTRAINT `ClaimableStampRedemption_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
