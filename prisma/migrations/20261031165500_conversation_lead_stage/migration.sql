-- AlterTable
ALTER TABLE `inbox_conversations`
    ADD COLUMN `commercial_stage` VARCHAR(40) NOT NULL DEFAULT 'NOVO',
    ADD COLUMN `commercial_stage_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `inbox_conversations_commercial_stage_idx` ON `inbox_conversations`(`commercial_stage`);

-- Backfill open sales and conversations already accepted by an agent
UPDATE `inbox_conversations` `c`
INNER JOIN `sale_orders` `s` ON `s`.`conversation_id` = `c`.`id`
SET `c`.`commercial_stage` = 'EM_VENDA',
    `c`.`commercial_stage_at` = `c`.`updated_at`
WHERE `s`.`closed_at` IS NULL
  AND `s`.`status` NOT IN ('CONCRETIZADA', 'PERDIDA', 'CANCELADA');

UPDATE `inbox_conversations`
SET `commercial_stage` = 'EM_QUALIFICACAO',
    `commercial_stage_at` = COALESCE(`accepted_at`, `updated_at`)
WHERE `commercial_stage` = 'NOVO'
  AND `accepted_at` IS NOT NULL;
