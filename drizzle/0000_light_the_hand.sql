CREATE TABLE `app_locks` (
	`name` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `article_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`link_id` integer NOT NULL,
	`article_url` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`model_used` text,
	`agent_output` text,
	`duration_ms` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_run_created` ON `article_attempts` (`run_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `article_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feed_url` text NOT NULL,
	`original_url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`source_domain` text NOT NULL,
	`status` text NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`next_retry_at` integer,
	`article_id` integer,
	`last_error` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_article_links_normalized_url` ON `article_links` (`normalized_url`);--> statement-breakpoint
CREATE INDEX `idx_article_links_status` ON `article_links` (`status`);--> statement-breakpoint
CREATE INDEX `idx_article_links_retry` ON `article_links` (`next_retry_at`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`link_id` integer NOT NULL,
	`canonical_url` text NOT NULL,
	`source_domain` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`writer` text,
	`published_at` integer,
	`model_used` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_articles_link_id` ON `articles` (`link_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_articles_canonical_url` ON `articles` (`canonical_url`);--> statement-breakpoint
CREATE INDEX `idx_articles_created` ON `articles` (`created_at`);--> statement-breakpoint
CREATE TABLE `feeds` (
	`url` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingest_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trigger` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`total_links` integer DEFAULT 0 NOT NULL,
	`new_links` integer DEFAULT 0 NOT NULL,
	`queued_for_processing` integer DEFAULT 0 NOT NULL,
	`processed` integer DEFAULT 0 NOT NULL,
	`succeeded` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`current_item_url` text,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `idx_ingest_runs_status` ON `ingest_runs` (`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `login_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`success` integer NOT NULL,
	`reason` text,
	`ip_address` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_login_audit_created` ON `login_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_reset` ON `rate_limits` (`reset_at`);