/*
  Warnings:

  - A unique constraint covering the columns `[stockInId,productId]` on the table `ProductJoinStockIn` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `ProductJoinStockIn_stockInId_productId_key` ON `ProductJoinStockIn`(`stockInId`, `productId`);
