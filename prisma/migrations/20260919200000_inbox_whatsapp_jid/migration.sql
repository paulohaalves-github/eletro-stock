-- AlterTable
ALTER TABLE `inbox_conversations` ADD COLUMN `whatsapp_jid` VARCHAR(120) NULL;

-- CreateIndex
CREATE INDEX `inbox_conversations_whatsapp_jid_idx` ON `inbox_conversations`(`whatsapp_jid`);
