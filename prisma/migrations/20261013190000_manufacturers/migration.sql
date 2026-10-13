-- CreateTable
CREATE TABLE `manufacturers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(160) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `manufacturers_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Copy existing names
INSERT INTO `manufacturers` (`name`, `active`, `created_at`, `updated_at`)
SELECT DISTINCT TRIM(`manufacturer`), true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `catalog_models`
WHERE `manufacturer` IS NOT NULL AND TRIM(`manufacturer`) <> '';

-- AlterTable
ALTER TABLE `catalog_models` ADD COLUMN `manufacturer_id` INTEGER NULL;

UPDATE `catalog_models` AS `cm`
INNER JOIN `manufacturers` AS `m` ON `m`.`name` = TRIM(`cm`.`manufacturer`)
SET `cm`.`manufacturer_id` = `m`.`id`;

ALTER TABLE `catalog_models` DROP COLUMN `manufacturer`;

-- CreateIndex
CREATE INDEX `catalog_models_manufacturer_id_idx` ON `catalog_models`(`manufacturer_id`);

-- AddForeignKey
ALTER TABLE `catalog_models` ADD CONSTRAINT `catalog_models_manufacturer_id_fkey` FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
