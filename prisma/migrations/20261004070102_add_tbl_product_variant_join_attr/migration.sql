-- CreateTable（骨架版：仅核心列；attrCategoryId/审计字段/索引由 20261005090000_align 补齐）
CREATE TABLE `ProductVariantJoinAttr` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `productVariantId` INTEGER NOT NULL,
    `attrId` SMALLINT UNSIGNED NOT NULL,

    INDEX `ProductVariantJoinAttr_tenantId_fkey`(`tenantId`),
    INDEX `ProductVariantJoinAttr_productVariantId_fkey`(`productVariantId`),
    INDEX `ProductVariantJoinAttr_attrId_fkey`(`attrId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductVariantJoinAttr` ADD CONSTRAINT `ProductVariantJoinAttr_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariantJoinAttr` ADD CONSTRAINT `ProductVariantJoinAttr_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariantJoinAttr` ADD CONSTRAINT `ProductVariantJoinAttr_attrId_fkey` FOREIGN KEY (`attrId`) REFERENCES `Attr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
