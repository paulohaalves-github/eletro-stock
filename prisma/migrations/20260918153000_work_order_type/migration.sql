-- AlterTable
ALTER TABLE `work_orders` ADD COLUMN `type` VARCHAR(40) NOT NULL DEFAULT 'POS_VENDA';

-- Backfill existing orders as after-sales
UPDATE `work_orders` SET `type` = 'POS_VENDA' WHERE `type` IS NULL OR `type` = '';

-- DropForeignKey
ALTER TABLE `work_orders` DROP FOREIGN KEY `work_orders_sale_id_fkey`;

-- DropForeignKey
ALTER TABLE `work_orders` DROP FOREIGN KEY `work_orders_customer_id_fkey`;

-- AlterTable
ALTER TABLE `work_orders` MODIFY `sale_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `work_orders` MODIFY `customer_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `work_orders_type_idx` ON `work_orders`(`type`);
