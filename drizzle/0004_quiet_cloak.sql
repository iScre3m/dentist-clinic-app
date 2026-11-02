CREATE TABLE `appointment_services` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`service_price_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`added_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_price_id`) REFERENCES `service_prices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`added_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_services_unique` ON `appointment_services` (`appointment_id`,`service_price_id`);--> statement-breakpoint
CREATE INDEX `appointment_services_appointment_idx` ON `appointment_services` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `invoice_history` (
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
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resent_of`) REFERENCES `invoice_history`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoice_history_appointment_idx` ON `invoice_history` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `invoice_history_patient_idx` ON `invoice_history` (`patient_id`);--> statement-breakpoint
CREATE INDEX `invoice_history_status_idx` ON `invoice_history` (`status`);--> statement-breakpoint
CREATE INDEX `invoice_history_created_at_idx` ON `invoice_history` (`created_at`);--> statement-breakpoint
CREATE TABLE `service_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`service_type` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_prices_service_type_unique` ON `service_prices` (`service_type`);--> statement-breakpoint
CREATE INDEX `service_prices_is_active_idx` ON `service_prices` (`is_active`);