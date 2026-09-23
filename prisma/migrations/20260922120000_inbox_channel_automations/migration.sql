-- AlterTable
ALTER TABLE `inbox_channels`
    ADD COLUMN `business_hours_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `timezone` VARCHAR(60) NOT NULL DEFAULT 'America/Sao_Paulo',
    ADD COLUMN `business_hours` JSON NULL,
    ADD COLUMN `after_hours_reply_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `after_hours_message` TEXT NULL,
    ADD COLUMN `greeting_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `greeting_mode` VARCHAR(40) NOT NULL DEFAULT 'FIRST_CONTACT',
    ADD COLUMN `greeting_message` TEXT NULL,
    ADD COLUMN `unanswered_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `unanswered_minutes` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `unanswered_message` TEXT NULL;

-- AlterTable
ALTER TABLE `inbox_conversations`
    ADD COLUMN `greeting_sent_at` DATETIME(3) NULL,
    ADD COLUMN `after_hours_sent_at` DATETIME(3) NULL,
    ADD COLUMN `unanswered_notified_at` DATETIME(3) NULL;
