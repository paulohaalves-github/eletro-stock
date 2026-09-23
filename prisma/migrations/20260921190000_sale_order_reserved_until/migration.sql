-- AlterTable
ALTER TABLE `sale_order_items` ADD COLUMN `reserved_until` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `sale_order_items_reserved_until_idx` ON `sale_order_items`(`reserved_until`);
