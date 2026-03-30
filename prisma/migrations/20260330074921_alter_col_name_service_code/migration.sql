/*
  Warnings:

  - You are about to drop the column `stockInCode` on the `StockIn` table. All the data in the column will be lost.
  - Added the required column `serviceCode` to the `StockIn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `StockIn` DROP COLUMN `stockInCode`,
    ADD COLUMN `serviceCode` VARCHAR(191) NOT NULL;
