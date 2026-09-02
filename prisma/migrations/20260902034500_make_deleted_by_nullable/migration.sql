-- ============================================================
-- 审计字段 deletedBy 从 NOT NULL 改为 NULLABLE（软删除场景：未删除记录该字段为 NULL）
-- 受影响的 11 张模型表（9 张租户业务表 + 2 张全局 Admin 域表）
-- ============================================================

ALTER TABLE `Vendor`                  MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `StockIn`                 MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `ProductJoinStockIn`      MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `Product`                 MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `HistoryCost`             MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `StockOut`                MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `ProductJoinStockOut`     MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `FileInfo`                MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `Client`                  MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `Applicant`               MODIFY COLUMN `deletedBy` INTEGER NULL;
ALTER TABLE `ApplicantActivationToken` MODIFY COLUMN `deletedBy` INTEGER NULL;
