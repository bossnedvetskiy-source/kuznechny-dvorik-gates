INSERT INTO `catalog_galleries`
  (`article`, `photos_json`, `fit_mode`, `media_type`, `updated_at`, `updated_by`)
VALUES
  (
    'Арт.6',
    '[{"url":"/catalog/art-6-1.webp","x":50,"y":50,"zoom":0.99},{"url":"/catalog/art-6-2.webp","x":50,"y":50,"zoom":1},{"url":"/catalog/art-6-3.webp","x":50,"y":50,"zoom":0.99}]',
    'cover',
    'photo',
    CURRENT_TIMESTAMP,
    'archive-export'
  )
ON CONFLICT(`article`) DO UPDATE SET
  `photos_json` = excluded.`photos_json`,
  `fit_mode` = excluded.`fit_mode`,
  `media_type` = excluded.`media_type`,
  `updated_at` = CURRENT_TIMESTAMP,
  `updated_by` = excluded.`updated_by`;
