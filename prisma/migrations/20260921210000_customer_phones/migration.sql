CREATE TABLE `customer_phones` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `customer_id` INTEGER NOT NULL,
  `phone` VARCHAR(40) NOT NULL,
  `digits` VARCHAR(20) NOT NULL,
  `label` VARCHAR(40) NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `customer_phones` (`customer_id`, `phone`, `digits`, `is_primary`, `created_at`)
SELECT
  `id`,
  `phone`,
  CASE
    WHEN CHAR_LENGTH(REGEXP_REPLACE(`phone`, '[^0-9]', '')) IN (10, 11)
      THEN CONCAT('55', REGEXP_REPLACE(`phone`, '[^0-9]', ''))
    ELSE REGEXP_REPLACE(`phone`, '[^0-9]', '')
  END,
  true,
  `created_at`
FROM `customers`
WHERE `phone` IS NOT NULL
  AND `phone` <> ''
  AND REGEXP_REPLACE(`phone`, '[^0-9]', '') <> '';

CREATE UNIQUE INDEX `customer_phones_customer_id_digits_key` ON `customer_phones`(`customer_id`, `digits`);
CREATE INDEX `customer_phones_digits_idx` ON `customer_phones`(`digits`);
CREATE INDEX `customer_phones_customer_id_idx` ON `customer_phones`(`customer_id`);

ALTER TABLE `customer_phones`
  ADD CONSTRAINT `customer_phones_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
