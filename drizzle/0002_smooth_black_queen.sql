CREATE TABLE `reader_signup_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`email` text NOT NULL,
	`ip_address` text,
	`origin` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reader_signup_events_created` ON `reader_signup_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_reader_signup_events_user_created` ON `reader_signup_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reader_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reader_users_email` ON `reader_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_reader_users_created` ON `reader_users` (`created_at`);