/*
  Warnings:

  - You are about to drop the column `cost` on the `StockIn` table. All the data in the column will be lost.
  - You are about to drop the column `count` on the `StockIn` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `StockIn` table. All the data in the column will be lost.
  - You are about to drop the column `vendorId` on the `StockIn` table. All the data in the column will be lost.
  - Added the required column `totalPrice` to the `StockIn` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `StockIn` DROP FOREIGN KEY `StockIn_productId_fkey`;

-- DropForeignKey
ALTER TABLE `StockIn` DROP FOREIGN KEY `StockIn_vendorId_fkey`;

-- DropIndex
DROP INDEX `StockIn_productId_fkey` ON `StockIn`;

-- DropIndex
DROP INDEX `StockIn_vendorId_fkey` ON `StockIn`;

-- AlterTable
ALTER TABLE `StockIn` DROP COLUMN `cost`,
    DROP COLUMN `count`,
    DROP COLUMN `productId`,
    DROP COLUMN `vendorId`,
    ADD COLUMN `totalPrice` MEDIUMINT UNSIGNED NOT NULL;

-- CreateTable
CREATE TABLE `ProductJoinStockIn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockInId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `price` SMALLINT UNSIGNED NOT NULL,
    `count` SMALLINT UNSIGNED NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_stockInId_fkey` FOREIGN KEY (`stockInId`) REFERENCES `StockIn`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
