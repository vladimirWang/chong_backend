/*
  Warnings:

  - You are about to alter the column `name` on the `Tenant` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(20)`.
  - You are about to alter the column `code` on the `Tenant` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Char(6)`.

*/
-- AlterTable
ALTER TABLE `Tenant` MODIFY `name` VARCHAR(20) NOT NULL,
    MODIFY `code` CHAR(6) NOT NULL;
