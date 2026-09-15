-- AlterTable: 给 Tenant 加 logo 字段（可空，存上传文件路径 /uploads/xxx.png）
ALTER TABLE `Tenant` ADD COLUMN `logo` VARCHAR(191) NULL;
