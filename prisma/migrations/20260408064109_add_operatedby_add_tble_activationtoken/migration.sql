/*
  Warnings:

  - You are about to drop the column `inviteCode` on the `Applicant` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Applicant` DROP FOREIGN KEY `Applicant_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `Applicant` DROP FOREIGN KEY `Applicant_deletedBy_fkey`;

-- DropForeignKey
ALTER TABLE `Applicant` DROP FOREIGN KEY `Applicant_updatedBy_fkey`;

-- DropIndex
DROP INDEX `Applicant_createdBy_fkey` ON `Applicant`;

-- DropIndex
DROP INDEX `Applicant_deletedBy_fkey` ON `Applicant`;

-- DropIndex
DROP INDEX `Applicant_updatedBy_fkey` ON `Applicant`;

-- AlterTable
ALTER TABLE `Applicant` DROP COLUMN `inviteCode`,
    MODIFY `status` ENUM('PENDING', 'APPROVED', 'ACTIVATED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `ApplicantActivationToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicantId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    UNIQUE INDEX `ApplicantActivationToken_tokenHash_key`(`tokenHash`),
    INDEX `ApplicantActivationToken_applicantId_idx`(`applicantId`),
    INDEX `ApplicantActivationToken_expiresAt_idx`(`expiresAt`),
    INDEX `ApplicantActivationToken_usedAt_idx`(`usedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicantActivationToken` ADD CONSTRAINT `ApplicantActivationToken_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicantActivationToken` ADD CONSTRAINT `ApplicantActivationToken_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicantActivationToken` ADD CONSTRAINT `ApplicantActivationToken_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicantActivationToken` ADD CONSTRAINT `ApplicantActivationToken_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
