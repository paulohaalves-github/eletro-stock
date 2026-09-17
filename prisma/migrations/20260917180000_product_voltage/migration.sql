-- AlterTable
ALTER TABLE `products` ADD COLUMN `voltage` VARCHAR(20) NULL;

-- CreateIndex
CREATE INDEX `products_voltage_idx` ON `products`(`voltage`);
