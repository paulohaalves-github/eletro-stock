-- CreateTable
CREATE TABLE `location_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `location_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `location_type_id` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `locations_location_type_id_idx`(`location_type_id`),
    UNIQUE INDEX `locations_location_type_id_name_key`(`location_type_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `location_id` INTEGER NULL;
CREATE INDEX `products_location_id_idx` ON `products`(`location_id`);

-- AlterTable
ALTER TABLE `stock_movements` ADD COLUMN `previous_location_id` INTEGER NULL;
ALTER TABLE `stock_movements` ADD COLUMN `new_location_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_location_type_id_fkey` FOREIGN KEY (`location_type_id`) REFERENCES `location_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `products` ADD CONSTRAINT `products_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_previous_location_id_fkey` FOREIGN KEY (`previous_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_new_location_id_fkey` FOREIGN KEY (`new_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
