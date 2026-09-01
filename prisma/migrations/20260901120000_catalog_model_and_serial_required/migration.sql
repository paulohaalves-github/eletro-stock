-- CreateTable
CREATE TABLE `catalog_models` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_model_code` VARCHAR(120) NOT NULL,
    `commercial_name` VARCHAR(190) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `catalog_models_supplier_model_code_key`(`supplier_model_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill catalog from existing model codes
INSERT INTO `catalog_models` (`supplier_model_code`, `commercial_name`, `created_at`, `updated_at`)
SELECT DISTINCT `supplier_model_code`, `supplier_model_code`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `products`
WHERE `supplier_model_code` IS NOT NULL AND `supplier_model_code` <> '';

-- AlterTable
ALTER TABLE `products` ADD COLUMN `catalog_model_id` INTEGER NULL;

CREATE INDEX `products_catalog_model_id_idx` ON `products`(`catalog_model_id`);

UPDATE `products` `p`
INNER JOIN `catalog_models` `c` ON `c`.`supplier_model_code` = `p`.`supplier_model_code`
SET `p`.`catalog_model_id` = `c`.`id`;

ALTER TABLE `products` ADD CONSTRAINT `products_catalog_model_id_fkey` FOREIGN KEY (`catalog_model_id`) REFERENCES `catalog_models`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Serial Onyx required and unique
UPDATE `products` SET `serial_onyx` = CONCAT('TEMP-', `id`) WHERE `serial_onyx` IS NULL OR `serial_onyx` = '';

ALTER TABLE `products` MODIFY `serial_onyx` VARCHAR(120) NOT NULL;
