/*
  Warnings:

  - A unique constraint covering the columns `[productCode]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Product` ALTER COLUMN `productCode` DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX `Product_productCode_key` ON `Product`(`productCode`);
