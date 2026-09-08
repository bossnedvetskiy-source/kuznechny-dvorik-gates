CREATE TABLE `catalog_galleries` (
	`article` text PRIMARY KEY NOT NULL,
	`photos_json` text NOT NULL,
	`fit_mode` text DEFAULT 'contain' NOT NULL,
	`media_type` text DEFAULT 'photo' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL
);
