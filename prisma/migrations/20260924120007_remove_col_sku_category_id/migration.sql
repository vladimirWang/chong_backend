/*
  Warnings:

  - You are about to drop the column `skuCategoryId` on the `ProductJoinStockIn` table. All the data in the column will be lost.
  - You are about to drop the column `skuCategoryId` on the `ProductJoinStockOut` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `ProductJoinStockIn` DROP FOREIGN KEY `ProductJoinStockIn_skuCategoryId_fkey`;

-- DropForeignKey
ALTER TABLE `ProductJoinStockOut` DROP FOREIGN KEY `ProductJoinStockOut_skuCategoryId_fkey`;

-- DropIndex
DROP INDEX `ProductJoinStockIn_skuCategoryId_fkey` ON `ProductJoinStockIn`;

-- DropIndex
DROP INDEX `ProductJoinStockOut_skuCategoryId_fkey` ON `ProductJoinStockOut`;

-- AlterTable
ALTER TABLE `ProductJoinStockIn` DROP COLUMN `skuCategoryId`;

-- AlterTable
ALTER TABLE `ProductJoinStockOut` DROP COLUMN `skuCategoryId`;
