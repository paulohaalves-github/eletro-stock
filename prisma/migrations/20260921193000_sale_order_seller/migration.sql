-- AlterTable
ALTER TABLE `sale_orders` ADD COLUMN `seller_id` INTEGER NULL;

UPDATE `sale_orders` SET `seller_id` = `created_by` WHERE `seller_id` IS NULL;

ALTER TABLE `sale_orders` MODIFY `seller_id` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `sale_orders_seller_id_idx` ON `sale_orders`(`seller_id`);

-- AddForeignKey
ALTER TABLE `sale_orders` ADD CONSTRAINT `sale_orders_seller_id_fkey` FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
