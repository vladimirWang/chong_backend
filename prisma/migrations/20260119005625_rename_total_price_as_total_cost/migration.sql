/*
  Warnings:

  - You are about to drop the column `totalPrice` on the `StockIn` table. All the data in the column will be lost.
  - Added the required column `totalCost` to the `StockIn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `StockIn` DROP COLUMN `totalPrice`,
    ADD COLUMN `totalCost` MEDIUMINT UNSIGNED NOT NULL;
