/*
  Warnings:

  - You are about to drop the column `stockOutCode` on the `StockOut` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `StockOut` ADD COLUMN `serviceCode` VARCHAR(191) NULL;

update StockOut set serviceCode = stockOutCode where stockOutCode is not null;

ALTER TABLE `StockOut` DROP COLUMN `stockOutCode`;

alter table StockOut modify column serviceCode varchar(191) not null;
