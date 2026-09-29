-- DropForeignKey
ALTER TABLE `ProductJoinStockIn` DROP FOREIGN KEY `ProductJoinStockIn_stockInId_fkey`;

-- DropIndex
DROP INDEX `ProductJoinStockIn_stockInId_productId_key` ON `ProductJoinStockIn`;

-- CreateIndex
CREATE UNIQUE INDEX `ProductJoinStockIn_stockInId_productId_skuId_key` ON `ProductJoinStockIn`(`stockInId`, `productId`, `skuId`);

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_stockInId_fkey` FOREIGN KEY (`stockInId`) REFERENCES `StockIn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
