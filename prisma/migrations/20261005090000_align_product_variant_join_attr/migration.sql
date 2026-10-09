-- 补齐 ProductVariantJoinAttr 至最终结构（attrCategoryId 冗余列 + 审计字段 + 唯一约束/索引 + FK 调整）
-- 前置：20261004070102 已建骨架表（gallery_dev 曾提前手工应用，本地补文件保持回放一致）

-- 清空骨架期手工测试数据（无审计字段，回填脚本随后按 specSkuIds 重建正式关联）
DELETE FROM `ProductVariantJoinAttr`;

-- 补齐列
ALTER TABLE `ProductVariantJoinAttr` ADD COLUMN `attrCategoryId` SMALLINT UNSIGNED NOT NULL AFTER `attrId`;
ALTER TABLE `ProductVariantJoinAttr` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `ProductVariantJoinAttr` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;
ALTER TABLE `ProductVariantJoinAttr` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `ProductVariantJoinAttr` ADD COLUMN `createdBy` INTEGER NOT NULL;
ALTER TABLE `ProductVariantJoinAttr` ADD COLUMN `updatedBy` INTEGER NOT NULL;
ALTER TABLE `ProductVariantJoinAttr` ADD COLUMN `deletedBy` INTEGER NULL;

-- 唯一约束与查询索引
CREATE UNIQUE INDEX `ProductVariantJoinAttr_productVariantId_attrId_key` ON `ProductVariantJoinAttr`(`productVariantId`, `attrId`);
CREATE INDEX `ProductVariantJoinAttr_tenantId_idx` ON `ProductVariantJoinAttr`(`tenantId`);
CREATE INDEX `ProductVariantJoinAttr_attrId_idx` ON `ProductVariantJoinAttr`(`attrId`);
CREATE INDEX `ProductVariantJoinAttr_attrCategoryId_attrId_idx` ON `ProductVariantJoinAttr`(`attrCategoryId`, `attrId`);

-- productVariantId FK 改为级联删除（MySQL 8 隐式索引随 DROP FOREIGN KEY 自动删除，无需 DROP INDEX）
ALTER TABLE `ProductVariantJoinAttr` DROP FOREIGN KEY `ProductVariantJoinAttr_productVariantId_fkey`;
ALTER TABLE `ProductVariantJoinAttr` ADD CONSTRAINT `ProductVariantJoinAttr_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- attrId FK 重建（复用 attrId_idx）
ALTER TABLE `ProductVariantJoinAttr` DROP FOREIGN KEY `ProductVariantJoinAttr_attrId_fkey`;
ALTER TABLE `ProductVariantJoinAttr` ADD CONSTRAINT `ProductVariantJoinAttr_attrId_fkey` FOREIGN KEY (`attrId`) REFERENCES `Attr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- tenantId FK 重建（复用 tenantId_idx）
ALTER TABLE `ProductVariantJoinAttr` DROP FOREIGN KEY `ProductVariantJoinAttr_tenantId_fkey`;
ALTER TABLE `ProductVariantJoinAttr` ADD CONSTRAINT `ProductVariantJoinAttr_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 审计字段 FK
ALTER TABLE `ProductVariantJoinAttr` ADD CONSTRAINT `ProductVariantJoinAttr_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductVariantJoinAttr` ADD CONSTRAINT `ProductVariantJoinAttr_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductVariantJoinAttr` ADD CONSTRAINT `ProductVariantJoinAttr_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
