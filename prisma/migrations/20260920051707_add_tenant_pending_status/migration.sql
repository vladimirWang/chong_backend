-- AlterTable: TenantStatus 增加 PENDING（create 型租户审核通过时创建，首个用户激活后转为 ACTIVE）
ALTER TABLE `Tenant`
    MODIFY `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE';
