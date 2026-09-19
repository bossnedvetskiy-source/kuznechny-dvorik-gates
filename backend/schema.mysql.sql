CREATE TABLE IF NOT EXISTS admin_auth (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_session_token (token_hash),
  KEY idx_admin_session_expiry (expires_at),
  CONSTRAINT fk_admin_session_admin FOREIGN KEY (admin_id) REFERENCES admin_auth(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_rate_limits (
  ip_key VARCHAR(80) NOT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  reset_at DATETIME NOT NULL,
  PRIMARY KEY (ip_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
  `key` VARCHAR(100) NOT NULL,
  value_json LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL,
  value_json LONGTEXT NOT NULL,
  saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100) NOT NULL DEFAULT 'admin',
  PRIMARY KEY (id),
  KEY idx_setting_history (setting_key, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_galleries (
  article VARCHAR(80) NOT NULL,
  photos_json LONGTEXT NOT NULL,
  fit_mode VARCHAR(20) NOT NULL DEFAULT 'contain',
  media_type VARCHAR(20) NOT NULL DEFAULT 'photo',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (article)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_leads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  name VARCHAR(120) NOT NULL DEFAULT '',
  phone VARCHAR(60) NOT NULL,
  city VARCHAR(180) NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'gates',
  source VARCHAR(120) NOT NULL DEFAULT '',
  article VARCHAR(80) NOT NULL DEFAULT '',
  product_title VARCHAR(180) NOT NULL DEFAULT '',
  configuration_json LONGTEXT NOT NULL,
  width DOUBLE NULL,
  wicket_width DOUBLE NULL,
  wicket_height DOUBLE NULL,
  height DOUBLE NULL,
  install TINYINT(1) NOT NULL DEFAULT 0,
  posts TINYINT(1) NOT NULL DEFAULT 0,
  color VARCHAR(120) NOT NULL DEFAULT '',
  total INT UNSIGNED NOT NULL DEFAULT 0,
  client_total INT UNSIGNED NOT NULL DEFAULT 0,
  quote_verified TINYINT(1) NOT NULL DEFAULT 0,
  delivery_pending TINYINT(1) NOT NULL DEFAULT 0,
  delivery_out_of_area TINYINT(1) NOT NULL DEFAULT 0,
  delivery_distance_km DOUBLE NULL,
  consent TINYINT(1) NOT NULL DEFAULT 0,
  consent_at DATETIME NULL,
  policy_version VARCHAR(80) NOT NULL DEFAULT '',
  comment TEXT NOT NULL,
  message MEDIUMTEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_leads_created (created_at),
  KEY idx_leads_status (status),
  KEY idx_leads_category (category),
  KEY idx_leads_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_workflow (
  lead_id BIGINT UNSIGNED NOT NULL,
  stage VARCHAR(60) NOT NULL DEFAULT 'new',
  admin_note TEXT NOT NULL,
  next_action_at VARCHAR(40) NOT NULL DEFAULT '',
  loss_reason VARCHAR(500) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lead_id),
  CONSTRAINT fk_workflow_lead FOREIGN KEY (lead_id) REFERENCES site_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS manager_push_subscriptions (
  endpoint_hash CHAR(64) NOT NULL,
  admin_id INT UNSIGNED NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL DEFAULT '',
  auth_token VARCHAR(255) NOT NULL DEFAULT '',
  user_agent VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (endpoint_hash),
  KEY idx_manager_push_admin (admin_id),
  KEY idx_manager_push_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
