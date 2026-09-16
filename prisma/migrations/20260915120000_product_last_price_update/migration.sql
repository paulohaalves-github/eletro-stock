-- AlterTable
ALTER TABLE `products` ADD COLUMN `last_price_update_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Backfill: use entry date as baseline for existing products
UPDATE `products` SET `last_price_update_at` = `entry_date` WHERE `last_price_update_at` IS NOT NULL;

-- CreateIndex
CREATE INDEX `products_last_price_update_at_idx` ON `products`(`last_price_update_at`);
