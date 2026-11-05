ALTER TABLE `inbox_channels` ADD COLUMN `page_external_id` VARCHAR(64) NULL;

ALTER TABLE `inbox_conversations` MODIFY `phone` VARCHAR(40) NULL;
ALTER TABLE `inbox_conversations` ADD COLUMN `external_contact_id` VARCHAR(80) NULL;
CREATE UNIQUE INDEX `inbox_conversations_channel_id_external_contact_id_key` ON `inbox_conversations`(`channel_id`, `external_contact_id`);
