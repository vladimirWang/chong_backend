/*
  Warnings:

  - You are about to drop the column `isDel` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `isDel` on the `Vendor` table. All the data in the column will be lost.
  - You are about to drop the `Import` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Import` DROP FOREIGN KEY `Import_productId_fkey`;

-- DropForeignKey
ALTER TABLE `Import` DROP FOREIGN KEY `Import_vendorId_fkey`;

-- AlterTable
ALTER TABLE `Product` DROP COLUMN `isDel`,
    ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Vendor` DROP COLUMN `isDel`,
    ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- DropTable
DROP TABLE `Import`;

-- CreateTable
CREATE TABLE `StockIn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `cost` INTEGER NOT NULL,
    `count` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `vendorId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
