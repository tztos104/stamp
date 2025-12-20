-- CreateTable
CREATE TABLE `MemorySpace` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `targetDate` DATETIME(3) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `starMap` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemoryPost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `spaceId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NULL,
    `mediaUrl` VARCHAR(191) NULL,
    `writerId` VARCHAR(191) NULL,
    `nickname` VARCHAR(191) NOT NULL,
    `aiStyle` JSON NULL,
    `password` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MemorySpace` ADD CONSTRAINT `MemorySpace_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryPost` ADD CONSTRAINT `MemoryPost_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `MemorySpace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemoryPost` ADD CONSTRAINT `MemoryPost_writerId_fkey` FOREIGN KEY (`writerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
