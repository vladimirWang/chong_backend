-- CreateTable
CREATE TABLE `Vendor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    UNIQUE INDEX `Vendor_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockIn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `totalCost` MEDIUMINT UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `completedAt` DATETIME(3) NULL,
    `serviceCode` VARCHAR(191) NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductJoinStockIn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockInId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `cost` INTEGER NOT NULL,
    `count` INTEGER NOT NULL,
    `vendorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `productCode` VARCHAR(20) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    UNIQUE INDEX `ProductJoinStockIn_stockInId_productId_key`(`stockInId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `img` VARCHAR(191) NULL,
    `vendorId` INTEGER NOT NULL,
    `remark` VARCHAR(191) NULL,
    `balance` SMALLINT UNSIGNED NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `latestPrice` INTEGER NULL,
    `latestCost` INTEGER NULL,
    `stockOutPending` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `stockInPending` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `salePrice` INTEGER NULL,
    `desc` LONGTEXT NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    UNIQUE INDEX `Product_name_key`(`name`),
    INDEX `Product_brandId_fkey`(`vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `password` VARCHAR(191) NOT NULL,
    `avatar` VARCHAR(191) NULL,
    `salt` VARCHAR(191) NOT NULL,
    `githubId` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_githubId_key`(`githubId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistoryCost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockInId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `value` MEDIUMINT UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockOut` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `totalPrice` MEDIUMINT UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `completedAt` DATETIME(3) NULL,
    `remark` VARCHAR(191) NULL,
    `platformId` INTEGER NOT NULL,
    `platformOrderNo` VARCHAR(191) NULL,
    `clientId` INTEGER NULL,
    `serviceCode` VARCHAR(191) NOT NULL,
    `docs` JSON NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    UNIQUE INDEX `StockOut_platformId_platformOrderNo_key`(`platformId`, `platformOrderNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductJoinStockOut` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `stockOutId` INTEGER NOT NULL,
    `price` INTEGER NOT NULL,
    `count` INTEGER NOT NULL,
    `vendorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    UNIQUE INDEX `ProductJoinStockOut_stockOutId_productId_key`(`stockOutId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileInfo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hash` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    UNIQUE INDEX `FileInfo_hash_key`(`hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Platform` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    UNIQUE INDEX `Platform_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `tel` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `password` VARCHAR(191) NOT NULL,
    `salt` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `AdminUser_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Applicant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `inviteCode` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NOT NULL,

    UNIQUE INDEX `Applicant_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_stockInId_fkey` FOREIGN KEY (`stockInId`) REFERENCES `StockIn`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockIn` ADD CONSTRAINT `ProductJoinStockIn_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoryCost` ADD CONSTRAINT `HistoryCost_stockInId_fkey` FOREIGN KEY (`stockInId`) REFERENCES `StockIn`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoryCost` ADD CONSTRAINT `HistoryCost_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoryCost` ADD CONSTRAINT `HistoryCost_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoryCost` ADD CONSTRAINT `HistoryCost_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoryCost` ADD CONSTRAINT `HistoryCost_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_platformId_fkey` FOREIGN KEY (`platformId`) REFERENCES `Platform`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_stockOutId_fkey` FOREIGN KEY (`stockOutId`) REFERENCES `StockOut`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinStockOut` ADD CONSTRAINT `ProductJoinStockOut_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileInfo` ADD CONSTRAINT `FileInfo_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileInfo` ADD CONSTRAINT `FileInfo_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileInfo` ADD CONSTRAINT `FileInfo_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Platform` ADD CONSTRAINT `Platform_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Platform` ADD CONSTRAINT `Platform_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Platform` ADD CONSTRAINT `Platform_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
