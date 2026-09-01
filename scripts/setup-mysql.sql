CREATE DATABASE IF NOT EXISTS eletro_stock
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'eletro'@'localhost' IDENTIFIED BY 'eletrostock';
GRANT ALL PRIVILEGES ON eletro_stock.* TO 'eletro'@'localhost';
FLUSH PRIVILEGES;
