-- DropIndex
DROP INDEX `ProductVariant_productId_specSkuIds_key` ON `ProductVariant`;

-- AlterTable
ALTER TABLE `ProductVariant` DROP COLUMN `specSkuIds`;
