ALTER TABLE `sales` ADD COLUMN `payment_method` VARCHAR(80) NULL;
ALTER TABLE `sales` ADD COLUMN `installment_count` INTEGER NULL;

ALTER TABLE `sale_orders` ADD COLUMN `payment_method` VARCHAR(80) NULL;
ALTER TABLE `sale_orders` ADD COLUMN `installment_count` INTEGER NULL;
