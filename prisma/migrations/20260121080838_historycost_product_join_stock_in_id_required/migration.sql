/*
  Warnings:

  - Made the column `productJoinStockInId` on table `HistoryCost` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `HistoryCost` DROP FOREIGN KEY `HistoryCost_productJoinStockInId_fkey`;

-- AlterTable
ALTER TABLE `HistoryCost` MODIFY `productJoinStockInId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `HistoryCost` ADD CONSTRAINT `HistoryCost_productJoinStockInId_fkey` FOREIGN KEY (`productJoinStockInId`) REFERENCES `ProductJoinStockIn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
