/*
  Warnings:

  - You are about to drop the column `cost` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Product` DROP COLUMN `cost`,
    DROP COLUMN `price`,
    ADD COLUMN `latestCost` INTEGER NULL,
    ADD COLUMN `latestPrice` INTEGER NULL;
