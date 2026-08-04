CREATE TABLE saved_list_likes (
  list_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, user_id),
  INDEX saved_list_likes_user_idx (user_id),
  CONSTRAINT saved_list_likes_list_fk FOREIGN KEY (list_id) REFERENCES saved_lists(id) ON DELETE CASCADE,
  CONSTRAINT saved_list_likes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
