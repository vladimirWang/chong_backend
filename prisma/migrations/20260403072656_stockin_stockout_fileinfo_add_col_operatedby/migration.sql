/*
  Warnings:

  - Added the required column `createdBy` to the `FileInfo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deletedBy` to the `FileInfo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `FileInfo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `StockIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deletedBy` to the `StockIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `StockIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `StockOut` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deletedBy` to the `StockOut` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `StockOut` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `FileInfo` ADD COLUMN `createdBy` INTEGER NULL,
    ADD COLUMN `deletedBy` INTEGER NULL,
    ADD COLUMN `updatedBy` INTEGER NULL;

-- AlterTable
ALTER TABLE `StockIn` ADD COLUMN `createdBy` INTEGER NULL,
    ADD COLUMN `deletedBy` INTEGER NULL,
    ADD COLUMN `updatedBy` INTEGER NULL;

-- AlterTable
ALTER TABLE `StockOut` ADD COLUMN `createdBy` INTEGER NULL,
    ADD COLUMN `deletedBy` INTEGER NULL,
    ADD COLUMN `updatedBy` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileInfo` ADD CONSTRAINT `FileInfo_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileInfo` ADD CONSTRAINT `FileInfo_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileInfo` ADD CONSTRAINT `FileInfo_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE `FileInfo` SET `createdBy` = 3, `updatedBy` = 3, `deletedBy` = 3 ;
UPDATE `StockIn` SET `createdBy` = 3, `updatedBy` = 3, `deletedBy` = 3 ;
UPDATE `StockOut` SET `createdBy` = 3, `updatedBy` = 3, `deletedBy` = 3 ;

-- AlterTable
ALTER TABLE `FileInfo` MODIFY COLUMN `createdBy` INTEGER NOT NULL,
    MODIFY COLUMN `deletedBy` INTEGER NOT NULL,
    MODIFY COLUMN `updatedBy` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `StockIn` MODIFY COLUMN `createdBy` INTEGER NOT NULL,
    MODIFY COLUMN `deletedBy` INTEGER NOT NULL,
    MODIFY COLUMN `updatedBy` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `StockOut` MODIFY COLUMN `createdBy` INTEGER NOT NULL,
    MODIFY COLUMN `deletedBy` INTEGER NOT NULL,
    MODIFY COLUMN `updatedBy` INTEGER NOT NULL;