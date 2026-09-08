CREATE TABLE IF NOT EXISTS `admin_auth` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `username` text NOT NULL,
  `password_salt` text NOT NULL,
  `password_hash` text NOT NULL,
  `session_secret` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
