-- AlterTable
ALTER TABLE `StockIn` ADD COLUMN `submittedAt` DATETIME(3) NULL;

UPDATE StockIn SET submittedAt = createdAt WHERE submittedAt IS NULL;

ALTER TABLE `StockIn` MODIFY COLUMN `submittedAt` DATETIME(3) NOT NULL;
