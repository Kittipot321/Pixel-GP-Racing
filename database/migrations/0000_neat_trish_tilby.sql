CREATE TABLE `guesses` (
	`id` text PRIMARY KEY NOT NULL,
	`race_id` text NOT NULL,
	`user_id` text NOT NULL,
	`guessed_color` text NOT NULL,
	`is_correct` integer,
	`points_awarded` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`race_id`) REFERENCES `races`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `guesses_user_idx` ON `guesses` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `guesses_race_user_unique` ON `guesses` (`race_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `races` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`winner_color` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`started_at` text,
	`settled_at` text
);
--> statement-breakpoint
CREATE TABLE `score_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`race_id` text NOT NULL,
	`user_id` text NOT NULL,
	`points` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`race_id`) REFERENCES `races`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `score_ledger_user_idx` ON `score_ledger` (`user_id`);--> statement-breakpoint
CREATE INDEX `score_ledger_user_created_idx` ON `score_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `score_ledger_race_user_unique` ON `score_ledger` (`race_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);