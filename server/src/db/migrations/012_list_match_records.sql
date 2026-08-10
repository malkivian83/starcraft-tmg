CREATE TABLE IF NOT EXISTS list_match_records (
  id CHAR(36) PRIMARY KEY,
  list_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  result ENUM('WIN', 'LOSS', 'DRAW') NOT NULL,
  played_on DATE NULL,
  opponent_race ENUM('ZERG', 'TERRAN', 'PROTOSS') NULL,
  opponent_faction_card_id VARCHAR(64) NULL,
  opponent_name VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX list_match_records_list_idx (list_id, played_on, created_at),
  INDEX list_match_records_owner_idx (owner_id),
  CONSTRAINT list_match_records_list_fk FOREIGN KEY (list_id) REFERENCES saved_lists(id) ON DELETE CASCADE,
  CONSTRAINT list_match_records_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
