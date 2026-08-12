ALTER TABLE saved_lists
  ADD INDEX IF NOT EXISTS saved_lists_owner_updated_id_idx (owner_id, updated_at, id);
