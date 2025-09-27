-- AlterTable
ALTER TABLE `User` ADD COLUMN `agreedToMarketing` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `agreedToPrivacyPolicy` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `agreedToTerms` BOOLEAN NOT NULL DEFAULT false;
