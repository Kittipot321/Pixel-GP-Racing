-- Rebuild `races` to add the NOT NULL `owner_id` column (per-player races).
-- A plain `ALTER TABLE ... ADD COLUMN owner_id NOT NULL` is rejected by SQLite
-- when the table already holds rows (no default). Pre-Phase-2 races have no
-- owner column, so this migration rebuilds the table; pre-existing ownerless
-- rows are intentionally not carried over. Guesses/score_ledger rows that
-- reference a dropped race cascade-delete.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_races` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`winner_color` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`started_at` text,
	`settled_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
DROP TABLE `races`;--> statement-breakpoint
ALTER TABLE `__new_races` RENAME TO `races`;--> statement-breakpoint
CREATE INDEX `races_owner_status_idx` ON `races` (`owner_id`,`status`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
