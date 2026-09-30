-- AlterTable
ALTER TABLE `inbox_messages` ADD COLUMN `quoted_external_id` VARCHAR(190) NULL;

-- CreateIndex
CREATE INDEX `inbox_messages_quoted_external_id_idx` ON `inbox_messages`(`quoted_external_id`);
