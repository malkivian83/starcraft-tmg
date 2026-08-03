ALTER TABLE saved_lists
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER owner_id,
  ADD COLUMN published_at DATETIME NULL AFTER is_public,
  ADD INDEX saved_lists_public_published_idx (is_public, published_at);
