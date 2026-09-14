-- AlterTable
ALTER TABLE `customers` ADD COLUMN `address` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `invoice_number` VARCHAR(40) NULL;
