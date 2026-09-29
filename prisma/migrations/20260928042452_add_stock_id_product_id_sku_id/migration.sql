/*
  Warnings:

  - A unique constraint covering the columns `[stockOutId,productId,skuId]` on the table `ProductJoinStockOut` will be added. If there are existing duplicate values, this will fail.
  - Made the column `skuId` on table `ProductJoinStockIn` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `ProductJoinStockIn` DROP FOREIGN KEY `ProductJoinStockIn_skuId_fkey`;

-- DropForeignKey
ALTER TABLE `ProductJoinStockOut` DROP FOREIGN KEY `ProductJoinStockOut_stockOutId_fkey`;

-- DropIndex
DROP INDEX `ProductJoinStockIn_skuId_fkey` ON `ProductJoinStockIn`;

-- DropIndex
DROP INDEX `ProductJoinStockOut_stockOutId_productId_key` ON `ProductJoinStockOut`;

-- AlterTable
ALTER TABLE `ProductJoinStockIn` MODIFY `skuId` SMALLINT UNSIGNED NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ProductJoinStockOut_stockOutId_productId_skuId_key` ON `ProductJoinStockOut`(`stockOutId`, `productId`, `skuId`);

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `Sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
