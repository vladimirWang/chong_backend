-- AlterTable
ALTER TABLE `ProductJoinStockIn` ADD COLUMN `skuCategoryId` SMALLINT UNSIGNED NULL,
    ADD COLUMN `skuId` SMALLINT UNSIGNED NULL;

-- AlterTable
ALTER TABLE `ProductJoinStockOut` ADD COLUMN `skuCategoryId` SMALLINT UNSIGNED NULL,
    ADD COLUMN `skuId` SMALLINT UNSIGNED NULL;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `Sku`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_skuCategoryId_fkey` FOREIGN KEY (`skuCategoryId`) REFERENCES `SkuCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `Sku`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_skuCategoryId_fkey` FOREIGN KEY (`skuCategoryId`) REFERENCES `SkuCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
