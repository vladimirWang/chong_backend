-- AlterTable: 给 Tenant 加 superUserId 字段（可空，指向 User.id）
ALTER TABLE `Tenant` ADD COLUMN `superUserId` INTEGER NULL;

-- CreateIndex: superUserId 唯一索引（一对一 relation 要求）
CREATE UNIQUE INDEX `Tenant_superUserId_key` ON `Tenant`(`superUserId`);

-- AddForeignKey: Tenant.superUserId → User.id
ALTER TABLE `Tenant` ADD CONSTRAINT `Tenant_superUserId_fkey` FOREIGN KEY (`superUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
