ALTER TABLE users
  MODIFY COLUMN password_hash VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) NULL AFTER email_normalized;

ALTER TABLE users
  ADD UNIQUE INDEX IF NOT EXISTS users_google_sub_idx (google_sub);
