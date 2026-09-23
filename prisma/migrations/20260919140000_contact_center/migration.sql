-- CreateTable
CREATE TABLE `inbox_teams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `color` VARCHAR(20) NOT NULL DEFAULT '#22d3ee',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inbox_teams_name_key`(`name`),
    UNIQUE INDEX `inbox_teams_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inbox_team_members` (
    `team_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` VARCHAR(40) NOT NULL DEFAULT 'AGENT',
    `conversation_limit` INTEGER NOT NULL DEFAULT 0,

    INDEX `inbox_team_members_user_id_idx`(`user_id`),
    PRIMARY KEY (`team_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inbox_channels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `type` VARCHAR(40) NOT NULL DEFAULT 'WHATSAPP',
    `provider` VARCHAR(40) NOT NULL,
    `phone_number` VARCHAR(40) NULL,
    `external_id` VARCHAR(120) NULL,
    `api_key` TEXT NULL,
    `webhook_secret` VARCHAR(255) NULL,
    `connection_status` VARCHAR(40) NOT NULL DEFAULT 'DISCONNECTED',
    `connection_error` TEXT NULL,
    `qr_payload` LONGTEXT NULL,
    `default_team_id` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inbox_channels_provider_idx`(`provider`),
    INDEX `inbox_channels_default_team_id_idx`(`default_team_id`),
    INDEX `inbox_channels_phone_number_idx`(`phone_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inbox_conversations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel_id` INTEGER NOT NULL,
    `team_id` INTEGER NOT NULL,
    `customer_id` INTEGER NULL,
    `agent_id` INTEGER NULL,
    `accepted_by` INTEGER NULL,
    `closed_by` INTEGER NULL,
    `phone` VARCHAR(40) NOT NULL,
    `contact_name` VARCHAR(190) NULL,
    `status` VARCHAR(40) NOT NULL,
    `last_message_preview` VARCHAR(255) NULL,
    `last_message_direction` VARCHAR(20) NULL,
    `last_message_at` DATETIME(3) NULL,
    `last_customer_message_at` DATETIME(3) NULL,
    `last_agent_message_at` DATETIME(3) NULL,
    `queued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `accepted_at` DATETIME(3) NULL,
    `first_response_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `reopened_at` DATETIME(3) NULL,
    `waiting_since` DATETIME(3) NULL,
    `unread_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inbox_conversations_team_id_idx`(`team_id`),
    INDEX `inbox_conversations_customer_id_idx`(`customer_id`),
    INDEX `inbox_conversations_agent_id_idx`(`agent_id`),
    INDEX `inbox_conversations_status_idx`(`status`),
    INDEX `inbox_conversations_last_message_at_idx`(`last_message_at`),
    UNIQUE INDEX `inbox_conversations_channel_id_phone_key`(`channel_id`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inbox_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversation_id` INTEGER NOT NULL,
    `user_id` INTEGER NULL,
    `direction` VARCHAR(20) NOT NULL,
    `body` TEXT NULL,
    `media_url` VARCHAR(500) NULL,
    `media_type` VARCHAR(80) NULL,
    `file_name` VARCHAR(255) NULL,
    `external_id` VARCHAR(190) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'SENT',
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `delivered_at` DATETIME(3) NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inbox_messages_external_id_key`(`external_id`),
    INDEX `inbox_messages_conversation_id_idx`(`conversation_id`),
    INDEX `inbox_messages_sent_at_idx`(`sent_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inbox_conversation_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversation_id` INTEGER NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `message` TEXT NOT NULL,
    `user_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inbox_conversation_events_conversation_id_idx`(`conversation_id`),
    INDEX `inbox_conversation_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inbox_team_members` ADD CONSTRAINT `inbox_team_members_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `inbox_teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_team_members` ADD CONSTRAINT `inbox_team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_channels` ADD CONSTRAINT `inbox_channels_default_team_id_fkey` FOREIGN KEY (`default_team_id`) REFERENCES `inbox_teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_conversations` ADD CONSTRAINT `inbox_conversations_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `inbox_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_conversations` ADD CONSTRAINT `inbox_conversations_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `inbox_teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_conversations` ADD CONSTRAINT `inbox_conversations_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_conversations` ADD CONSTRAINT `inbox_conversations_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_conversations` ADD CONSTRAINT `inbox_conversations_accepted_by_fkey` FOREIGN KEY (`accepted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_conversations` ADD CONSTRAINT `inbox_conversations_closed_by_fkey` FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_messages` ADD CONSTRAINT `inbox_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `inbox_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_messages` ADD CONSTRAINT `inbox_messages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_conversation_events` ADD CONSTRAINT `inbox_conversation_events_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `inbox_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_conversation_events` ADD CONSTRAINT `inbox_conversation_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
