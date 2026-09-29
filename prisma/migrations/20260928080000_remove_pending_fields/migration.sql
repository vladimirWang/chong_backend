-- AlterTable
ALTER TABLE `Product` DROP COLUMN `stockInPending`,
    DROP COLUMN `stockOutPending`;

-- AlterTable
ALTER TABLE `ProductJoinSku` DROP COLUMN `stockInPending`,
    DROP COLUMN `stockOutPending`;
