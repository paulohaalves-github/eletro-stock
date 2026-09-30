-- AlterTable
ALTER TABLE `sale_orders` ADD COLUMN `ov` VARCHAR(40) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `sale_orders_ov_key` ON `sale_orders`(`ov`);
