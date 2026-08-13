ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS locale ENUM('es', 'en') NOT NULL DEFAULT 'es';

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS locale ENUM('es', 'en') NOT NULL DEFAULT 'es';

ALTER TABLE email_delivery_logs
  ADD COLUMN IF NOT EXISTS locale ENUM('es', 'en') NOT NULL DEFAULT 'es';

CREATE TABLE IF NOT EXISTS user_terms_acceptances (
  user_id CHAR(36) NOT NULL,
  terms_version VARCHAR(32) NOT NULL,
  locale ENUM('es', 'en') NOT NULL,
  accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source ENUM('PASSWORD_REGISTRATION', 'GOOGLE_REGISTRATION') NOT NULL,
  PRIMARY KEY (user_id, terms_version, locale),
  CONSTRAINT user_terms_acceptances_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
