/*
  Warnings:

  - Added the required column `createdBy` to the `Vendor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deletedBy` to the `Vendor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `Vendor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Vendor` ADD COLUMN `createdBy` INTEGER NULL,
    ADD COLUMN `deletedBy` INTEGER NULL,
    ADD COLUMN `updatedBy` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE `Vendor` SET `createdBy` = 3, `updatedBy` = 3, `deletedBy` = 3 ;

ALTER TABLE `Vendor` MODIFY COLUMN `createdBy` INTEGER NOT NULL,
    MODIFY COLUMN `deletedBy` INTEGER NOT NULL,
    MODIFY COLUMN `updatedBy` INTEGER NOT NULL;