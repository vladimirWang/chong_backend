/*
  Warnings:

  - You are about to drop the column `price` on the `ProductJoinStockIn` table. All the data in the column will be lost.
  - Added the required column `cost` to the `ProductJoinStockIn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ProductJoinStockIn` DROP COLUMN `price`,
    ADD COLUMN `cost` SMALLINT UNSIGNED NOT NULL;
