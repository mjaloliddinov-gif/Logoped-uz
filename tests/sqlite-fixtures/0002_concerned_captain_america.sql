CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`student` text NOT NULL,
	`role` text NOT NULL,
	`owner` text NOT NULL,
	`created` text NOT NULL,
	`expires` text NOT NULL,
	`status` text NOT NULL,
	`accepted_by` text
);
