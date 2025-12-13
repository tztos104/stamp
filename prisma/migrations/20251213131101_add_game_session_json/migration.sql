/*
  Warnings:

  - The primary key for the `gamesession` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `char1` on the `gamesession` table. All the data in the column will be lost.
  - You are about to drop the column `char2` on the `gamesession` table. All the data in the column will be lost.
  - You are about to drop the column `char3` on the `gamesession` table. All the data in the column will be lost.
  - You are about to drop the column `isTaken1` on the `gamesession` table. All the data in the column will be lost.
  - You are about to drop the column `isTaken2` on the `gamesession` table. All the data in the column will be lost.
  - You are about to drop the column `isTaken3` on the `gamesession` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `gamesession` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `gamesession` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - Added the required column `gameState` to the `GameSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `gamesession` DROP PRIMARY KEY,
    DROP COLUMN `char1`,
    DROP COLUMN `char2`,
    DROP COLUMN `char3`,
    DROP COLUMN `isTaken1`,
    DROP COLUMN `isTaken2`,
    DROP COLUMN `isTaken3`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `gameState` JSON NOT NULL,
    ADD COLUMN `isRevealed` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);
