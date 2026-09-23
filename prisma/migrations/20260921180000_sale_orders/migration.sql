-- CreateTable
CREATE TABLE `sale_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(40) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `observation` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `ordered_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sale_orders_number_key`(`number`),
    INDEX `sale_orders_customer_id_idx`(`customer_id`),
    INDEX `sale_orders_unit_id_idx`(`unit_id`),
    INDEX `sale_orders_status_idx`(`status`),
    INDEX `sale_orders_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sale_order_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `cash_price` DOUBLE NULL,
    `sale_id` INTEGER NULL,
    `warranty_months` INTEGER NULL,
    `invoice_number` VARCHAR(40) NULL,
    `reserved_at` DATETIME(3) NULL,
    `sold_at` DATETIME(3) NULL,
    `sold_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sale_order_items_product_id_idx`(`product_id`),
    INDEX `sale_order_items_status_idx`(`status`),
    INDEX `sale_order_items_sale_id_idx`(`sale_id`),
    UNIQUE INDEX `sale_order_items_sale_order_id_product_id_key`(`sale_order_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_order_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sale_order_id` INTEGER NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `message` TEXT NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sale_order_events_sale_order_id_idx`(`sale_order_id`),
    INDEX `sale_order_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sale_orders` ADD CONSTRAINT `sale_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_orders` ADD CONSTRAINT `sale_orders_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_orders` ADD CONSTRAINT `sale_orders_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_order_items` ADD CONSTRAINT `sale_order_items_sale_order_id_fkey` FOREIGN KEY (`sale_order_id`) REFERENCES `sale_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_order_items` ADD CONSTRAINT `sale_order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_order_items` ADD CONSTRAINT `sale_order_items_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_order_items` ADD CONSTRAINT `sale_order_items_sold_by_fkey` FOREIGN KEY (`sold_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_order_events` ADD CONSTRAINT `sale_order_events_sale_order_id_fkey` FOREIGN KEY (`sale_order_id`) REFERENCES `sale_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_order_events` ADD CONSTRAINT `sale_order_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
