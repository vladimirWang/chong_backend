/*
  Warnings:

  - You are about to drop the column `retry` on the `Mail` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Mail` DROP COLUMN `retry`,
    ADD COLUMN `failCount` SMALLINT UNSIGNED NOT NULL DEFAULT 0;
