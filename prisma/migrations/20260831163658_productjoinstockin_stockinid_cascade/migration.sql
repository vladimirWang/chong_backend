-- 让 ProductJoinStockIn.stockInId → StockIn 的外键在父表删除时级联删除
-- 与 ProductJoinStockOut.stockOutId 保持对称：明细表应随父单据一起删除

ALTER TABLE `ProductJoinStockIn` DROP FOREIGN KEY `ProductJoinStockIn_stockInId_fkey`;

ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_stockInId_fkey`
    FOREIGN KEY (`stockInId`) REFERENCES `StockIn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
