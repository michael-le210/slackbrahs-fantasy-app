CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_name VARCHAR(64) NOT NULL,
  yahoo_user_id VARCHAR(255) NULL,
  display_name VARCHAR(255) NULL,
  route VARCHAR(128) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code SMALLINT UNSIGNED NULL,
  metadata JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_activity_created_at (created_at),
  INDEX idx_activity_user_created (yahoo_user_id, created_at),
  INDEX idx_activity_event_created (event_name, created_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

