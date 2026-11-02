-- AlterTable
ALTER TABLE `sale_orders` MODIFY `seller_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `inbox_conversations`
    ADD COLUMN `waitlist_commercial_name` VARCHAR(190) NULL,
    ADD COLUMN `waitlist_model_code` VARCHAR(120) NULL,
    ADD COLUMN `waitlist_capacity` VARCHAR(120) NULL,
    ADD COLUMN `waitlist_voltage` VARCHAR(20) NULL,
    ADD COLUMN `waitlist_condition` VARCHAR(40) NULL,
    ADD COLUMN `waitlist_category_id` INTEGER NULL,
    ADD COLUMN `waitlist_line_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `inbox_waitlist_matches` (
    `conversation_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inbox_waitlist_matches_product_id_idx`(`product_id`),
    PRIMARY KEY (`conversation_id`, `product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inbox_waitlist_matches` ADD CONSTRAINT `inbox_waitlist_matches_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `inbox_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_waitlist_matches` ADD CONSTRAINT `inbox_waitlist_matches_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
