-- Remove BetterAuth tables and rebuild the rest of the schema without
-- foreign keys to `user`.
--
-- The rebuilds must run BEFORE dropping the auth tables: workerd (D1 local)
-- errors when a table that is still the parent of an FK in a child table is
-- dropped, so the child tables have to lose their `user` references first.
-- Foreign keys are disabled while tables are rebuilt and finally re-enabled,
-- so emptying, copying and dropping are never blocked.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_appointment_services` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`service_price_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`added_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_price_id`) REFERENCES `service_prices`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_appointment_services`("id", "appointment_id", "service_price_id", "quantity", "added_by", "created_at", "updated_at") SELECT "id", "appointment_id", "service_price_id", "quantity", "added_by", "created_at", "updated_at" FROM `appointment_services`;--> statement-breakpoint
DROP TABLE `appointment_services`;--> statement-breakpoint
ALTER TABLE `__new_appointment_services` RENAME TO `appointment_services`;--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_services_unique` ON `appointment_services` (`appointment_id`,`service_price_id`);--> statement-breakpoint
CREATE INDEX `appointment_services_appointment_idx` ON `appointment_services` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `__new_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`google_calendar_id` text NOT NULL,
	`google_event_id` text NOT NULL,
	`recurring_event_id` text,
	`summary` text,
	`all_day` integer DEFAULT false NOT NULL,
	`local_date` text,
	`starts_at` integer,
	`ends_at` integer,
	`attendance_status` text DEFAULT 'scheduled' NOT NULL,
	`calendar_status` text DEFAULT 'confirmed' NOT NULL,
	`confirmed_at` integer,
	`outcome_recorded_by` text,
	`outcome_recorded_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_appointments`("id", "patient_id", "google_calendar_id", "google_event_id", "recurring_event_id", "summary", "all_day", "local_date", "starts_at", "ends_at", "attendance_status", "calendar_status", "confirmed_at", "outcome_recorded_by", "outcome_recorded_at", "created_at", "updated_at") SELECT "id", "patient_id", "google_calendar_id", "google_event_id", "recurring_event_id", "summary", "all_day", "local_date", "starts_at", "ends_at", "attendance_status", "calendar_status", "confirmed_at", "outcome_recorded_by", "outcome_recorded_at", "created_at", "updated_at" FROM `appointments`;--> statement-breakpoint
DROP TABLE `appointments`;--> statement-breakpoint
ALTER TABLE `__new_appointments` RENAME TO `appointments`;--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_calendar_event_unique` ON `appointments` (`google_calendar_id`,`google_event_id`);--> statement-breakpoint
CREATE INDEX `appointments_starts_at_idx` ON `appointments` (`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_patient_idx` ON `appointments` (`patient_id`);--> statement-breakpoint
CREATE INDEX `appointments_calendar_status_idx` ON `appointments` (`calendar_status`);--> statement-breakpoint
CREATE TABLE `__new_follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`description` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assigned_to` text,
	`last_contact_at` integer,
	`completed_by` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_follow_ups`("id", "patient_id", "description", "due_at", "status", "assigned_to", "last_contact_at", "completed_by", "completed_at", "created_at", "updated_at") SELECT "id", "patient_id", "description", "due_at", "status", "assigned_to", "last_contact_at", "completed_by", "completed_at", "created_at", "updated_at" FROM `follow_ups`;--> statement-breakpoint
DROP TABLE `follow_ups`;--> statement-breakpoint
ALTER TABLE `__new_follow_ups` RENAME TO `follow_ups`;--> statement-breakpoint
CREATE INDEX `follow_ups_status_due_idx` ON `follow_ups` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `__new_invoice_history` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`patient_name` text NOT NULL,
	`patient_phone` text NOT NULL,
	`appointment_starts_at` integer NOT NULL,
	`services` text NOT NULL,
	`subtotal` integer NOT NULL,
	`total` integer NOT NULL,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'generated' NOT NULL,
	`sent_at` integer,
	`resent_reason` text,
	`resent_of` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resent_of`) REFERENCES `invoice_history`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_invoice_history`("id", "appointment_id", "patient_id", "patient_name", "patient_phone", "appointment_starts_at", "services", "subtotal", "total", "created_by", "status", "sent_at", "resent_reason", "resent_of", "created_at") SELECT "id", "appointment_id", "patient_id", "patient_name", "patient_phone", "appointment_starts_at", "services", "subtotal", "total", "created_by", "status", "sent_at", "resent_reason", "resent_of", "created_at" FROM `invoice_history`;--> statement-breakpoint
DROP TABLE `invoice_history`;--> statement-breakpoint
ALTER TABLE `__new_invoice_history` RENAME TO `invoice_history`;--> statement-breakpoint
CREATE INDEX `invoice_history_appointment_idx` ON `invoice_history` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `invoice_history_patient_idx` ON `invoice_history` (`patient_id`);--> statement-breakpoint
CREATE INDEX `invoice_history_status_idx` ON `invoice_history` (`status`);--> statement-breakpoint
CREATE INDEX `invoice_history_created_at_idx` ON `invoice_history` (`created_at`);--> statement-breakpoint
CREATE TABLE `__new_reminder_records` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`purpose` text DEFAULT 'reminder' NOT NULL,
	`template_key` text NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`recorded_by` text NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`resent_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reminder_records`("id", "appointment_id", "purpose", "template_key", "status", "recorded_by", "recorded_at", "resent_reason", "created_at", "updated_at") SELECT "id", "appointment_id", "purpose", "template_key", "status", "recorded_by", "recorded_at", "resent_reason", "created_at", "updated_at" FROM `reminder_records`;--> statement-breakpoint
DROP TABLE `reminder_records`;--> statement-breakpoint
ALTER TABLE `__new_reminder_records` RENAME TO `reminder_records`;--> statement-breakpoint
CREATE INDEX `reminder_records_appointment_idx` ON `reminder_records` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `reminder_records_status_idx` ON `reminder_records` (`status`);--> statement-breakpoint
CREATE TABLE `__new_service_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`service_type` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_service_prices`("id", "service_type", "name", "price", "is_active", "updated_by", "created_at", "updated_at") SELECT "id", "service_type", "name", "price", "is_active", "updated_by", "created_at", "updated_at" FROM `service_prices`;--> statement-breakpoint
DROP TABLE `service_prices`;--> statement-breakpoint
ALTER TABLE `__new_service_prices` RENAME TO `service_prices`;--> statement-breakpoint
CREATE UNIQUE INDEX `service_prices_service_type_unique` ON `service_prices` (`service_type`);--> statement-breakpoint
CREATE INDEX `service_prices_is_active_idx` ON `service_prices` (`is_active`);--> statement-breakpoint
-- Only now that no table references the auth tables can they be dropped.
-- Children first, so they never dangle: `user` goes last.
DROP TABLE `account`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
DROP TABLE `verification`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
