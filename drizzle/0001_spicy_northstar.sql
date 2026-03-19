CREATE TABLE `ingest_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`link_id` integer,
	`article_url` text,
	`level` text NOT NULL,
	`stage` text NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ingest_events_run_created` ON `ingest_events` (`run_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ingest_events_stage` ON `ingest_events` (`stage`,`created_at`);