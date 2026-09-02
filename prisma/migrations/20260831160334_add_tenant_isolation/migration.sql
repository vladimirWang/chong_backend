-- ============================================================
-- 多租户隔离迁移：加 Tenant 表 + 10 张业务表加 tenantId
-- 执行前请备份数据库！
-- ============================================================

-- 1. 先 DROP 旧外键和唯一约束（索引可能被外键引用，必须先 DROP FK）
ALTER TABLE `StockOut` DROP FOREIGN KEY `StockOut_platformId_fkey`;
DROP INDEX `Product_name_key` ON `Product`;
DROP INDEX `Vendor_name_key` ON `Vendor`;
DROP INDEX `StockOut_platformId_platformOrderNo_key` ON `StockOut`;

-- 2. 创建 Tenant 表（必须在 ALTER TABLE 加 tenantId 之前，否则外键约束失败）
CREATE TABLE `Tenant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Tenant_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. 插入默认租户（存量数据统一归属于此）
INSERT INTO `Tenant` (`id`, `name`, `code`, `status`, `createdAt`, `updatedAt`)
VALUES (1, '默认租户', 'default', 'ACTIVE', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- 4. 10 张表先加可空 tenantId 列（允许临时 NULL 以便回填后再改 NOT NULL）
ALTER TABLE `Vendor`               ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `StockIn`              ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `ProductJoinStockIn`   ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `Product`              ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `User`                 ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `HistoryCost`          ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `StockOut`             ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `ProductJoinStockOut`  ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `Client`               ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `Applicant`            ADD COLUMN `tenantId` INTEGER NULL;

-- 5. 回填存量数据到默认租户
UPDATE `Vendor`               SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `StockIn`              SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `ProductJoinStockIn`   SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `Product`              SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `User`                 SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `HistoryCost`          SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `StockOut`             SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `ProductJoinStockOut`  SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `Client`               SET `tenantId` = 1 WHERE `tenantId` IS NULL;
-- Applicant 中已激活的回填默认租户，PENDING 保持 NULL（申请时还没选租户）
UPDATE `Applicant` SET `tenantId` = 1 WHERE `tenantId` IS NULL AND `status` != 'PENDING';

-- 6. 改 NOT NULL（Applicant 保持可空）
ALTER TABLE `Vendor`               MODIFY COLUMN `tenantId` INTEGER NOT NULL;
ALTER TABLE `StockIn`              MODIFY COLUMN `tenantId` INTEGER NOT NULL;
ALTER TABLE `ProductJoinStockIn`   MODIFY COLUMN `tenantId` INTEGER NOT NULL;
ALTER TABLE `Product`              MODIFY COLUMN `tenantId` INTEGER NOT NULL;
ALTER TABLE `User`                 MODIFY COLUMN `tenantId` INTEGER NOT NULL;
ALTER TABLE `HistoryCost`          MODIFY COLUMN `tenantId` INTEGER NOT NULL;
ALTER TABLE `StockOut`             MODIFY COLUMN `tenantId` INTEGER NOT NULL;
ALTER TABLE `ProductJoinStockOut`  MODIFY COLUMN `tenantId` INTEGER NOT NULL;
ALTER TABLE `Client`               MODIFY COLUMN `tenantId` INTEGER NOT NULL;
-- Applicant 不 MODIFY，保持 NULL

-- 7. 创建 tenantId 普通索引 + 联合唯一索引
CREATE INDEX `Vendor_tenantId_idx` ON `Vendor`(`tenantId`);
CREATE INDEX `StockIn_tenantId_idx` ON `StockIn`(`tenantId`);
CREATE INDEX `ProductJoinStockIn_tenantId_idx` ON `ProductJoinStockIn`(`tenantId`);
CREATE INDEX `Product_tenantId_idx` ON `Product`(`tenantId`);
CREATE INDEX `User_tenantId_idx` ON `User`(`tenantId`);
CREATE INDEX `HistoryCost_tenantId_idx` ON `HistoryCost`(`tenantId`);
CREATE INDEX `StockOut_tenantId_idx` ON `StockOut`(`tenantId`);
CREATE INDEX `ProductJoinStockOut_tenantId_idx` ON `ProductJoinStockOut`(`tenantId`);
CREATE INDEX `Client_tenantId_idx` ON `Client`(`tenantId`);
CREATE INDEX `Applicant_tenantId_idx` ON `Applicant`(`tenantId`);

-- 联合唯一：(tenantId, 业务字段)
CREATE UNIQUE INDEX `Vendor_tenantId_name_key` ON `Vendor`(`tenantId`, `name`);
CREATE UNIQUE INDEX `Product_tenantId_name_key` ON `Product`(`tenantId`, `name`);
CREATE UNIQUE INDEX `StockOut_tenantId_platformId_platformOrderNo_key`
    ON `StockOut`(`tenantId`, `platformId`, `platformOrderNo`);

-- 8. 加外键约束
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Product` ADD CONSTRAINT `Product_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `HistoryCost` ADD CONSTRAINT `HistoryCost_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Client` ADD CONSTRAINT `Client_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 重建 StockOut.platformId 外键（之前被 drop）
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_platformId_fkey`
    FOREIGN KEY (`platformId`) REFERENCES `Platform`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
