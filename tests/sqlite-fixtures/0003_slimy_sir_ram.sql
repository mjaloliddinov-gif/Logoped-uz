CREATE TABLE `ai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_requests_owner_created` ON `ai_requests` (`owner`,`created`);