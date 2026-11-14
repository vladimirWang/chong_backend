-- CreateTable
CREATE TABLE `AfterSales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `serviceCode` CHAR(14) NOT NULL,
    `type` ENUM('RETURN', 'EXCHANGE', 'REPAIR') NOT NULL,
    `status` ENUM('PENDING', 'MERCHANT_RECEIVED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `stockOutId` INTEGER NOT NULL,
    `stockOutServiceCode` VARCHAR(32) NULL,
    `clientId` INTEGER NULL,
    `reason` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `docs` JSON NULL,
    `totalCount` INTEGER NOT NULL DEFAULT 0,
    `totalPrice` INTEGER NOT NULL DEFAULT 0,
    `refundAmount` INTEGER NULL,
    `completedAt` DATETIME(3) NULL,
    `merchantReceivedAt` DATETIME(3) NULL,
    `customerReceivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NULL,

    INDEX `AfterSales_tenantId_idx`(`tenantId`),
    INDEX `AfterSales_tenantId_stockOutId_idx`(`tenantId`, `stockOutId`),
    UNIQUE INDEX `AfterSales_tenantId_serviceCode_key`(`tenantId`, `serviceCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AfterSalesItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `afterSalesId` INTEGER NOT NULL,
    `stockOutItemId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `vendorId` INTEGER NOT NULL,
    `specSkuIds` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `count` INTEGER NOT NULL,
    `repairFee` INTEGER NOT NULL DEFAULT 0,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NULL,

    INDEX `AfterSalesItem_tenantId_idx`(`tenantId`),
    INDEX `AfterSalesItem_afterSalesId_idx`(`afterSalesId`),
    UNIQUE INDEX `AfterSalesItem_afterSalesId_productId_specSkuIds_key`(`afterSalesId`, `productId`, `specSkuIds`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AfterSales` ADD CONSTRAINT `AfterSales_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSales` ADD CONSTRAINT `AfterSales_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSales` ADD CONSTRAINT `AfterSales_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSales` ADD CONSTRAINT `AfterSales_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSalesItem` ADD CONSTRAINT `AfterSalesItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSalesItem` ADD CONSTRAINT `AfterSalesItem_afterSalesId_fkey` FOREIGN KEY (`afterSalesId`) REFERENCES `AfterSales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSalesItem` ADD CONSTRAINT `AfterSalesItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSalesItem` ADD CONSTRAINT `AfterSalesItem_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSalesItem` ADD CONSTRAINT `AfterSalesItem_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSalesItem` ADD CONSTRAINT `AfterSalesItem_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

