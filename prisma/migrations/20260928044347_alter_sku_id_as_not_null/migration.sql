/*
  说明：
  - 原迁移包含「将 ProductJoinStockOut.skuId 改为 NOT NULL」。
    生产库存在 SKU 功能上线前的历史明细（skuId=NULL），NOT NULL 会失败
    （MySQL 1138 Invalid use of NULL value），故移除该步骤；skuId 列在
    后续 20260928220000 迁移中整体替换为 specSkuIds（历史行回填空串）。
  - NULL 值不参与外键校验，skuId 保持可空时 RESTRICT 外键可正常建立。
*/
-- DropForeignKey
ALTER TABLE `ProductJoinStockOut` DROP FOREIGN KEY `ProductJoinStockOut_skuId_fkey`;

-- DropIndex
DROP INDEX `ProductJoinStockOut_skuId_fkey` ON `ProductJoinStockOut`;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_stockOutId_fkey` FOREIGN KEY (`stockOutId`) REFERENCES `StockOut`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `Sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
