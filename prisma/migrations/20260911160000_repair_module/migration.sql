-- CreateTable
CREATE TABLE `customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(190) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `document` VARCHAR(20) NULL,
    `email` VARCHAR(190) NULL,
    `notes` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customers_name_idx`(`name`),
    INDEX `customers_phone_idx`(`phone`),
    INDEX `customers_document_idx`(`document`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `sold_at` DATETIME(3) NOT NULL,
    `warranty_months` INTEGER NOT NULL,
    `observation` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sales_product_id_idx`(`product_id`),
    INDEX `sales_customer_id_idx`(`customer_id`),
    INDEX `sales_unit_id_idx`(`unit_id`),
    INDEX `sales_sold_at_idx`(`sold_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(40) NOT NULL,
    `product_id` INTEGER NOT NULL,
    `sale_id` INTEGER NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `lab_unit_id` INTEGER NULL,
    `service_place` VARCHAR(40) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `reported_defect` TEXT NOT NULL,
    `analysis_notes` TEXT NULL,
    `technician_notes` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `technician_id` INTEGER NULL,
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `work_orders_number_key`(`number`),
    INDEX `work_orders_product_id_idx`(`product_id`),
    INDEX `work_orders_sale_id_idx`(`sale_id`),
    INDEX `work_orders_customer_id_idx`(`customer_id`),
    INDEX `work_orders_unit_id_idx`(`unit_id`),
    INDEX `work_orders_lab_unit_id_idx`(`lab_unit_id`),
    INDEX `work_orders_status_idx`(`status`),
    INDEX `work_orders_service_place_idx`(`service_place`),
    INDEX `work_orders_opened_at_idx`(`opened_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_order_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `message` TEXT NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `work_order_events_work_order_id_idx`(`work_order_id`),
    INDEX `work_order_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_order_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NULL,
    `file_size` INTEGER NULL,
    `uploaded_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `work_order_images_work_order_id_idx`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_order_parts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `part_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `unit_id` INTEGER NULL,
    `location_id` INTEGER NULL,
    `observation` TEXT NULL,
    `requested_by` INTEGER NOT NULL,
    `fulfilled_by` INTEGER NULL,
    `fulfilled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `work_order_parts_work_order_id_idx`(`work_order_id`),
    INDEX `work_order_parts_part_id_idx`(`part_id`),
    INDEX `work_order_parts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(190) NOT NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `parts_code_key`(`code`),
    INDEX `parts_name_idx`(`name`),
    INDEX `parts_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `part_stocks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `part_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `location_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `part_stocks_unit_id_idx`(`unit_id`),
    INDEX `part_stocks_location_id_idx`(`location_id`),
    UNIQUE INDEX `part_stocks_part_id_unit_id_location_id_key`(`part_id`, `unit_id`, `location_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `part_movements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `part_id` INTEGER NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `previous_quantity` INTEGER NULL,
    `new_quantity` INTEGER NULL,
    `unit_id` INTEGER NOT NULL,
    `location_id` INTEGER NULL,
    `to_unit_id` INTEGER NULL,
    `to_location_id` INTEGER NULL,
    `work_order_id` INTEGER NULL,
    `observation` TEXT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `part_movements_part_id_idx`(`part_id`),
    INDEX `part_movements_unit_id_idx`(`unit_id`),
    INDEX `part_movements_created_at_idx`(`created_at`),
    INDEX `part_movements_type_idx`(`type`),
    INDEX `part_movements_work_order_id_idx`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `part_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `part_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `from_unit_id` INTEGER NOT NULL,
    `from_location_id` INTEGER NOT NULL,
    `to_unit_id` INTEGER NOT NULL,
    `to_location_id` INTEGER NULL,
    `status` VARCHAR(40) NOT NULL,
    `observation` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `received_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `part_transfers_part_id_idx`(`part_id`),
    INDEX `part_transfers_from_unit_id_idx`(`from_unit_id`),
    INDEX `part_transfers_to_unit_id_idx`(`to_unit_id`),
    INDEX `part_transfers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `sales` ADD CONSTRAINT `sales_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales` ADD CONSTRAINT `sales_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales` ADD CONSTRAINT `sales_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales` ADD CONSTRAINT `sales_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_lab_unit_id_fkey` FOREIGN KEY (`lab_unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_technician_id_fkey` FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `work_order_events` ADD CONSTRAINT `work_order_events_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `work_order_events` ADD CONSTRAINT `work_order_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `work_order_images` ADD CONSTRAINT `work_order_images_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `work_order_images` ADD CONSTRAINT `work_order_images_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `work_order_parts` ADD CONSTRAINT `work_order_parts_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `work_order_parts` ADD CONSTRAINT `work_order_parts_part_id_fkey` FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `work_order_parts` ADD CONSTRAINT `work_order_parts_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `work_order_parts` ADD CONSTRAINT `work_order_parts_fulfilled_by_fkey` FOREIGN KEY (`fulfilled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `parts` ADD CONSTRAINT `parts_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `part_stocks` ADD CONSTRAINT `part_stocks_part_id_fkey` FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `part_stocks` ADD CONSTRAINT `part_stocks_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `part_stocks` ADD CONSTRAINT `part_stocks_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `part_movements` ADD CONSTRAINT `part_movements_part_id_fkey` FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `part_movements` ADD CONSTRAINT `part_movements_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `part_movements` ADD CONSTRAINT `part_movements_to_unit_id_fkey` FOREIGN KEY (`to_unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `part_movements` ADD CONSTRAINT `part_movements_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `part_movements` ADD CONSTRAINT `part_movements_to_location_id_fkey` FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `part_movements` ADD CONSTRAINT `part_movements_work_order_id_fkey` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `part_movements` ADD CONSTRAINT `part_movements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `part_transfers` ADD CONSTRAINT `part_transfers_part_id_fkey` FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `part_transfers` ADD CONSTRAINT `part_transfers_from_unit_id_fkey` FOREIGN KEY (`from_unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `part_transfers` ADD CONSTRAINT `part_transfers_to_unit_id_fkey` FOREIGN KEY (`to_unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `part_transfers` ADD CONSTRAINT `part_transfers_from_location_id_fkey` FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `part_transfers` ADD CONSTRAINT `part_transfers_to_location_id_fkey` FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `part_transfers` ADD CONSTRAINT `part_transfers_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `part_transfers` ADD CONSTRAINT `part_transfers_received_by_fkey` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
