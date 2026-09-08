import { sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const catalogGalleries = sqliteTable('catalog_galleries', {
  article: text('article').primaryKey().notNull(),
  photosJson: text('photos_json').notNull(),
  fitMode: text('fit_mode').notNull().default('contain'),
  mediaType: text('media_type').notNull().default('photo'),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text('updated_by').notNull().default('')
});
