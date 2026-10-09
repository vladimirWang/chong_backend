/*
  Warnings:

  - You are about to drop the column `skuId` on the `ProductJoinSku` table. All the data in the column will be lost.
  - You are about to drop the `Sku` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SkuCategory` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[productId,attrId]` on the table `ProductJoinSku` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `attrId` to the `ProductJoinSku` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `ProductJoinSku` DROP FOREIGN KEY `ProductJoinSku_productId_fkey`;

-- DropForeignKey
ALTER TABLE `ProductJoinSku` DROP FOREIGN KEY `ProductJoinSku_skuId_fkey`;

-- DropForeignKey
ALTER TABLE `Sku` DROP FOREIGN KEY `Sku_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `Sku` DROP FOREIGN KEY `Sku_deletedBy_fkey`;

-- DropForeignKey
ALTER TABLE `Sku` DROP FOREIGN KEY `Sku_skuCategoryId_fkey`;

-- DropForeignKey
ALTER TABLE `Sku` DROP FOREIGN KEY `Sku_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `Sku` DROP FOREIGN KEY `Sku_updatedBy_fkey`;

-- DropForeignKey
ALTER TABLE `SkuCategory` DROP FOREIGN KEY `SkuCategory_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `SkuCategory` DROP FOREIGN KEY `SkuCategory_deletedBy_fkey`;

-- DropForeignKey
ALTER TABLE `SkuCategory` DROP FOREIGN KEY `SkuCategory_tenantId_fkey`;

-- DropForeignKey
ALTER TABLE `SkuCategory` DROP FOREIGN KEY `SkuCategory_updatedBy_fkey`;

-- DropIndex
DROP INDEX `ProductJoinSku_productId_skuId_key` ON `ProductJoinSku`;

-- DropIndex
DROP INDEX `ProductJoinSku_skuId_idx` ON `ProductJoinSku`;

-- AlterTable
ALTER TABLE `ProductJoinSku` DROP COLUMN `skuId`,
    ADD COLUMN `attrId` SMALLINT UNSIGNED NOT NULL;

-- DropTable
DROP TABLE `Sku`;

-- DropTable
DROP TABLE `SkuCategory`;

-- CreateTable
CREATE TABLE `AttrCategory` (
    `id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `name` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NULL,

    INDEX `AttrCategory_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `AttrCategory_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attr` (
    `id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `name` VARCHAR(20) NOT NULL,
    `attrCategoryId` SMALLINT UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `updatedBy` INTEGER NOT NULL,
    `deletedBy` INTEGER NULL,

    INDEX `Attr_tenantId_idx`(`tenantId`),
    INDEX `Attr_attrCategoryId_idx`(`attrCategoryId`),
    UNIQUE INDEX `Attr_tenantId_attrCategoryId_name_key`(`tenantId`, `attrCategoryId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ProductJoinSku_attrId_idx` ON `ProductJoinSku`(`attrId`);

-- CreateIndex
CREATE UNIQUE INDEX `ProductJoinSku_productId_attrId_key` ON `ProductJoinSku`(`productId`, `attrId`);

-- AddForeignKey
ALTER TABLE `AttrCategory` ADD CONSTRAINT `AttrCategory_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttrCategory` ADD CONSTRAINT `AttrCategory_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttrCategory` ADD CONSTRAINT `AttrCategory_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttrCategory` ADD CONSTRAINT `AttrCategory_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attr` ADD CONSTRAINT `Attr_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attr` ADD CONSTRAINT `Attr_attrCategoryId_fkey` FOREIGN KEY (`attrCategoryId`) REFERENCES `AttrCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attr` ADD CONSTRAINT `Attr_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attr` ADD CONSTRAINT `Attr_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attr` ADD CONSTRAINT `Attr_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductJoinSku` ADD CONSTRAINT `ProductJoinSku_attrId_fkey` FOREIGN KEY (`attrId`) REFERENCES `Attr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
