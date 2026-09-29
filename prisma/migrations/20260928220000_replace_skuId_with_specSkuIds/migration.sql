-- 将 ProductJoinStockIn / ProductJoinStockOut 的 skuId（单值，外键关联 Sku）
-- 替换为 specSkuIds（逗号分隔的 SKU id 字符串，支持多维度规格拼接）。
-- 同时把唯一约束从 (xxId, productId, skuId) 改为 (xxId, productId, specSkuIds)。
-- 安全回填：先加可空列 → 用 skuId 回填 → 改 NOT NULL → 删旧列。
-- 在空库上回放时 UPDATE 影响 0 行，MODIFY NOT NULL 安全。

-- ==================== ProductJoinStockIn ====================

-- 1. 删除 skuId 外键（skuId→Sku，本变更后不再需要）
ALTER TABLE `ProductJoinStockIn` DROP FOREIGN KEY `ProductJoinStockIn_skuId_fkey`;

-- 2. 临时删除 stockInId 外键（CASCADE），因其依赖的复合唯一索引需要替换
ALTER TABLE `ProductJoinStockIn` DROP FOREIGN KEY `ProductJoinStockIn_stockInId_fkey`;

-- 3. 删除 skuId 的自动索引
DROP INDEX `ProductJoinStockIn_skuId_fkey` ON `ProductJoinStockIn`;

-- 4. 删除旧的 3 列唯一索引（stockInId, productId, skuId）
DROP INDEX `ProductJoinStockIn_stockInId_productId_skuId_key` ON `ProductJoinStockIn`;

-- 5. 新增 specSkuIds 列（先允许 NULL 以便回填已有数据）
ALTER TABLE `ProductJoinStockIn` ADD COLUMN `specSkuIds` VARCHAR(191);

-- 6. 回填：将 skuId 转为字符串存入 specSkuIds（空库回放为 0 行 no-op）
UPDATE `ProductJoinStockIn` SET `specSkuIds` = CAST(`skuId` AS CHAR) WHERE `specSkuIds` IS NULL;

-- 7. 将 specSkuIds 改为 NOT NULL
ALTER TABLE `ProductJoinStockIn` MODIFY COLUMN `specSkuIds` VARCHAR(191) NOT NULL;

-- 8. 删除 skuId 列
ALTER TABLE `ProductJoinStockIn` DROP COLUMN `skuId`;

-- 9. 创建新的 3 列唯一索引（stockInId, productId, specSkuIds）
CREATE UNIQUE INDEX `ProductJoinStockIn_stockInId_productId_specSkuIds_key` ON `ProductJoinStockIn`(`stockInId`, `productId`, `specSkuIds`);

-- 10. 重新添加 stockInId 外键（CASCADE）
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_stockInId_fkey` FOREIGN KEY (`stockInId`) REFERENCES `StockIn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ==================== ProductJoinStockOut ====================

-- 1. 删除 skuId 外键（skuId→Sku，本变更后不再需要）
ALTER TABLE `ProductJoinStockOut` DROP FOREIGN KEY `ProductJoinStockOut_skuId_fkey`;

-- 2. 临时删除 stockOutId 外键（CASCADE），因其依赖的复合唯一索引需要替换
ALTER TABLE `ProductJoinStockOut` DROP FOREIGN KEY `ProductJoinStockOut_stockOutId_fkey`;

-- 3. 删除 skuId 的自动索引
DROP INDEX `ProductJoinStockOut_skuId_fkey` ON `ProductJoinStockOut`;

-- 4. 删除旧的 3 列唯一索引（stockOutId, productId, skuId）
DROP INDEX `ProductJoinStockOut_stockOutId_productId_skuId_key` ON `ProductJoinStockOut`;

-- 5. 新增 specSkuIds 列（先允许 NULL 以便回填已有数据）
ALTER TABLE `ProductJoinStockOut` ADD COLUMN `specSkuIds` VARCHAR(191);

-- 6. 回填：将 skuId 转为字符串存入 specSkuIds（空库回放为 0 行 no-op）
UPDATE `ProductJoinStockOut` SET `specSkuIds` = CAST(`skuId` AS CHAR) WHERE `specSkuIds` IS NULL;

-- 7. 将 specSkuIds 改为 NOT NULL
ALTER TABLE `ProductJoinStockOut` MODIFY COLUMN `specSkuIds` VARCHAR(191) NOT NULL;

-- 8. 删除 skuId 列
ALTER TABLE `ProductJoinStockOut` DROP COLUMN `skuId`;

-- 9. 创建新的 3 列唯一索引（stockOutId, productId, specSkuIds）
CREATE UNIQUE INDEX `ProductJoinStockOut_stockOutId_productId_specSkuIds_key` ON `ProductJoinStockOut`(`stockOutId`, `productId`, `specSkuIds`);

-- 10. 重新添加 stockOutId 外键（CASCADE）
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_stockOutId_fkey` FOREIGN KEY (`stockOutId`) REFERENCES `StockOut`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
