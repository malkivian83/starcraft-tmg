CREATE TABLE IF NOT EXISTS support_tickets (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  contact_email VARCHAR(254) NOT NULL,
  subject VARCHAR(160) NOT NULL,
  status ENUM('OPEN', 'ANSWERED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  terms_version VARCHAR(32) NOT NULL,
  terms_accepted_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX support_tickets_status_updated_idx (status, updated_at),
  INDEX support_tickets_email_idx (contact_email),
  CONSTRAINT support_tickets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS support_messages (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  author_type ENUM('USER', 'ADMIN') NOT NULL,
  author_user_id CHAR(36) NULL,
  body TEXT NOT NULL,
  delivery_status ENUM('PENDING', 'SENT', 'FAILED', 'NOT_APPLICABLE') NOT NULL DEFAULT 'PENDING',
  provider_message_id VARCHAR(255) NULL,
  delivery_error VARCHAR(1000) NULL,
  delivered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX support_messages_ticket_created_idx (ticket_id, created_at, id),
  INDEX support_messages_delivery_idx (delivery_status, created_at),
  CONSTRAINT support_messages_ticket_fk FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT support_messages_author_fk FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE email_delivery_logs
  MODIFY COLUMN message_type ENUM('VERIFY_EMAIL', 'RESET_PASSWORD', 'SMTP_TEST', 'ACCOUNT_VERIFIED', 'SUPPORT_CREATED', 'SUPPORT_REPLY') NOT NULL;
