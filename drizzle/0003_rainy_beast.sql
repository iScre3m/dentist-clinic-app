PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_patients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`phone_verified_at` integer,
	`email` text,
	`whatsapp_consent` text DEFAULT 'denied' NOT NULL,
	`consent_source` text,
	`consent_text_version` integer,
	`consent_recorded_at` integer,
	`registered_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`opted_out_at` integer,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_patients`("id", "name", "phone", "phone_verified_at", "email", "whatsapp_consent", "consent_source", "consent_text_version", "consent_recorded_at", "registered_at", "opted_out_at", "archived_at", "created_at", "updated_at") SELECT "id", "name", "phone", "phone_verified_at", "email", CASE WHEN "whatsapp_consent" = 'unknown' THEN 'denied' ELSE "whatsapp_consent" END, "consent_source", "consent_text_version", "consent_recorded_at", "registered_at", "opted_out_at", "archived_at", "created_at", "updated_at" FROM `patients`;--> statement-breakpoint
DROP TABLE `patients`;--> statement-breakpoint
ALTER TABLE `__new_patients` RENAME TO `patients`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `patients_phone_unique` ON `patients` (`phone`);--> statement-breakpoint
CREATE INDEX `patients_archived_idx` ON `patients` (`archived_at`);