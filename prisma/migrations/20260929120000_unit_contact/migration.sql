-- AlterTable
ALTER TABLE `units`
    ADD COLUMN `email` VARCHAR(190) NULL,
    ADD COLUMN `phone` VARCHAR(40) NULL,
    ADD COLUMN `phone_secondary` VARCHAR(40) NULL,
    ADD COLUMN `whatsapp` VARCHAR(40) NULL,
    ADD COLUMN `street` VARCHAR(190) NULL,
    ADD COLUMN `address_number` VARCHAR(20) NULL,
    ADD COLUMN `neighborhood` VARCHAR(120) NULL,
    ADD COLUMN `city` VARCHAR(120) NULL,
    ADD COLUMN `state` VARCHAR(2) NULL,
    ADD COLUMN `zip_code` VARCHAR(12) NULL,
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL,
    ADD COLUMN `catalog_visible` BOOLEAN NOT NULL DEFAULT false;
