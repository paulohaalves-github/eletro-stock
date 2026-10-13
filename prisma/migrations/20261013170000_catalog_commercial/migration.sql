-- AlterTable
ALTER TABLE `catalog_models`
    ADD COLUMN `manufacturer` VARCHAR(160) NULL,
    ADD COLUMN `specifications` TEXT NULL;

-- AlterTable
ALTER TABLE `product_images`
    ADD COLUMN `catalog_public` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `catalog_commercial_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `catalog_model_id` INTEGER NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NULL,
    `file_size` INTEGER NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'upload',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `catalog_commercial_images_catalog_model_id_idx`(`catalog_model_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `catalog_commercial_images` ADD CONSTRAINT `catalog_commercial_images_catalog_model_id_fkey` FOREIGN KEY (`catalog_model_id`) REFERENCES `catalog_models`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
