CREATE TABLE email_delivery_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipient VARCHAR(254) NOT NULL,
  message_type ENUM('VERIFY_EMAIL', 'RESET_PASSWORD', 'SMTP_TEST') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status ENUM('SENT', 'FAILED') NOT NULL,
  provider_message_id VARCHAR(255) NULL,
  error_message VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX email_delivery_logs_created_idx (created_at),
  INDEX email_delivery_logs_status_idx (status, created_at)
) ENGINE=InnoDB;
