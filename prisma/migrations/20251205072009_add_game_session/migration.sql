-- CreateTable
CREATE TABLE `GameSession` (
    `id` VARCHAR(191) NOT NULL,
    `char1` VARCHAR(191) NOT NULL DEFAULT '',
    `char2` VARCHAR(191) NOT NULL DEFAULT '',
    `char3` VARCHAR(191) NOT NULL DEFAULT '',
    `isTaken1` BOOLEAN NOT NULL DEFAULT false,
    `isTaken2` BOOLEAN NOT NULL DEFAULT false,
    `isTaken3` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
