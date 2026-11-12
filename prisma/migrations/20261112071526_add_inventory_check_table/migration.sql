-- CreateTable
CREATE TABLE `InventoryCheck` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `serviceCode` CHAR(14) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NULL,
    `snapshotAt` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'COUNTING', 'REVIEWING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `totalItems` INTEGER NOT NULL DEFAULT 0,
    `pendingItems` INTEGER NOT NULL DEFAULT 0,
    `matchedItems` INTEGER NOT NULL DEFAULT 0,
    `surplusItems` INTEGER NOT NULL DEFAULT 0,
    `lossItems` INTEGER NOT NULL DEFAULT 0,
    `surplusQty` INTEGER NOT NULL DEFAULT 0,
    `lossQty` INTEGER NOT NULL DEFAULT 0,
    `remark` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NULL,

    UNIQUE INDEX `InventoryCheck_serviceCode_key`(`serviceCode`),
    INDEX `InventoryCheck_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `InventoryCheck_tenantId_serviceCode_key`(`tenantId`, `serviceCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryCheckItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `inventoryCheckId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `variantId` INTEGER NOT NULL,
    `bookQty` INTEGER NOT NULL,
    `actualQty` INTEGER NULL,
    `diffQty` INTEGER NULL,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NULL,

    INDEX `InventoryCheckItem_tenantId_idx`(`tenantId`),
    INDEX `InventoryCheckItem_inventoryCheckId_idx`(`inventoryCheckId`),
    UNIQUE INDEX `InventoryCheckItem_inventoryCheckId_variantId_key`(`inventoryCheckId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InventoryCheck` ADD CONSTRAINT `InventoryCheck_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheck` ADD CONSTRAINT `InventoryCheck_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheck` ADD CONSTRAINT `InventoryCheck_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheck` ADD CONSTRAINT `InventoryCheck_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheckItem` ADD CONSTRAINT `InventoryCheckItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheckItem` ADD CONSTRAINT `InventoryCheckItem_inventoryCheckId_fkey` FOREIGN KEY (`inventoryCheckId`) REFERENCES `InventoryCheck`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheckItem` ADD CONSTRAINT `InventoryCheckItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheckItem` ADD CONSTRAINT `InventoryCheckItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheckItem` ADD CONSTRAINT `InventoryCheckItem_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheckItem` ADD CONSTRAINT `InventoryCheckItem_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryCheckItem` ADD CONSTRAINT `InventoryCheckItem_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
