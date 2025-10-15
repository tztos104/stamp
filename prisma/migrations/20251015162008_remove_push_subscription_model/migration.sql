/*
  Warnings:

  - You are about to drop the `pushsubscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `pushsubscription` DROP FOREIGN KEY `PushSubscription_userId_fkey`;

-- DropTable
DROP TABLE `pushsubscription`;
