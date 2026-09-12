/*
  手工修正 Prisma 自动生成版本（原生成 SQL 在 MySQL 上无法应用，报错 1826）：
  1. 11 张表 deletedBy 外键删除规则 RESTRICT -> SET NULL
     （20260902034500 迁移只把列改为可空，未同步外键规则，schema 可空关系默认 SET NULL）
  2. Product 唯一约束 (tenantId, name) -> (tenantId, vendorId, name)

  已剔除迁移引擎误生成的两条语句：
  - DROP FOREIGN KEY `Product_tenantId_fkey`（无对应重建，会丢失租户外键）
  - ADD  CONSTRAINT `HistoryCost_productId_fkey`（该外键自 init 起一直存在，导致 1826 重复）
*/

-- 1. deletedBy 外键规则改为 ON DELETE SET NULL
-- Applicant / ApplicantActivationToken 引用 AdminUser，其余 9 张表引用 User
ALTER TABLE `Applicant` DROP FOREIGN KEY `Applicant_deletedBy_fkey`;
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ApplicantActivationToken` DROP FOREIGN KEY `ApplicantActivationToken_deletedBy_fkey`;
ALTER TABLE `ApplicantActivationToken` ADD CONSTRAINT `ApplicantActivationToken_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Client` DROP FOREIGN KEY `Client_deletedBy_fkey`;
ALTER TABLE `Client` ADD CONSTRAINT `Client_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `FileInfo` DROP FOREIGN KEY `FileInfo_deletedBy_fkey`;
ALTER TABLE `FileInfo` ADD CONSTRAINT `FileInfo_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `HistoryCost` DROP FOREIGN KEY `HistoryCost_deletedBy_fkey`;
ALTER TABLE `HistoryCost` ADD CONSTRAINT `HistoryCost_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Product` DROP FOREIGN KEY `Product_deletedBy_fkey`;
ALTER TABLE `Product` ADD CONSTRAINT `Product_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ProductJoinStockIn` DROP FOREIGN KEY `ProductJoinStockIn_deletedBy_fkey`;
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ProductJoinStockOut` DROP FOREIGN KEY `ProductJoinStockOut_deletedBy_fkey`;
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `StockIn` DROP FOREIGN KEY `StockIn_deletedBy_fkey`;
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `StockOut` DROP FOREIGN KEY `StockOut_deletedBy_fkey`;
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Vendor` DROP FOREIGN KEY `Vendor_deletedBy_fkey`;
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_deletedBy_fkey`
    FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Product 唯一索引：(tenantId, name) -> (tenantId, vendorId, name)
DROP INDEX `Product_tenantId_name_key` ON `Product`;
CREATE UNIQUE INDEX `Product_tenantId_vendorId_name_key`
    ON `Product`(`tenantId`, `vendorId`, `name`);
