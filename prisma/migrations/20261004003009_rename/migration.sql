-- AddForeignKey
ALTER TABLE `ProductJoinSku` ADD CONSTRAINT `ProductJoinSku_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
