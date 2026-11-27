CREATE TABLE `admin_attempts` (
	`owner` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_grants` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`version` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_grants_owner` ON `admin_grants` (`owner`);