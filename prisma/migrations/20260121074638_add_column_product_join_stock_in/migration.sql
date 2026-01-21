/*
  Warnings:

  - A unique constraint covering the columns `[productJoinStockInId]` on the table `HistoryCost` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `productJoinStockInId` to the `HistoryCost` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `HistoryCost` ADD COLUMN `productJoinStockInId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `HistoryCost_productJoinStockInId_key` ON `HistoryCost`(`productJoinStockInId`);

-- AddForeignKey
ALTER TABLE `HistoryCost` ADD CONSTRAINT `HistoryCost_productJoinStockInId_fkey` FOREIGN KEY (`productJoinStockInId`) REFERENCES `ProductJoinStockIn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
