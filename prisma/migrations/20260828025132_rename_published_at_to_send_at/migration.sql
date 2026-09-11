/*
  Warnings:

  - You are about to drop the column `publishedAt` on the `Mail` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Mail` DROP COLUMN `publishedAt`,
    ADD COLUMN `sendAt` DATETIME(3) NULL;
