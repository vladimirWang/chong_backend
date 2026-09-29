/*
  Warnings:

  - Made the column `skuId` on table `ProductJoinStockOut` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `ProductJoinStockOut` DROP FOREIGN KEY `ProductJoinStockOut_skuId_fkey`;

-- DropIndex
DROP INDEX `ProductJoinStockOut_skuId_fkey` ON `ProductJoinStockOut`;

-- AlterTable
ALTER TABLE `ProductJoinStockOut` MODIFY `skuId` SMALLINT UNSIGNED NOT NULL;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_stockOutId_fkey` FOREIGN KEY (`stockOutId`) REFERENCES `StockOut`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `Sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
