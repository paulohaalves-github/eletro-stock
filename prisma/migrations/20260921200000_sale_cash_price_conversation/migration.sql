-- AlterTable
ALTER TABLE `sales` ADD COLUMN `cash_price` DOUBLE NOT NULL DEFAULT 0;

UPDATE `sales` `s`
INNER JOIN `products` `p` ON `p`.`id` = `s`.`product_id`
SET `s`.`cash_price` = `p`.`cash_price`
WHERE `s`.`cash_price` = 0;

-- AlterTable
ALTER TABLE `sale_orders` ADD COLUMN `conversation_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `sale_orders_conversation_id_idx` ON `sale_orders`(`conversation_id`);

-- AddForeignKey
ALTER TABLE `sale_orders` ADD CONSTRAINT `sale_orders_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `inbox_conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
