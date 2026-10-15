-- CreateTable
CREATE TABLE `inventory_counts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(20) NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `location_id` INTEGER NULL,
    `location_label` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ABERTO',
    `notes` TEXT NULL,
    `expected_count` INTEGER NOT NULL DEFAULT 0,
    `created_by` INTEGER NOT NULL,
    `assigned_to` INTEGER NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `completed_by` INTEGER NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancelled_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_counts_number_key`(`number`),
    INDEX `inventory_counts_unit_id_status_idx`(`unit_id`, `status`),
    INDEX `inventory_counts_assigned_to_idx`(`assigned_to`),
    INDEX `inventory_counts_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_expected_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inventory_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `serial_onyx` VARCHAR(120) NOT NULL,
    `commercial_name` VARCHAR(190) NULL,
    `status` VARCHAR(40) NOT NULL,
    `location_label` VARCHAR(255) NULL,

    UNIQUE INDEX `inventory_expected_items_inventory_id_product_id_key`(`inventory_id`, `product_id`),
    INDEX `inventory_expected_items_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_scans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inventory_id` INTEGER NOT NULL,
    `product_id` INTEGER NULL,
    `raw_code` VARCHAR(190) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `serial_onyx` VARCHAR(120) NULL,
    `commercial_name` VARCHAR(190) NULL,
    `product_status` VARCHAR(40) NULL,
    `unit_name` VARCHAR(120) NULL,
    `note` VARCHAR(255) NULL,
    `scanned_by` INTEGER NOT NULL,
    `scanned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inventory_scans_inventory_id_product_id_key`(`inventory_id`, `product_id`),
    INDEX `inventory_scans_inventory_id_scanned_at_idx`(`inventory_id`, `scanned_at`),
    INDEX `inventory_scans_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_completed_by_fkey` FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_cancelled_by_fkey` FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_expected_items` ADD CONSTRAINT `inventory_expected_items_inventory_id_fkey` FOREIGN KEY (`inventory_id`) REFERENCES `inventory_counts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_expected_items` ADD CONSTRAINT `inventory_expected_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inventory_scans` ADD CONSTRAINT `inventory_scans_inventory_id_fkey` FOREIGN KEY (`inventory_id`) REFERENCES `inventory_counts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_scans` ADD CONSTRAINT `inventory_scans_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `inventory_scans` ADD CONSTRAINT `inventory_scans_scanned_by_fkey` FOREIGN KEY (`scanned_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
