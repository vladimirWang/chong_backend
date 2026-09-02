-- 申请人表新增 tenantName：创建型场景存新租户名称，激活时据此创建 Tenant
ALTER TABLE `Applicant` ADD COLUMN `tenantName` VARCHAR(191) NULL;
