-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `units_name_key`(`name`),
    UNIQUE INDEX `units_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `units` (`name`, `slug`, `type`, `active`, `created_at`, `updated_at`) VALUES
('Onyx Outlet', 'onyx', 'MATRIZ', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('Eletromall Outlet', 'eletromall', 'FILIAL', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- CreateTable
CREATE TABLE `user_units` (
    `user_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,

    INDEX `user_units_unit_id_idx`(`unit_id`),
    PRIMARY KEY (`user_id`, `unit_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `user_units` (`user_id`, `unit_id`)
SELECT `id`, (SELECT `id` FROM `units` WHERE `slug` = 'onyx') FROM `users`;

-- AlterTable locations
ALTER TABLE `locations` ADD COLUMN `unit_id` INTEGER NULL;

UPDATE `locations`
SET `unit_id` = (SELECT `id` FROM `units` WHERE `slug` = 'onyx')
WHERE `unit_id` IS NULL;

ALTER TABLE `locations` MODIFY `unit_id` INTEGER NOT NULL;

DROP INDEX `locations_location_type_id_name_key` ON `locations`;

CREATE UNIQUE INDEX `locations_unit_id_location_type_id_name_key` ON `locations`(`unit_id`, `location_type_id`, `name`);
CREATE INDEX `locations_unit_id_idx` ON `locations`(`unit_id`);

-- AlterTable products
ALTER TABLE `products` ADD COLUMN `unit_id` INTEGER NULL;
ALTER TABLE `products` ADD COLUMN `transfer_to_unit_id` INTEGER NULL;

UPDATE `products`
SET `unit_id` = (SELECT `id` FROM `units` WHERE `slug` = 'onyx')
WHERE `unit_id` IS NULL;

ALTER TABLE `products` MODIFY `unit_id` INTEGER NOT NULL;

CREATE INDEX `products_unit_id_idx` ON `products`(`unit_id`);
CREATE INDEX `products_transfer_to_unit_id_idx` ON `products`(`transfer_to_unit_id`);

-- AlterTable stock_movements
ALTER TABLE `stock_movements` ADD COLUMN `previous_unit_id` INTEGER NULL;
ALTER TABLE `stock_movements` ADD COLUMN `new_unit_id` INTEGER NULL;

UPDATE `stock_movements`
SET `previous_unit_id` = (SELECT `id` FROM `units` WHERE `slug` = 'onyx'),
    `new_unit_id` = (SELECT `id` FROM `units` WHERE `slug` = 'onyx');

CREATE INDEX `stock_movements_previous_unit_id_idx` ON `stock_movements`(`previous_unit_id`);
CREATE INDEX `stock_movements_new_unit_id_idx` ON `stock_movements`(`new_unit_id`);

-- AddForeignKey
ALTER TABLE `user_units` ADD CONSTRAINT `user_units_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_units` ADD CONSTRAINT `user_units_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `locations` ADD CONSTRAINT `locations_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `products` ADD CONSTRAINT `products_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `products` ADD CONSTRAINT `products_transfer_to_unit_id_fkey` FOREIGN KEY (`transfer_to_unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_previous_unit_id_fkey` FOREIGN KEY (`previous_unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_new_unit_id_fkey` FOREIGN KEY (`new_unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
