/*
  说明：
  - 原迁移包含「将 ProductJoinStockIn.skuId 改为 NOT NULL」。
    生产库存在 SKU 功能上线前的历史明细（skuId=NULL），且 Sku 表当时为空，
    NOT NULL + 外键约束无法同时满足，故移除该步骤；skuId 列在后续
    20260928220000 迁移中整体替换为 specSkuIds（历史行回填空串）。
  - NULL 值不参与外键校验，skuId 保持可空时 RESTRICT 外键可正常建立。
*/
-- DropForeignKey
ALTER TABLE `ProductJoinStockIn` DROP FOREIGN KEY `ProductJoinStockIn_skuId_fkey`;

-- DropForeignKey
ALTER TABLE `ProductJoinStockOut` DROP FOREIGN KEY `ProductJoinStockOut_stockOutId_fkey`;

-- DropIndex
DROP INDEX `ProductJoinStockIn_skuId_fkey` ON `ProductJoinStockIn`;

-- DropIndex
DROP INDEX `ProductJoinStockOut_stockOutId_productId_key` ON `ProductJoinStockOut`;

-- CreateIndex
CREATE UNIQUE INDEX `ProductJoinStockOut_stockOutId_productId_skuId_key` ON `ProductJoinStockOut`(`stockOutId`, `productId`, `skuId`);

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `Sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
