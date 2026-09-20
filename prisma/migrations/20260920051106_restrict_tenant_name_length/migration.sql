/*
  Warnings:

  - You are about to alter the column `name` on the `Tenant` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(20)`.
  - You are about to alter the column `code` on the `Tenant` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Char(6)`.

*/
-- 先把超长的租户 code 截到 6 字符（老迁移硬编码了 'default' 7 字符，以及其他可能存量数据）
-- 唯一索引冲突靠 REPLACE INTO / 人工介入处理；这里先简单截断让 ALTER 能通过
UPDATE `Tenant` SET `code` = LEFT(`code`, 6) WHERE CHAR_LENGTH(`code`) > 6;

-- AlterTable
ALTER TABLE `Tenant` MODIFY `name` VARCHAR(20) NOT NULL,
    MODIFY `code` CHAR(6) NOT NULL;
