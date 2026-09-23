-- AlterTable
ALTER TABLE `products`
    ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `deleted_by` INTEGER NULL;

-- CreateIndex
CREATE INDEX `products_deleted_at_idx` ON `products`(`deleted_at`);

-- CreateIndex
CREATE INDEX `products_deleted_by_idx` ON `products`(`deleted_by`);

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_deleted_by_fkey` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
