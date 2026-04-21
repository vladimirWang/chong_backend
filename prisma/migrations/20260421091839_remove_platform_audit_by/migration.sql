/*
  Warnings:

  - You are about to drop the column `createdBy` on the `Platform` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `Platform` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `Platform` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Platform` DROP FOREIGN KEY `Platform_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `Platform` DROP FOREIGN KEY `Platform_deletedBy_fkey`;

-- DropForeignKey
ALTER TABLE `Platform` DROP FOREIGN KEY `Platform_updatedBy_fkey`;

-- DropIndex
DROP INDEX `Platform_createdBy_fkey` ON `Platform`;

-- DropIndex
DROP INDEX `Platform_deletedBy_fkey` ON `Platform`;

-- DropIndex
DROP INDEX `Platform_updatedBy_fkey` ON `Platform`;

-- AlterTable
ALTER TABLE `Platform` DROP COLUMN `createdBy`,
    DROP COLUMN `deletedBy`,
    DROP COLUMN `updatedBy`;
