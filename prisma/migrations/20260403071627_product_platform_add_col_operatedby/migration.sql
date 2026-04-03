/*
  Warnings:

  - Added the required column `createdBy` to the `Platform` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deletedBy` to the `Platform` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `Platform` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deletedBy` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Platform` ADD COLUMN `createdBy` INTEGER NULL,
    ADD COLUMN `deletedBy` INTEGER NULL,
    ADD COLUMN `updatedBy` INTEGER NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `createdBy` INTEGER NULL,
    ADD COLUMN `deletedBy` INTEGER NULL,
    ADD COLUMN `updatedBy` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Platform` ADD CONSTRAINT `Platform_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Platform` ADD CONSTRAINT `Platform_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Platform` ADD CONSTRAINT `Platform_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE `Platform` SET `createdBy` = 3, `updatedBy` = 3, `deletedBy` = 3 ;
UPDATE `Product` SET `createdBy` = 3, `updatedBy` = 3, `deletedBy` = 3 ;

ALTER TABLE `Platform` MODIFY COLUMN `createdBy` INTEGER NOT NULL,
    MODIFY COLUMN `deletedBy` INTEGER NOT NULL,
    MODIFY COLUMN `updatedBy` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Product` MODIFY COLUMN `createdBy` INTEGER NOT NULL,
    MODIFY COLUMN `deletedBy` INTEGER NOT NULL,
    MODIFY COLUMN `updatedBy` INTEGER NOT NULL;