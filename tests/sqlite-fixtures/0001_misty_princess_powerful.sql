CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`created` text NOT NULL,
	`seen` text DEFAULT '0' NOT NULL
);
